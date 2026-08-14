/**
 * The `sessionStats` projection unit: a pure fold of step boundaries, stream
 * chunks, tool pairs, and assembled assistant messages into whole-log counts
 * and wall times.
 *
 * `step/end` — not `assistant/message` — is the counted step event because it
 * is the step lifecycle authority: the loop appends exactly one per entered
 * step, in a `finally`, so completed, failed, cancelled, and max-tokens steps
 * all land one. Counting assembled assistant messages instead would overcount
 * max-tokens usage-host messages (empty content, excluded from the surface)
 * and undercount cancelled steps (aborted before the message assembles).
 *
 * The wall-time folds mirror the client window fold field by field
 * (`deriveStats` in dsh-client-ui-conversation, that fold's whole-window
 * fallback role): model time is `step/start` → `assistant/message`, first
 * token is the first non-empty delta chunk and survives an in-step
 * `llm/retry`, decode spans first token → assembled message on steps that
 * also report output tokens, and tool time pairs `tool/call` → `tool/result`
 * by callId. A cancelled step assembles no message, so its partial stream
 * time stays uncounted in every time figure — matching the window, which
 * renders it as an untimed interrupted node.
 *
 * @module @deepseek-ai/dsh-session-stats/projection
 */

import { z } from 'zod'
import { isTokenDelta } from '@deepseek-ai/dsh-llm/message'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { UsageDayBucket, UsageStatsProjection } from './types.ts'

/** Accumulated whole-log figures (the view is exactly these totals). */
interface SessionStatsTotals {
  /** Distinct turns with at least one closed step so far. */
  turns: number
  /** Closed steps so far. */
  steps: number
  /** Summed model wall time over message-assembling steps, ms. */
  llmMs: number
  /** Summed matched tool call→result wall time, ms. */
  toolMs: number
  /** Summed first-token latency over `ttftSteps`, ms. */
  ttftMs: number
  /** Steps carrying a recorded first token. */
  ttftSteps: number
  /** Summed decode wall time over usage-reporting steps, ms. */
  decodeMs: number
  /** Summed provider output tokens over the same steps. */
  decodeTokens: number
}

/**
 * Fold state: the totals plus the in-flight boundaries they accrue from.
 * Turn numbers are host-assigned and monotonic per session, so a single
 * `lastTurn` slot decides "first closed step of a new turn"; the state is
 * plain JSON per the unit contract (persisted-cache precondition).
 */
interface SessionStatsState extends SessionStatsTotals {
  /** Turn of the last counted `step/end`; null before the first. */
  lastTurn: number | null
  /** The open step's boundary facts; null outside a step or after its message assembled. */
  openStep: { turn: number; step: number; startTime: number; firstTokenTime: number | null } | null
  /** Dispatch times of tool calls whose result has not landed, by callId. */
  pendingCalls: Record<string, number>
}

const sessionStatsSchema = z.object({
  turns: z.number().int().nonnegative(),
  steps: z.number().int().nonnegative(),
  llmMs: z.number().nonnegative(),
  toolMs: z.number().nonnegative(),
  ttftMs: z.number().nonnegative(),
  ttftSteps: z.number().int().nonnegative(),
  decodeMs: z.number().nonnegative(),
  decodeTokens: z.number().nonnegative(),
}).strict()

/**
 * Provider-reported completion tokens, guarded the way the window fold guards
 * node usage.
 * @param usage - the assistant/message event's optional usage record.
 * @returns the output-token count, or null when unreported or invalid.
 */
function usageOutputTokens(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null) return null
  const value = (usage as { outputTokens?: unknown }).outputTokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** The `sessionStats` unit registered on `ctx.sessionProjections` (exported for the unit spec). */
export const sessionStatsProjectionDefinition: ProjectionDefinition<'sessionStats', SessionStatsState> = {
  key: 'sessionStats',
  schema: sessionStatsSchema,
  init: () => ({
    turns: 0,
    steps: 0,
    llmMs: 0,
    toolMs: 0,
    ttftMs: 0,
    ttftSteps: 0,
    decodeMs: 0,
    decodeTokens: 0,
    lastTurn: null,
    openStep: null,
    pendingCalls: {},
  }),
  apply: (state, event) => {
    // Every uninteresting event returns the same reference (Object.is gates the change feed).
    switch (event.type) {
      case 'step/start':
        return {
          ...state,
          openStep: { turn: event.data.turn, step: event.data.step, startTime: event.time, firstTokenTime: null },
        }
      case 'assistant/chunk': {
        const open = state.openStep
        if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
        if (open.firstTokenTime !== null || !isTokenDelta(event.data.chunk)) return state
        return { ...state, openStep: { ...open, firstTokenTime: event.time } }
      }
      case 'assistant/message': {
        const open = state.openStep
        if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
        // One assembled message per step: closing the boundary means a
        // defensive duplicate cannot accrue twice.
        const next: SessionStatsState = {
          ...state,
          llmMs: state.llmMs + Math.max(0, event.time - open.startTime),
          openStep: null,
        }
        if (open.firstTokenTime !== null) {
          next.ttftMs += Math.max(0, open.firstTokenTime - open.startTime)
          next.ttftSteps += 1
          const outputTokens = usageOutputTokens(event.data.usage)
          if (outputTokens !== null) {
            next.decodeMs += Math.max(0, event.time - open.firstTokenTime)
            next.decodeTokens += outputTokens
          }
        }
        return next
      }
      case 'tool/call':
        return { ...state, pendingCalls: { ...state.pendingCalls, [event.data.callId]: event.time } }
      case 'tool/result': {
        // Own-key check: callId is provider-minted (model/tool JSON boundary),
        // so a prototype property name ('constructor', 'toString') on a result
        // with no recorded call must read as unmatched, not as an inherited
        // function that would poison toolMs with NaN.
        const callId = event.data.message.source.callId
        const dispatched = Object.hasOwn(state.pendingCalls, callId) ? state.pendingCalls[callId] : undefined
        if (dispatched === undefined) return state
        const pendingCalls = Object.fromEntries(
          Object.entries(state.pendingCalls).filter(([id]) => id !== callId),
        )
        return { ...state, toolMs: state.toolMs + Math.max(0, event.time - dispatched), pendingCalls }
      }
      case 'step/end':
        return {
          ...state,
          turns: state.lastTurn === event.data.turn ? state.turns : state.turns + 1,
          steps: state.steps + 1,
          lastTurn: event.data.turn,
          openStep: null,
        }
      case 'turn/end':
        // A call whose result never landed belongs to a cancelled or failed
        // turn; results always land within their turn, so drop the leftovers
        // instead of growing persisted state forever.
        return Object.keys(state.pendingCalls).length === 0 ? state : { ...state, pendingCalls: {} }
      default:
        return state
    }
  },
  view: state => ({
    turns: state.turns,
    steps: state.steps,
    llmMs: state.llmMs,
    toolMs: state.toolMs,
    ttftMs: state.ttftMs,
    ttftSteps: state.ttftSteps,
    decodeMs: state.decodeMs,
    decodeTokens: state.decodeTokens,
  }),
  stateVersion: 1,
}
/**
 * One usage sample's bucketing identity: its step and the day its tokens
 * currently sit in. The `lastUsage` slot relies on the same session-log
 * invariant the token-meter's replace accounting uses — usage reports for one
 * turn/step are adjacent, and once a later step begins a legal log never
 * reports usage for an earlier step again.
 */
interface UsageSample {
  turn: number
  step: number
  day: string
  inputTokens: number
  outputTokens: number
}

/** Accumulated whole-log usage dashboard facts (the view is exactly these). */
interface UsageStatsState {
  /** Unix ms of the earliest activity; null before the first. */
  firstAt: number | null
  /** Unix ms of the latest activity. */
  lastAt: number | null
  /** Per-host-local-day buckets; only days with activity. */
  days: Record<string, UsageDayBucket>
  /** Tool call counts by tool name. */
  tools: Record<string, number>
  /** Skill call counts by skill name. */
  skills: Record<string, number>
  /** Request counts by reasoning-effort id. */
  efforts: Record<string, number>
  /** Request counts by model id. */
  models: Record<string, number>
  /** Latest usage sample, for per-step replace accounting. */
  lastUsage: UsageSample | null
  /** Request profile inherited by each entered step from the newest header. */
  requestProfile: { model: string; effort: string } | null
}

const usageDayBucketSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
}).strict()

const usageStatsSchema = z.object({
  firstAt: z.number().nullable(),
  lastAt: z.number().nullable(),
  days: z.record(z.string(), usageDayBucketSchema),
  tools: z.record(z.string(), z.number().int().positive()),
  skills: z.record(z.string(), z.number().int().positive()),
  efforts: z.record(z.string(), z.number().int().positive()),
  models: z.record(z.string(), z.number().int().positive()),
}).strict() as unknown as z.ZodType<UsageStatsProjection>

const EMPTY_DAY: UsageDayBucket = { inputTokens: 0, outputTokens: 0, toolCalls: 0 }

/** Host-local calendar day key of one event time. */
function usageDayKey(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return date.getFullYear() + '-' + month + '-' + day
}

/**
 * The token accounting a chunk or finalized message reports for its step, if
 * any. Input is the full prompt-side total (uncached + cache traffic),
 * matching the StatsLine billed-input fold.
 */
function usageSampleOf(event: SessionEvent): Omit<UsageSample, 'day'> | undefined {
  if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
    const usage = event.data.chunk.usage
    return {
      turn: event.data.turn,
      step: event.data.step,
      inputTokens: usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0),
      outputTokens: usage.outputTokens,
    }
  }
  if (event.type === 'assistant/message' && event.data.usage !== undefined) {
    const usage = event.data.usage
    return {
      turn: event.data.turn,
      step: event.data.step,
      inputTokens: usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0),
      outputTokens: usage.outputTokens,
    }
  }
  return undefined
}

/** The skill name a `skill` tool call carries in its raw arguments JSON, if any. */
function skillNameOf(rawArguments: string): string | undefined {
  try {
    const parsed = JSON.parse(rawArguments) as { name?: unknown }
    return typeof parsed.name === 'string' && parsed.name.length > 0 ? parsed.name : undefined
  } catch {
    return undefined
  }
}

/** Touch the activity window with one event time. */
function touchActivity(state: UsageStatsState, time: number): UsageStatsState {
  const firstAt = state.firstAt === null ? time : Math.min(state.firstAt, time)
  const lastAt = state.lastAt === null ? time : Math.max(state.lastAt, time)
  return firstAt === state.firstAt && lastAt === state.lastAt ? state : { ...state, firstAt, lastAt }
}

/**
 * The `usageStats` projection unit: whole-log usage dashboard facts — daily
 * token/tool-call buckets, per-tool and per-skill counts, and the request
 * profile (reasoning effort, model). Token accounting replaces a step's
 * earlier sample instead of double counting it (mirroring the token-meter's
 * totals fold); every other counter is monotonic.
 */
export const usageStatsProjectionDefinition: ProjectionDefinition<'usageStats', UsageStatsState> = {
  key: 'usageStats',
  schema: usageStatsSchema,
  init: () => ({
    firstAt: null,
    lastAt: null,
    days: {},
    tools: {},
    skills: {},
    efforts: {},
    models: {},
    lastUsage: null,
    requestProfile: null,
  }),
  apply: (state, event) => {
    const sample = usageSampleOf(event)
    if (sample !== undefined) {
      const day = usageDayKey(event.time)
      let days = state.days
      const previous = state.lastUsage
      if (previous !== null && previous.turn === sample.turn && previous.step === sample.step) {
        // Same step re-report: replace the earlier contribution in its day.
        const back = days[previous.day] ?? EMPTY_DAY
        const previousDay = {
          inputTokens: Math.max(0, back.inputTokens - previous.inputTokens),
          outputTokens: Math.max(0, back.outputTokens - previous.outputTokens),
          toolCalls: back.toolCalls,
        }
        days = {
          ...days,
          [previous.day]: previousDay,
        }
        if (previous.day !== day
          && previousDay.inputTokens === 0
          && previousDay.outputTokens === 0
          && previousDay.toolCalls === 0) {
          const { [previous.day]: _removed, ...withoutEmptyPreviousDay } = days
          days = withoutEmptyPreviousDay
        }
      }
      const current = days[day] ?? EMPTY_DAY
      const daysNext = {
        ...days,
        [day]: {
          inputTokens: current.inputTokens + sample.inputTokens,
          outputTokens: current.outputTokens + sample.outputTokens,
          toolCalls: current.toolCalls,
        },
      }
      return touchActivity({
        ...state,
        days: daysNext,
        lastUsage: { ...sample, day },
      }, event.time)
    }
    if (event.type === 'tool/call') {
      const day = usageDayKey(event.time)
      const current = state.days[day] ?? EMPTY_DAY
      const tools = { ...state.tools, [event.data.name]: (state.tools[event.data.name] ?? 0) + 1 }
      let skills = state.skills
      if (event.data.name === 'skill') {
        const skillName = skillNameOf(event.data.arguments)
        if (skillName !== undefined) skills = { ...skills, [skillName]: (skills[skillName] ?? 0) + 1 }
      }
      return touchActivity({
        ...state,
        days: { ...state.days, [day]: { ...current, toolCalls: current.toolCalls + 1 } },
        tools,
        skills,
      }, event.time)
    }
    if (event.type === 'request/header') {
      const config = event.data.header.config
      const effort = config.reasoningEffort ?? 'default'
      if (state.requestProfile?.model === config.model && state.requestProfile.effort === effort) return state
      return { ...state, requestProfile: { model: config.model, effort } }
    }
    if (event.type === 'step/start' && state.requestProfile !== null) {
      const { effort, model } = state.requestProfile
      return touchActivity({
        ...state,
        efforts: { ...state.efforts, [effort]: (state.efforts[effort] ?? 0) + 1 },
        models: { ...state.models, [model]: (state.models[model] ?? 0) + 1 },
      }, event.time)
    }
    return state
  },
  view: ({ firstAt, lastAt, days, tools, skills, efforts, models }) => ({
    firstAt,
    lastAt,
    days,
    tools,
    skills,
    efforts,
    models,
  }),
  stateVersion: 1,
}
