// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { UsageSection } from '../src/client/UsageSection.tsx'
import type { UsageSectionProps } from '../src/client/UsageSection.tsx'
import { en, zh } from '../src/client/locales.ts'
import { EMPTY_OVERVIEW } from '../src/client/usage-fold.ts'
import type { UsageState } from '../src/client/usage-store.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const t = (key: keyof typeof en): string => en[key]

function props(
  state: UsageState,
  load = vi.fn().mockResolvedValue(undefined),
  translate: (key: keyof typeof en) => string = t,
): UsageSectionProps {
  const store = createSnapshotStore(state)
  return { useUsage: bindSnapshotSelector(store), load, t: translate } as unknown as UsageSectionProps
}

describe('UsageSection', () => {
  it('loads on mount, refreshes while open, and shows loading', () => {
    vi.useFakeTimers()
    const load = vi.fn().mockResolvedValue(undefined)
    render(<UsageSection {...props({ status: 'loading', overview: null, error: null }, load)} />)
    expect(screen.getByText('Crunching numbers…')).toBeDefined()
    expect(load).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(60_000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('renders retry and the empty state', () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<UsageSection {...props({ status: 'error', overview: null, error: 'hidden' }, load)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(load).toHaveBeenCalledTimes(2)
    rerender(<UsageSection {...props({ status: 'ready', overview: EMPTY_OVERVIEW, error: null })} />)
    expect(screen.getByText(/No usage recorded yet/)).toBeDefined()
  })

  it('renders totals, tools, and each activity mode', () => {
    const overview = {
      ...EMPTY_OVERVIEW,
      sessions: 2,
      inputTokens: 12_000,
      outputTokens: 3_000,
      toolCalls: 4,
      toolsUsed: 2,
      skillsUsed: 1,
      skillCalls: 1,
      tools: [{ name: 'read', count: 3 }, { name: 'bash', count: 1 }],
      efforts: [{ name: 'default', count: 2 }],
      models: [{ name: 'deepseek-v4', count: 2 }],
      daily: [
        { day: '2026-08-13', inputTokens: 4_000, outputTokens: 1_000, calls: 2 },
        { day: '2026-08-14', inputTokens: 8_000, outputTokens: 2_000, calls: 2 },
      ],
      peakDay: { day: '2026-08-14', inputTokens: 8_000, outputTokens: 2_000, calls: 2 },
      longestChatMs: 3_600_000,
      currentStreak: 2,
      longestStreak: 2,
    }
    render(<UsageSection {...props({ status: 'ready', overview, error: null })} />)
    expect(screen.getByText('15K')).toBeDefined()
    expect(screen.getByText('deepseek-v4')).toBeDefined()
    expect(screen.getAllByText('read')).toHaveLength(2)
    fireEvent.click(screen.getByRole('tab', { name: 'Weekly' }))
    expect(screen.getByRole('tab', { name: 'Weekly' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Cumulative' }))
    expect(screen.getByRole('img')).toBeDefined()
  })

  it('formats Chinese large totals and every tool presentation fallback', () => {
    const tools = [
      'skill', 'read', 'read_file', 'bash', 'bash_exec', 'edit', 'edit_file', 'write', 'write_file',
      'glob', 'grep', 'glob_files', 'grep_text', 'web_fetch', 'web_search', 'job_wait', 'subagent_spawn',
      'run_code', 'run_code_python', '$plugin', 'custom',
    ].map((name, index) => ({ name, count: 30 - index }))
    const overview = {
      ...EMPTY_OVERVIEW,
      sessions: 1,
      inputTokens: 12_300_000_000,
      outputTokens: 999,
      longestChatMs: 30 * 60_000,
      tools,
      toolsUsed: tools.length,
    }
    render(<UsageSection {...props(
      { status: 'ready', overview, error: null },
      undefined,
      key => zh[key],
    )} />)
    expect(screen.getByText('123亿/999')).toBeDefined()
    expect(screen.getByText('30分')).toBeDefined()
    expect(screen.getAllByRole('listitem')).toHaveLength(tools.length)
  })

  it('covers compact English units, empty insights, and zero cumulative activity', () => {
    const today = new Date().toISOString().slice(0, 10)
    const overview = {
      ...EMPTY_OVERVIEW,
      sessions: 1,
      inputTokens: 1_500_000,
      outputTokens: 120_000,
      longestChatMs: 60 * 60_000,
      daily: [{ day: today, inputTokens: 0, outputTokens: 0, calls: 0 }],
      peakDay: { day: today, inputTokens: 0, outputTokens: 0, calls: 0 },
      efforts: [{ name: 'high', count: 0 }],
    }
    render(<UsageSection {...props({ status: 'ready', overview, error: null })} />)
    expect(screen.getByText('1.5M/120K')).toBeDefined()
    expect(screen.getByText('1h')).toBeDefined()
    expect(screen.getByText('high')).toBeDefined()
    fireEvent.click(screen.getByRole('tab', { name: 'Cumulative' }))
    expect(screen.getByText('No token activity yet')).toBeDefined()
  })

  it('formats mixed-hour durations in both locales and falls back from a null overview', () => {
    const english = { ...EMPTY_OVERVIEW, sessions: 1, longestChatMs: 90 * 60_000 }
    const { rerender } = render(<UsageSection {...props({ status: 'ready', overview: english, error: null })} />)
    expect(screen.getByText('1h30m')).toBeDefined()

    const chinese = { ...EMPTY_OVERVIEW, sessions: 1, longestChatMs: 90 * 60_000, inputTokens: 15_000 }
    rerender(<UsageSection {...props(
      { status: 'ready', overview: chinese, error: null },
      undefined,
      key => zh[key],
    )} />)
    expect(screen.getByText('1小时30分')).toBeDefined()
    expect(screen.getByText('1.5万/0')).toBeDefined()

    rerender(<UsageSection {...props({ status: 'ready', overview: null, error: null })} />)
    expect(screen.getByText(/No usage recorded yet/)).toBeDefined()

    rerender(<UsageSection {...props({
      status: 'ready',
      overview: { ...EMPTY_OVERVIEW, sessions: 1 },
      error: null,
    })} />)
    expect(screen.getAllByText('—')).toHaveLength(3)
  })
})
