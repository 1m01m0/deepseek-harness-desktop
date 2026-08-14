/**
 * Pure client-side aggregation of the whole usage dashboard from the session
 * list's per-session projection baselines (`usageStats` per row). Every figure
 * the dashboard shows is a deterministic fold over those rows, so this module
 * is the one place the numbers are decided — components only render.
 */

import type { SessionSummary } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: merges the `usageStats` key into SessionProjectionMap so
// `projections.values` carries its typed face.
import type {} from '@deepseek-ai/dsh-session-stats/client'
import type { UsageStatsProjection } from '@deepseek-ai/dsh-session-stats/client'

/** One sorted count entry (tool, skill, model, or reasoning effort). */
export interface CountEntry {
  name: string
  count: number
}

/** One local-day aggregate over every session. */
export interface UsageDay {
  /** Host-local 'YYYY-MM-DD'. */
  day: string
  /** Input tokens reported that day (uncached + cache traffic). */
  inputTokens: number
  /** Output tokens reported that day. */
  outputTokens: number
  /** Tool calls dispatched that day. */
  calls: number
}

/** The complete dashboard fold output. */
export interface UsageOverview {
  /** Sessions carrying any recorded activity. */
  sessions: number
  /** Summed input tokens over the whole log. */
  inputTokens: number
  /** Summed output tokens over the whole log. */
  outputTokens: number
  /** Summed tool calls over the whole log. */
  toolCalls: number
  /** Distinct tool names used. */
  toolsUsed: number
  /** Distinct skills invoked. */
  skillsUsed: number
  /** Summed skill calls. */
  skillCalls: number
  /** Tool call counts, descending (whole log). */
  tools: CountEntry[]
  /** Skill call counts, descending. */
  skills: CountEntry[]
  /** Request counts by reasoning-effort id, descending. */
  efforts: CountEntry[]
  /** Request counts by model id, descending. */
  models: CountEntry[]
  /** Per-day aggregates, ascending by day. */
  daily: UsageDay[]
  /** Earliest activity across sessions. */
  firstAt: number | null
  /** Latest activity across sessions. */
  lastAt: number | null
  /** The single day with the most tokens. */
  peakDay: UsageDay | null
  /** Longest single-chat span (max lastAt-firstAt over sessions), ms. */
  longestChatMs: number
  /** Consecutive activity days ending today or yesterday. */
  currentStreak: number
  /** Longest consecutive activity run, whole log. */
  longestStreak: number
}

/** Zero state: a fresh deployment with no recorded activity. */
export const EMPTY_OVERVIEW: UsageOverview = {
  sessions: 0,
  inputTokens: 0,
  outputTokens: 0,
  toolCalls: 0,
  toolsUsed: 0,
  skillsUsed: 0,
  skillCalls: 0,
  tools: [],
  skills: [],
  efforts: [],
  models: [],
  daily: [],
  firstAt: null,
  lastAt: null,
  peakDay: null,
  longestChatMs: 0,
  currentStreak: 0,
  longestStreak: 0,
}

/** The `usageStats` projection value of one list row, when the host served one. */
function rowUsage(row: SessionSummary): UsageStatsProjection | undefined {
  const values = row.projections?.values
  return values === undefined ? undefined : values.usageStats
}

/** UTC day index of a 'YYYY-MM-DD' key (timezone-free day arithmetic). */
function dayIndexOf(day: string): number {
  return Math.floor(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000)
}

/** Merge one counted record into an accumulator map. */
function mergeCounts(target: Map<string, number>, source: Record<string, number>): void {
  for (const [name, count] of Object.entries(source)) {
    target.set(name, (target.get(name) ?? 0) + count)
  }
}

/** Sorted descending entries from a counted map. */
function sortedEntries(counts: Map<string, number>): CountEntry[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Longest run of consecutive indices in an ascending index list. */
function longestRun(indices: readonly number[]): number {
  let best = 0
  let run = 0
  let previous = -Infinity
  for (const index of indices) {
    run = index === previous + 1 ? run + 1 : 1
    if (run > best) best = run
    previous = index
  }
  return best
}

/**
 * Fold the session-list rows (each carrying its `usageStats` projection
 * baseline) into the dashboard overview. Deterministic and side-effect free.
 * @param rows - wire `session.list` items.
 * @returns the complete overview; `EMPTY_OVERVIEW`-equivalent for a bare list.
 */
export function foldUsage(rows: readonly SessionSummary[]): UsageOverview {
  const days = new Map<string, UsageDay>()
  const tools = new Map<string, number>()
  const skills = new Map<string, number>()
  const efforts = new Map<string, number>()
  const models = new Map<string, number>()
  let sessions = 0
  let firstAt: number | null = null
  let lastAt: number | null = null
  let longestChatMs = 0
  for (const row of rows) {
    const usage = rowUsage(row)
    if (usage === undefined) continue
    const hasActivity = usage.firstAt !== null || Object.keys(usage.days).length > 0
    if (!hasActivity) continue
    sessions += 1
    if (usage.firstAt !== null && usage.lastAt !== null) {
      longestChatMs = Math.max(longestChatMs, Math.max(0, usage.lastAt - usage.firstAt))
      firstAt = firstAt === null ? usage.firstAt : Math.min(firstAt, usage.firstAt)
      lastAt = lastAt === null ? usage.lastAt : Math.max(lastAt, usage.lastAt)
    }
    for (const [day, bucket] of Object.entries(usage.days)) {
      const current = days.get(day)
      days.set(day, current === undefined
        ? { day, inputTokens: bucket.inputTokens, outputTokens: bucket.outputTokens, calls: bucket.toolCalls }
        : {
          day,
          inputTokens: current.inputTokens + bucket.inputTokens,
          outputTokens: current.outputTokens + bucket.outputTokens,
          calls: current.calls + bucket.toolCalls,
        })
    }
    mergeCounts(tools, usage.tools)
    mergeCounts(skills, usage.skills)
    mergeCounts(efforts, usage.efforts)
    mergeCounts(models, usage.models)
  }
  const daily = [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
  let inputTokens = 0
  let outputTokens = 0
  let toolCalls = 0
  for (const day of daily) {
    inputTokens += day.inputTokens
    outputTokens += day.outputTokens
    toolCalls += day.calls
  }
  const peakDay = daily.length === 0
    ? null
    : daily.reduce((a, b) => (b.inputTokens + b.outputTokens > a.inputTokens + a.outputTokens ? b : a))
  const activityDays = daily.map(day => dayIndexOf(day.day)).sort((a, b) => a - b)
  const today = dayIndexOf(new Date().toISOString().slice(0, 10))
  let currentStreak = 0
  const lastActivityDay = activityDays.length === 0 ? undefined : activityDays[activityDays.length - 1]
  if (lastActivityDay !== undefined && (lastActivityDay === today || lastActivityDay === today - 1)) {
    currentStreak = 1
    for (let i = activityDays.length - 2; i >= 0; i -= 1) {
      const next = activityDays[i + 1]
      if (next === undefined || activityDays[i] !== next - 1) break
      currentStreak += 1
    }
  }
  return {
    sessions,
    inputTokens,
    outputTokens,
    toolCalls,
    toolsUsed: tools.size,
    skillsUsed: skills.size,
    skillCalls: [...skills.values()].reduce((sum, count) => sum + count, 0),
    tools: sortedEntries(tools).slice(0, 12),
    skills: sortedEntries(skills).slice(0, 8),
    efforts: sortedEntries(efforts).slice(0, 5),
    models: sortedEntries(models).slice(0, 5),
    daily,
    firstAt,
    lastAt,
    peakDay,
    longestChatMs,
    currentStreak,
    longestStreak: longestRun(activityDays),
  }
}
