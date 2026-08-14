# @deepseek-ai/dsh-client-ui-usage

English | [中文](README.zh.md)

Read-only **Usage** page for Web Settings. The browser plugin lazily requests `session.list` when the page mounts, folds every row's `usageStats` projection into one overview, and refreshes once per minute while open. It renders total and peak tokens, the longest chat span, activity streaks, daily/weekly/cumulative activity, tool and skill counts, and the most-used model and reasoning effort. The registration uses `ctx.slots.inject('settings.section', ...)`, so it follows late declaration, redeclaration, locale changes, and teardown.

The Host-owned `usageStats` value is a whole-log projection from [`@deepseek-ai/dsh-session-stats`](../../session/session-stats/README.md). Provider usage samples replace earlier reports for the same step, input includes uncached plus cache-read and cache-write tokens, tool calls are grouped by logged tool name, and `skill` calls additionally parse their logged skill name. Model and reasoning-effort counts describe entered steps under the active request header. All aggregation stays on the local Host and browser; this package sends no usage, conversation, credential, or workspace data to another service.

## Model Experience

None, as this package only renders Host-projected usage in browser Settings and registers nothing model-facing.

#### KV Cache effect

None; the page reads existing session summaries and never assembles or sends a provider request.

## Known Limitations and Deferred Work

- **Checkpoint freshness for cold sessions** — a detached session row exposes the latest persisted projection checkpoint, which can lag its log tail until that session is attached and checkpointed again; `asOfSeq` preserves the staleness boundary.
- **Counts, not monetary cost** — the page does not infer prices from model names or estimate billing currency.
- **Host-local calendar days** — daily buckets use the Host timezone recorded during log replay; moving the same logs to a Host in another timezone can place events around midnight into different days.
