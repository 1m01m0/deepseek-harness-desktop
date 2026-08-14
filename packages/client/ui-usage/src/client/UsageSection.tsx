/**
 * The Usage dashboard section: a Codex-style overview of token usage and
 * tool calls, folded client-side from the session list's per-session
 * `usageStats` projection baselines (see ./usage-fold.ts). Layout: five
 * stat cards, a token-activity heatmap with daily/weekly/cumulative views,
 * then an insights column beside the most-used tools list.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS, type UsageLocaleKey } from './locales.ts'
import { EMPTY_OVERVIEW, type CountEntry, type UsageDay, type UsageOverview } from './usage-fold.ts'
import type { UsageState } from './usage-store.ts'
import css from './UsageSection.module.css'

/** How often the open dashboard re-pulls the session list (ms). */
const REFRESH_MS = 60_000

/** Registration-side business face for the Host-backed usage overview. */
export interface UsageSectionInjected {
  hooks: {
    /** Usage snapshot bound by the renderer as useUsage. */
    usage: SnapshotStore<UsageState>
  }
  /** Load or refresh the complete overview. */
  load: () => Promise<void>
}

/** Full component props: the settings-section owner share plus the inject face. */
export type UsageSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & InjectFace<UsageSectionInjected>

type HeatmapMode = 'daily' | 'weekly' | 'cumulative'

/**
 * Compact human token count. The unit vocabulary follows the active locale:
 * 万/亿 for Chinese, K/M otherwise (a local app's numbers are rarely larger).
 */
function formatTokens(count: number, t: (key: UsageLocaleKey) => string): string {
  const zh = t('localeId') === 'zh'
  const scaled = (value: number): string =>
    value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)
  if (zh) {
    if (count >= 100_000_000) return scaled(count / 100_000_000) + t('unitHundredMillion')
    if (count >= 10_000) return scaled(count / 10_000) + t('unitTenThousand')
    return String(count)
  }
  if (count >= 1_000_000) return scaled(count / 1_000_000) + t('unitM')
  if (count >= 1_000) return scaled(count / 1_000) + t('unitK')
  return String(count)
}

/** Duration as whole minutes, compact in every locale: '41m' / '1h41m' / '41分' / '1小时41分'. */
function formatDuration(ms: number, t: (key: UsageLocaleKey) => string): string {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  if (minutes < 60) return minutes + t('minuteShort')
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return hours + t('hourShort')
  return hours + t('hourShort') + rest + t('minuteShort')
}

/** One stat card. */
function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className={css.statCard}>
      <div className={css.statLabel}>{props.label}</div>
      <div className={css.statValue}>{props.value}</div>
      {props.sub !== undefined && <div className={css.statSub}>{props.sub}</div>}
    </div>
  )
}

/** Week grid cell facts for one day. */
interface HeatCell {
  day: string | null
  tokens: number
  calls: number
}

/**
 * Build the 53-week GitHub-style grid ending at the current week (Sunday
 * start). `weekly` mode colors every day of a week with the week's total;
 * `daily` mode colors each day with its own total. Days after today are null.
 */
function buildWeeks(daily: readonly UsageDay[], mode: Exclude<HeatmapMode, 'cumulative'>): { weeks: HeatCell[][]; labels: Array<{ index: number; label: string }> } {
  const byDay = new Map(daily.map(day => [day.day, day]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const gridStart = new Date(weekStart)
  gridStart.setDate(weekStart.getDate() - 52 * 7)
  const weekCount = 53
  const dayKey = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return date.getFullYear() + '-' + month + '-' + day
  }
  const weeks: HeatCell[][] = []
  const labels: Array<{ index: number; label: string }> = []
  let lastLabelMonth = -1
  for (let w = 0; w < weekCount; w += 1) {
    const weekStartDate = new Date(gridStart)
    weekStartDate.setDate(gridStart.getDate() + w * 7)
    if (weekStartDate.getMonth() !== lastLabelMonth) {
      lastLabelMonth = weekStartDate.getMonth()
      labels.push({ index: w, label: String(weekStartDate.getMonth() + 1) })
    }
    let weekTokens = 0
    let weekCalls = 0
    const cells: HeatCell[] = []
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(weekStartDate)
      date.setDate(weekStartDate.getDate() + d)
      if (date.getTime() > today.getTime()) {
        cells.push({ day: null, tokens: 0, calls: 0 })
        continue
      }
      const key = dayKey(date)
      const day = byDay.get(key)
      const tokens = day === undefined ? 0 : day.inputTokens + day.outputTokens
      const calls = day === undefined ? 0 : day.calls
      weekTokens += tokens
      weekCalls += calls
      cells.push({ day: key, tokens, calls })
    }
    if (mode === 'weekly' && weekTokens > 0) {
      for (const cell of cells) {
        if (cell.day !== null) {
          cell.tokens = weekTokens
          cell.calls = weekCalls
        }
      }
    }
    weeks.push(cells)
  }
  return { weeks, labels }
}

/** Heat intensity level 0-4 from a token count against the grid maximum. */
function heatLevel(tokens: number, max: number): number {
  if (tokens <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((tokens / max) * 4)))
}

/** Cell fill: the brand accent mixed toward the surface per intensity level. */
function cellFill(level: number): string {
  if (level === 0) return 'var(--dsw-alias-interactive-bg-hover)'
  const weight = [30, 55, 80, 100][level - 1]
  return 'color-mix(in srgb, var(--dsw-alias-brand-primary) ' + weight + '%, var(--dsw-alias-bg-layer-2))'
}

/** The GitHub-style activity grid (daily or weekly coloring). */
function HeatmapGrid(props: { daily: readonly UsageDay[]; mode: Exclude<HeatmapMode, 'cumulative'>; t: (key: UsageLocaleKey) => string }) {
  const { weeks, labels } = useMemo(() => buildWeeks(props.daily, props.mode), [props.daily, props.mode])
  const max = useMemo(() => {
    let peak = 0
    for (const week of weeks) {
      for (const cell of week) peak = Math.max(peak, cell.tokens)
    }
    return peak
  }, [weeks])
  return (
    <div className={css.gridWrap}>
      <div className={css.gridLabels}>
        {labels.map(label => (
          <span key={label.index} className={css.gridLabel} style={{ gridColumnStart: label.index + 1 }}>{label.label}</span>
        ))}
      </div>
      <div className={css.grid}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={css.gridWeek}>
            {week.map((cell: HeatCell, dayIndex: number) => {
              const level = cell.day === null ? 0 : heatLevel(cell.tokens, max)
              const title = cell.day === null
                ? undefined
                : props.t('cellTooltip')
                  .replace('{{day}}', cell.day)
                  .replace('{{tokens}}', String(cell.tokens))
                  .replace('{{calls}}', String(cell.calls))
              return (
                <div
                  key={dayIndex}
                  className={css.gridCell}
                  style={cell.day === null ? undefined : { background: cellFill(level) }}
                  title={title}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Cumulative tokens over the recent history, as a minimal SVG area. */
function CumulativeChart(props: { daily: readonly UsageDay[]; t: (key: UsageLocaleKey) => string }) {
  const width = 560
  const height = 110
  const pad = 6
  const { points, total, firstDay, lastDay } = useMemo(() => {
    const windowDays = props.daily.slice(-180)
    let running = 0
    const cumulative = windowDays.map((day) => {
      running += day.inputTokens + day.outputTokens
      return { day: day.day, total: running }
    })
    // The parent renders this chart only for a non-empty daily list.
    const lastEntry = cumulative[cumulative.length - 1] as { day: string; total: number }
    const firstEntry = cumulative[0] as { day: string; total: number }
    const max = lastEntry.total
    const step = (width - pad * 2) / Math.max(1, cumulative.length - 1)
    const toPoint = (entry: { day: string; total: number }, index: number): string => {
      const x = pad + index * step
      const y = height - pad - (max === 0 ? 0 : (entry.total / max) * (height - pad * 2))
      return x.toFixed(1) + ',' + y.toFixed(1)
    }
    const line = cumulative.map(toPoint).join(' ')
    const area = pad + ',' + (height - pad) + ' ' + line + ' ' + (width - pad) + ',' + (height - pad)
    return {
      points: area,
      total: max,
      firstDay: firstEntry.day,
      lastDay: lastEntry.day,
    }
  }, [props.daily])
  if (total === 0) {
    return <div className={css.heatEmpty}>{props.t('heatmapEmpty')}</div>
  }
  return (
    <div className={css.cumulativeWrap}>
      <svg viewBox={'0 0 ' + width + ' ' + height} className={css.cumulativeSvg} role="img">
        <polygon points={points} className={css.cumulativeArea} />
        <polyline points={points} fill="none" className={css.cumulativeLine} />
      </svg>
      <div className={css.cumulativeAxis}>
        <span>{firstDay}</span>
        <span>{props.t('heatmapLegendMore')}</span>
        <span>{lastDay}</span>
      </div>
    </div>
  )
}

/** Emoji glyph per tool kind (presentation only; unknown names fall back). */
function toolEmoji(name: string): string {
  if (name === 'skill') return '🧠'
  if (name === 'read' || name.startsWith('read_')) return '📄'
  if (name === 'bash' || name.startsWith('bash_')) return '🖥️'
  if (name === 'edit' || name.startsWith('edit_')) return '✏️'
  if (name === 'write' || name.startsWith('write_')) return '📝'
  if (name === 'glob' || name === 'grep' || name.startsWith('glob') || name.startsWith('grep')) return '🔍'
  if (name.startsWith('web_') || name === 'web_search') return '🌐'
  if (name.startsWith('job_')) return '⏱️'
  if (name.startsWith('subagent')) return '🤖'
  if (name === 'run_code' || name.startsWith('run_code')) return '⚙️'
  if (name.startsWith('$')) return '🧩'
  return '🔧'
}

/** One insight row: label with an optional secondary value line. */
function InsightRow(props: { label: string; value: string; sub?: string }) {
  return (
    <div className={css.insightRow}>
      <span className={css.insightLabel}>{props.label}</span>
      <span className={css.insightValue}>{props.value}</span>
      {props.sub !== undefined && <span className={css.insightSub}>{props.sub}</span>}
    </div>
  )
}

/** The most-used tools column body. */
function ToolList(props: { tools: readonly CountEntry[]; t: (key: UsageLocaleKey) => string }) {
  const firstTool = props.tools[0]
  if (firstTool === undefined) return <div className={css.insightEmpty}>{props.t('empty')}</div>
  const max = firstTool.count
  return (
    <ul className={css.toolList}>
      {props.tools.map(tool => (
        <li key={tool.name} className={css.toolRow}>
          <span className={css.toolGlyph}>{toolEmoji(tool.name)}</span>
          <span className={css.toolName}>{tool.name}</span>
          <span className={css.toolBar}><i style={{ width: Math.max(4, Math.round((tool.count / max) * 100)) + '%' }} /></span>
          <span className={css.toolCount}>{tool.count} {props.t('runsSuffix')}</span>
        </li>
      ))}
    </ul>
  )
}

/** Effort display name: the opaque adapter id, localized when it is the default. */
function effortName(id: string, t: (key: UsageLocaleKey) => string): string {
  if (id !== 'default') return id
  return t('defaultEffort')
}

/** The ready dashboard body. */
function Dashboard(props: { overview: UsageOverview; t: (key: UsageLocaleKey) => string }) {
  const { overview, t } = props
  const [mode, setMode] = useState<HeatmapMode>('daily')
  const totalTokens = overview.inputTokens + overview.outputTokens
  const effortTotal = overview.efforts.reduce((sum, entry) => sum + entry.count, 0)
  const topEffort = overview.efforts[0]
  const topModel = overview.models[0]
  return (
    <div className={css.dashboard}>
      <div className={css.statRow}>
        <StatCard
          label={t('cumulativeTokens')}
          value={formatTokens(totalTokens, t)}
          sub={formatTokens(overview.inputTokens, t) + '/' + formatTokens(overview.outputTokens, t)}
        />
        <StatCard
          label={t('peakTokens')}
          value={overview.peakDay === null ? '0' : formatTokens(overview.peakDay.inputTokens + overview.peakDay.outputTokens, t)}
          {...(overview.peakDay === null ? {} : { sub: overview.peakDay.day })}
        />
        <StatCard
          label={t('longestChat')}
          value={overview.longestChatMs === 0 ? '—' : formatDuration(overview.longestChatMs, t)}
        />
        <StatCard label={t('currentStreak')} value={String(overview.currentStreak) + ' ' + t('dayShort')} />
        <StatCard label={t('longestStreak')} value={String(overview.longestStreak) + ' ' + t('dayShort')} />
      </div>

      <section className={css.card}>
        <div className={css.cardHeader}>
          <h3 className={css.cardTitle}>{t('heatmapTitle')}</h3>
          <div className={css.segmented} role="tablist" aria-label={t('heatmapTitle')}>
            {(['daily', 'weekly', 'cumulative'] as const).map(value => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={mode === value ? css.segmentActive : undefined}
                onClick={() => { setMode(value) }}
              >
                {t(value === 'daily' ? 'heatmapDaily' : value === 'weekly' ? 'heatmapWeekly' : 'heatmapCumulative')}
              </button>
            ))}
          </div>
        </div>
        {overview.daily.length === 0
          ? <div className={css.heatEmpty}>{t('heatmapEmpty')}</div>
          : mode === 'cumulative'
            ? <CumulativeChart daily={overview.daily} t={t} />
            : <HeatmapGrid daily={overview.daily} mode={mode} t={t} />}
        {overview.daily.length > 0 && mode !== 'cumulative' && (
          <div className={css.legend}>
            <span>{t('heatmapLegendLess')}</span>
            {[0, 1, 2, 3, 4].map(level => (
              <i key={level} className={css.legendCell} style={{ background: cellFill(level) }} />
            ))}
            <span>{t('heatmapLegendMore')}</span>
          </div>
        )}
      </section>

      <div className={css.columns}>
        <section className={css.card}>
          <h3 className={css.cardTitle}>{t('insightsTitle')}</h3>
          <div className={css.insights}>
            <InsightRow label={t('sessions')} value={String(overview.sessions)} />
            <InsightRow label={t('toolCalls')} value={String(overview.toolCalls)} />
            <InsightRow
              label={t('toolsUsed')}
              value={String(overview.toolsUsed)}
              {...(overview.tools[0] === undefined ? {} : { sub: overview.tools[0].name })}
            />
            <InsightRow
              label={t('skillsUsed')}
              value={String(overview.skillsUsed)}
              {...(overview.skillCalls === 0 ? {} : { sub: overview.skillCalls + ' ' + t('callsSuffix') })}
            />
            <InsightRow
              label={t('topEffort')}
              value={topEffort === undefined ? '—' : effortName(topEffort.name, t)}
              {...(topEffort === undefined || effortTotal === 0 ? {} : { sub: Math.round((topEffort.count / effortTotal) * 100) + '%' })}
            />
            <InsightRow
              label={t('topModel')}
              value={topModel === undefined ? '—' : topModel.name}
              {...(topModel === undefined ? {} : { sub: String(topModel.count) + ' ' + t('callsSuffix') })}
            />
          </div>
        </section>
        <section className={css.card}>
          <h3 className={css.cardTitle}>{t('toolsTitle')}</h3>
          <ToolList tools={overview.tools} t={t} />
        </section>
      </div>
    </div>
  )
}

/**
 * The Usage settings section: loads the session list on mount, refreshes
 * on a light interval while mounted (and on connection resets via apply),
 * and renders the fold result or the loading/error states.
 */
export function UsageSection(props: UsageSectionProps): ReactNode {
  const { load, useUsage, t } = props
  const state = useUsage(snapshot => snapshot)
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, REFRESH_MS)
    return () => { window.clearInterval(timer) }
  }, [load])
  let content: ReactNode
  if (state.status === 'idle' || state.status === 'loading') {
    content = <div className={css.pending}>{t('loading')}</div>
  } else if (state.status === 'error') {
    content = (
      <div className={css.pending}>
        <span>{t('error')}</span>
        <button type="button" className={css.retry} onClick={() => { void load() }}>{t('retry')}</button>
      </div>
    )
  } else {
    const overview = state.overview ?? EMPTY_OVERVIEW
    content = overview.sessions === 0 && overview.daily.length === 0
      ? <div className={css.pending}>{t('empty')}</div>
      : <Dashboard overview={overview} t={t} />
  }
  return (
    <div className={css.section}>
      <header className={css.sectionHeader}>
        <h2 className={css.sectionTitle}>{t('title')}</h2>
        <p className={css.sectionSubtitle}>{t('subtitle')}</p>
      </header>
      {content}
    </div>
  )
}
