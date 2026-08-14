/**
 * Pure types of the session-stats domain: the ONE home of the `sessionStats`
 * and `usageStats` projection-key declarations, free of this package's
 * host-side value imports (cordis context, zod, the llm chunk predicate).
 * Two namespace projections serve it — `./types` for host consumers, `./client`
 * for client aggregates — with zero content duplication.
 *
 * @module @deepseek-ai/dsh-session-stats/types
 */

// Marks this file a module so the declaration below AUGMENTS the projection
// table instead of declaring an ambient module.
export {}

/**
 * Whole-log conversation figures, independent of how much history a client
 * has paged in. Counts and wall times all fold from the complete durable log;
 * every field is 0 until its first contributing event lands. Field names
 * mirror the client window fold so an assembly without this unit can fall
 * back to it wholesale.
 */
export interface SessionStatsProjection {
  /** Distinct turns carrying at least one closed step (`step/end`); rejected or empty turns are uncounted. */
  turns: number
  /** Closed steps (`step/end` events) — completed, failed, and cancelled steps alike. */
  steps: number
  /** Summed model wall time (`step/start` → `assistant/message`) over steps that assembled a message. */
  llmMs: number
  /** Summed tool wall time over `tool/call` → `tool/result` pairs matched by callId. */
  toolMs: number
  /** Summed first-token latency (`step/start` → first non-empty delta chunk) over `ttftSteps`. */
  ttftMs: number
  /** Steps carrying a recorded first token. */
  ttftSteps: number
  /** Summed decode wall time (first token → `assistant/message`) over steps that also report output tokens. */
  decodeMs: number
  /** Summed provider output tokens over the same decode-timed steps. */
  decodeTokens: number
}

/**
 * One local-day activity bucket of the usageStats projection. Day keys are
 * host-local 'YYYY-MM-DD' strings; only days with activity have a bucket.
 */
export interface UsageDayBucket {
  /** Provider input tokens reported that day (uncached + cache-read + cache-write). */
  inputTokens: number
  /** Provider output tokens reported that day. */
  outputTokens: number
  /** Tool calls dispatched that day. */
  toolCalls: number
}

/**
 * Whole-log usage dashboard facts: per-day activity buckets, tool/skill call
 * counts, and the request profile. This is the projection-key home of the
 * Web usage dashboard (a Codex-style token-usage and tool-call overview):
 * every field folds from the complete durable log, so paging and compaction
 * cannot change it, and every field holds its neutral value until its first
 * contributing event lands.
 */
export interface UsageStatsProjection {
  /** Unix ms of the earliest usage/tool-call/request activity; null for an empty log. */
  firstAt: number | null
  /** Unix ms of the latest usage/tool-call/request activity. */
  lastAt: number | null
  /** Per-host-local-day buckets; keys are 'YYYY-MM-DD'; only days with activity. */
  days: Record<string, UsageDayBucket>
  /** Tool call counts by tool name over the whole log. */
  tools: Record<string, number>
  /** Skill call counts by skill name (from the `skill` tool's parsed arguments). */
  skills: Record<string, number>
  /** Entered-step counts by the active reasoning-effort id ('default' when unset). */
  efforts: Record<string, number>
  /** Entered-step counts by the active model id. */
  models: Record<string, number>
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Whole-log turn/step counts and wall times; see {@link SessionStatsProjection}. */
    sessionStats: SessionStatsProjection
    /** Whole-log usage dashboard facts; see {@link UsageStatsProjection}. */
    usageStats: UsageStatsProjection
  }
}
