import { describe, expect, it } from 'vitest'
import { createMessage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { usageStatsProjectionDefinition } from '../src/projection.ts'
import type { UsageStatsProjection } from '../src/types.ts'

function at(time: number, type: string, data: unknown): SessionEvent {
  return { type, seq: time, time, data } as unknown as SessionEvent
}

function fold(events: readonly SessionEvent[]): UsageStatsProjection {
  const state = events.reduce(
    (current, event) => usageStatsProjectionDefinition.apply(current, event),
    usageStatsProjectionDefinition.init(),
  )
  return usageStatsProjectionDefinition.view(state)
}

const message = createMessage({
  role: 'assistant',
  content: [{ type: 'text', text: 'answer' }],
  source: { kind: 'model', provider: 'mock', model: 'm1' },
})

describe('usageStats projection', () => {
  it('starts empty and returns the same state for unrelated events', () => {
    const state = usageStatsProjectionDefinition.init()
    expect(usageStatsProjectionDefinition.view(state)).toEqual({
      firstAt: null,
      lastAt: null,
      days: {},
      tools: {},
      skills: {},
      efforts: {},
      models: {},
    })
    expect(usageStatsProjectionDefinition.apply(
      state,
      at(1, 'user/message', { content: [] }),
    )).toBe(state)
  })

  it('replaces a same-step usage chunk with the finalized sample', () => {
    const time = new Date(2026, 7, 14, 12).getTime()
    const result = fold([
      at(time, 'assistant/chunk', {
        turn: 1,
        step: 1,
        chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 3 } },
      }),
      at(time + 100, 'assistant/message', {
        turn: 1,
        step: 1,
        message,
        usage: { inputTokens: 14, outputTokens: 5, cacheReadTokens: 8, cacheWriteTokens: 1 },
      }),
    ])
    expect(result.days['2026-08-14']).toEqual({ inputTokens: 23, outputTokens: 5, toolCalls: 0 })
    expect(result.firstAt).toBe(time)
    expect(result.lastAt).toBe(time + 100)
  })

  it('moves a replacement across midnight without retaining an empty day', () => {
    const before = new Date(2026, 7, 14, 23, 59, 59).getTime()
    const after = new Date(2026, 7, 15, 0, 0, 1).getTime()
    const result = fold([
      at(before, 'assistant/chunk', {
        turn: 1, step: 1,
        chunk: { type: 'usage', usage: { inputTokens: 4, outputTokens: 1 } },
      }),
      at(after, 'assistant/message', {
        turn: 1, step: 1, message,
        usage: { inputTokens: 6, outputTokens: 2 },
      }),
    ])
    expect(result.days).toEqual({
      '2026-08-15': { inputTokens: 6, outputTokens: 2, toolCalls: 0 },
    })
  })

  it('counts tools and valid skill names while containing malformed arguments', () => {
    const time = new Date(2026, 7, 14, 12).getTime()
    const result = fold([
      at(time, 'tool/call', { name: 'read', arguments: '{}', callId: 'a', turn: 1, step: 1 }),
      at(time + 1, 'tool/call', { name: 'skill', arguments: '{"name":"image-vision-bridge"}', callId: 'b', turn: 1, step: 1 }),
      at(time + 2, 'tool/call', { name: 'skill', arguments: '{bad', callId: 'c', turn: 1, step: 1 }),
      at(time + 3, 'tool/call', { name: 'skill', arguments: '{"name":3}', callId: 'd', turn: 1, step: 1 }),
    ])
    expect(result.tools).toEqual({ read: 1, skill: 3 })
    expect(result.skills).toEqual({ 'image-vision-bridge': 1 })
    expect(result.days['2026-08-14']?.toolCalls).toBe(4)
  })

  it('counts every entered step under the inherited request profile', () => {
    const result = fold([
      at(1, 'request/header', {
        reason: 'initial',
        header: { config: { provider: 'mock', model: 'm1', reasoningEffort: 'high' } },
      }),
      at(2, 'step/start', { turn: 1, step: 1 }),
      at(3, 'step/start', { turn: 1, step: 2 }),
      at(4, 'request/header', {
        reason: 'change',
        header: { config: { provider: 'mock', model: 'm2' } },
      }),
      at(5, 'step/start', { turn: 2, step: 1 }),
    ])
    expect(result.models).toEqual({ m1: 2, m2: 1 })
    expect(result.efforts).toEqual({ high: 2, default: 1 })
    expect(result.firstAt).toBe(2)
    expect(result.lastAt).toBe(5)
  })

  it('keeps an existing profile and activity window when neither changes', () => {
    const initial = usageStatsProjectionDefinition.init()
    const profile = usageStatsProjectionDefinition.apply(initial, at(100, 'request/header', {
      reason: 'initial',
      header: { config: { provider: 'mock', model: 'm1', reasoningEffort: 'high' } },
    }))
    expect(usageStatsProjectionDefinition.apply(profile, at(110, 'request/header', {
      reason: 'same',
      header: { config: { provider: 'mock', model: 'm1', reasoningEffort: 'high' } },
    }))).toBe(profile)
    const changedEffort = usageStatsProjectionDefinition.apply(profile, at(120, 'request/header', {
      reason: 'effort',
      header: { config: { provider: 'mock', model: 'm1', reasoningEffort: 'low' } },
    }))
    const withFirst = usageStatsProjectionDefinition.apply(changedEffort, at(100, 'step/start', { turn: 1, step: 1 }))
    const withLast = usageStatsProjectionDefinition.apply(withFirst, at(300, 'step/start', { turn: 1, step: 2 }))
    const between = usageStatsProjectionDefinition.apply(withLast, at(200, 'tool/call', {
      name: 'read', arguments: '{}', callId: 'middle', turn: 1, step: 2,
    }))
    expect(usageStatsProjectionDefinition.view(between)).toMatchObject({ firstAt: 100, lastAt: 300 })
  })

  it('contains a stale same-step pointer whose old day bucket is absent', () => {
    const state = {
      ...usageStatsProjectionDefinition.init(),
      lastUsage: { turn: 1, step: 1, day: '2026-08-13', inputTokens: 9, outputTokens: 3 },
    }
    const next = usageStatsProjectionDefinition.apply(state, at(new Date(2026, 7, 14, 12).getTime(), 'assistant/message', {
      turn: 1,
      step: 1,
      message,
      usage: { inputTokens: 4, outputTokens: 2 },
    }))
    expect(usageStatsProjectionDefinition.view(next).days).toEqual({
      '2026-08-14': { inputTokens: 4, outputTokens: 2, toolCalls: 0 },
    })
  })
})
