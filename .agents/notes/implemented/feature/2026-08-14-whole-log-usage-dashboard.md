# Agent Note: Whole-log usage dashboard

Status: implemented

English | [中文](2026-08-14-whole-log-usage-dashboard.zh.md)

## Problem

The Web client already shows a compact current-session statistics line, but it has no local overview across sessions. Building that overview from rendered chat nodes would miss unloaded pages, compacted history, and detached sessions. A separate analytics database or telemetry pipeline would duplicate the append-only session log and create an unnecessary privacy boundary.

## Decision

`@deepseek-ai/dsh-session-stats` owns a whole-log `usageStats` projection. It folds provider usage by day, tool and skill calls, active request-header metadata, and step starts. Repeated provider reports for the same step replace the previous token sample. Model and reasoning-effort counts increment on `step/start`, because `request/header` is an epoch/change event rather than a per-request event.

Session-list rows carry the projection baseline already maintained by the Host. The Web-only `@deepseek-ai/dsh-client-ui-usage` plugin requests `session.list` only after its Settings section mounts, folds those per-session baselines in the browser, and refreshes once per minute while open. It joins the Settings surface through the declared slot and injects a `SnapshotStore` hook rather than importing Web renderer hooks into business code.

The complete path is local-only. It does not send usage, conversations, credentials, workspace paths, wallpaper state, or other Harness configuration to an external analytics service.

## Alternatives considered

- Folding loaded chat nodes was rejected because pagination, compaction, and detached sessions make the result incomplete.
- A standalone analytics database or telemetry service was rejected because the session log is already the source of truth and the extra store would add synchronization and privacy risk.
- A new global usage RPC was rejected because the session-list projection delivery already provides bounded, checkpointed summaries.
- Counting `request/header` events as requests was rejected because unchanged model/effort headers are not repeated for every step and would undercount activity.

## Consequences

- Session-list projection rows are slightly larger, but remain bounded summaries rather than raw event history.
- Cold-session checkpoints can lag the log tail until the session is attached and checkpointed; `asOfSeq` preserves that boundary.
- Daily buckets use the Host timezone during replay, so events near midnight may move when logs are replayed on a Host in another timezone.
- The dashboard reports token and call counts, not inferred monetary cost.
- The open Settings page performs one local refresh per minute and disposes its listener, timer, and store updates on teardown.
