/**
 * Pure fold tests: the dashboard numbers over synthetic session rows.
 */

import { describe, expect, it } from 'vitest'
import { foldUsage } from '../src/client/usage-fold.ts'
import type { SessionSummary } from '@deepseek-ai/dsh-api-remotes/client'
import type { UsageStatsProjection } from '@deepseek-ai/dsh-session-stats/client'

/** One wire row with the given usageStats projection. */
function row(id: string, usage: UsageStatsProjection | undefined): SessionSummary {
  return {
    sessionId: id as SessionSummary['sessionId'],
    updatedAt: 0,
    running: false,
    blank: false,
    ...(usage === undefined ? {} : { projections: { asOfSeq: -1, values: { usageStats: usage } } }),
  }
}

const base: UsageStatsProjection = {
  firstAt: 1_720_000_000_000,
  lastAt: 1_720_100_000_000,
  days: { '2024-07-01': { inputTokens: 100, outputTokens: 50, toolCalls: 3 } },
  tools: { read: 2, bash: 1 },
  skills: {},
  efforts: { high: 1 },
  models: { 'deepseek-v4': 1 },
}

function relativeDay(offset: number): string {
  const today = new Date()
  const date = new Date(today)
  date.setDate(today.getDate() + offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return date.getFullYear() + '-' + month + '-' + day
}

describe('foldUsage', () => {
  it('folds an empty list into the zero overview', () => {
    const overview = foldUsage([])
    expect(overview.sessions).toBe(0)
    expect(overview.inputTokens).toBe(0)
    expect(overview.daily).toEqual([])
    expect(overview.peakDay).toBeNull()
    expect(overview.currentStreak).toBe(0)
    expect(overview.longestStreak).toBe(0)
  })

  it('ignores rows without a usageStats projection', () => {
    const overview = foldUsage([
      row('a', undefined),
      row('b', { ...base, firstAt: null, lastAt: null, days: {} }),
    ])
    expect(overview.sessions).toBe(0)
    expect(overview.toolCalls).toBe(0)
  })

  it('uses stable alphabetical ties, clamps negative spans, and sorts days', () => {
    const overview = foldUsage([row('a', {
      ...base,
      firstAt: 20,
      lastAt: 10,
      days: {
        '2024-07-02': { inputTokens: 2, outputTokens: 0, toolCalls: 0 },
        '2024-07-01': { inputTokens: 1, outputTokens: 0, toolCalls: 0 },
      },
      tools: { beta: 1, alpha: 1 },
    })])
    expect(overview.longestChatMs).toBe(0)
    expect(overview.daily.map(day => day.day)).toEqual(['2024-07-01', '2024-07-02'])
    expect(overview.tools).toEqual([{ name: 'alpha', count: 1 }, { name: 'beta', count: 1 }])
    expect(overview.peakDay?.day).toBe('2024-07-02')
  })

  it('sums tokens, tool calls, and per-day buckets across sessions', () => {
    const overview = foldUsage([
      row('a', base),
      row('b', {
        ...base,
        firstAt: 1_720_200_000_000,
        lastAt: 1_720_300_000_000,
        days: { '2024-07-01': { inputTokens: 50, outputTokens: 25, toolCalls: 2 } },
        tools: { read: 1, edit: 4 },
      }),
    ])
    expect(overview.sessions).toBe(2)
    expect(overview.inputTokens).toBe(150)
    expect(overview.outputTokens).toBe(75)
    expect(overview.toolCalls).toBe(5)
    expect(overview.toolsUsed).toBe(3)
    expect(overview.daily).toHaveLength(1)
    expect(overview.daily[0]).toMatchObject({ day: '2024-07-01', inputTokens: 150, outputTokens: 75, calls: 5 })
    expect(overview.peakDay?.day).toBe('2024-07-01')
    expect(overview.tools[0]).toEqual({ name: 'edit', count: 4 })
    expect(overview.longestChatMs).toBe(100_000_000)
  })

  it('counts skill calls and effort distribution', () => {
    const overview = foldUsage([row('a', {
      ...base,
      skills: { 'project-structure-viewer': 2, 'other-skill': 1 },
      efforts: { high: 3, low: 1 },
    })])
    expect(overview.skillsUsed).toBe(2)
    expect(overview.skillCalls).toBe(3)
    expect(overview.skills[0]).toEqual({ name: 'project-structure-viewer', count: 2 })
    expect(overview.efforts[0]).toEqual({ name: 'high', count: 3 })
    expect(overview.models[0]).toEqual({ name: 'deepseek-v4', count: 1 })
  })

  it('derives streaks from consecutive activity days', () => {
    const bucket = (inputTokens: number): UsageStatsProjection['days'][string] => ({
      inputTokens,
      outputTokens: 0,
      toolCalls: 0,
    })
    // Active: today-3, today-2, today-1, today → current 4; plus an old run of 3.
    const days: UsageStatsProjection['days'] = {
      [relativeDay(-30)]: bucket(1),
      [relativeDay(-29)]: bucket(1),
      [relativeDay(-28)]: bucket(1),
      [relativeDay(-3)]: bucket(1),
      [relativeDay(-2)]: bucket(1),
      [relativeDay(-1)]: bucket(1),
      [relativeDay(0)]: bucket(1),
    }
    const overview = foldUsage([row('a', { ...base, days, firstAt: null, lastAt: null })])
    expect(overview.currentStreak).toBe(4)
    expect(overview.longestStreak).toBe(4)
  })

  it('drops the current streak when the last activity is older than yesterday', () => {
    const days: UsageStatsProjection['days'] = {
      [relativeDay(-10)]: { inputTokens: 1, outputTokens: 0, toolCalls: 0 },
      [relativeDay(-9)]: { inputTokens: 1, outputTokens: 0, toolCalls: 0 },
    }
    const overview = foldUsage([row('a', { ...base, days, firstAt: null, lastAt: null })])
    expect(overview.currentStreak).toBe(0)
    expect(overview.longestStreak).toBe(2)
  })
})
