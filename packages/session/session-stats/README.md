# @deepseek-ai/dsh-session-stats

English | [中文](README.zh.md)

Function plugin registering two whole-log projection units. `sessionStats` carries turn/step counts and the LLM, tool, first-token, and decode wall times for the Web chat stats strip. `usageStats` carries daily tokens, tool and skill counts, and the model/reasoning profile for the Web Usage page. Both values ride the session-projection registry snapshot, change feed, history tail page, `session/projection` push frames, and session list rows, so paging and compaction cannot change their totals.

## Fold semantics

- `steps` counts `step/end` events. The agent loop appends exactly one per entered step, in a `finally`, so completed, failed, cancelled, and max-tokens steps all count. Counting assembled assistant messages instead would overcount max-tokens usage-host messages (empty content, excluded from the surface) and undercount cancelled steps (aborted before the message assembles).
- `turns` counts distinct turns carrying at least one closed step; rejected or empty turns (closed with no step) are uncounted. Turn numbers are host-assigned and monotonic per session, so the fold keeps only the last counted turn.
- `llmMs` sums `step/start` → `assistant/message` per step that assembled a message (retry waits inside the step are model time, as in the window fold).
- `ttftMs`/`ttftSteps` sum and count `step/start` → first non-empty delta chunk; the first attempt's boundary survives an in-step `llm/retry` (window `resetForRetry` parity).
- `decodeMs`/`decodeTokens` sum first token → assembled message and the provider-reported output tokens, only over steps carrying both.
- `toolMs` sums `tool/call` → `tool/result` pairs matched by callId; unresolved calls are dropped at `turn/end` (results land within their turn).
- Every field is 0 until its first contributing event. A composed registry always serves the key, so clients read the value, never key presence.

## Usage fold semantics

- Provider usage from `assistant/chunk` or `assistant/message` is grouped by Host-local calendar day. A later report for the same `(turn, step)` replaces the earlier report, including across midnight; billed input is uncached input plus cache reads and writes.
- `tool/call` increments the day bucket and the logged tool name. A `skill` call additionally increments the non-empty string `name` parsed from its arguments; malformed or differently shaped arguments affect only the tool count.
- `request/header` updates the active model and reasoning effort. Every following `step/start` increments that profile, so repeated requests with an unchanged header still count; a header that never enters a step does not.
- `firstAt` and `lastAt` span contributing usage samples, tool calls, and entered steps. Empty logs expose null bounds and empty count records.

## Composition

```yaml
- id: session-stats
  name: '@deepseek-ai/dsh-session-stats'
```

Injects `sessionProjections` — the plugin's whole purpose; in assemblies without the registry the fiber stays pending and nothing registers.

## Model Experience

None, as the plugin only computes client-facing read models of already-logged session events and changes no prompt, message, stream, or tool result.

#### KV Cache effect

None; the plugin never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Steps count work attempted, not visible output** — a step that failed before producing any visible content still closed with `step/end` and counts; a step interrupted by a crash counts after the session reloads, when crash recovery appends its synthetic `step/end` (`interruptedTurnClosers` in dsh-session).
- **A cancelled step is counted but untimed** — no assistant message assembles, so its partial stream time enters no wall-time figure, matching the window fold's untimed interrupted node; a max-tokens usage-host message conversely contributes model time the surface does not show.
- **Counts are log-scoped, not surface-scoped** — steps whose messages were later compacted away stay counted; the figures describe the whole session, not the current model-visible surface.
- **Host-local usage days** — replay uses the Host timezone; moving logs between timezones can rebucket events around midnight without changing totals.
- **Mounted only in the web-app bundle** — other assemblies serve neither key; the Web stats strip falls back to window-scoped counting when `sessionStats` is absent.
