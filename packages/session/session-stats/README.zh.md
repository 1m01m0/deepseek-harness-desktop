# @deepseek-ai/dsh-session-stats

[English](README.md) | 中文

注册两个全日志 projection 单元的函数插件。`sessionStats` 为 Web 聊天统计条提供轮/步计数以及 LLM、工具、首 token、解码墙钟时间；`usageStats` 为 Web 用量统计页面提供每日 token、工具与技能计数，以及模型/推理配置。两个值都经过 session-projection registry 快照、变更流、history 尾页、`session/projection` 推送帧和会话列表行交付，因此分页与压缩不会改变其总量。

## 折叠语义

- `steps` 统计 `step/end` 事件。agent loop 对每个进入的步在 `finally` 中恰好追加一条，因此完成、失败、取消、max-tokens 的步全部计入。若改按已组装的 assistant 消息计数，则会多算 max-tokens 的 usage 宿主消息（空内容、被排除在 surface 之外），并少算被取消的步（在消息组装前已中止）。
- `turns` 统计含至少一个已关闭步的不同 turn；被拒绝或空轮（未进入任何步即关闭）不计。turn 号由宿主分配、按会话单调递增，因此折叠只需保留最近计入的 turn。
- `llmMs` 按步累加 `step/start` → `assistant/message`（组装出消息的步；步内重试的等待与窗口折叠一样计入模型时间）。
- `ttftMs`/`ttftSteps` 累加并统计 `step/start` → 首个非空 delta chunk；首次尝试的边界在步内 `llm/retry` 后保留（与窗口 `resetForRetry` 对齐）。
- `decodeMs`/`decodeTokens` 累加首 token → 已组装消息的时长与提供方上报的输出 token，仅统计两者兼备的步。
- `toolMs` 按 callId 配对累加 `tool/call` → `tool/result`；未解决的调用在 `turn/end` 时丢弃（结果总在其轮内落地）。
- 每个字段在首个贡献事件之前均为 0。已装配的 registry 恒提供该键，客户端读取值本身，而非键的存在性。

## 用量折叠语义

- 来自 `assistant/chunk` 或 `assistant/message` 的提供方用量按 Host 本地日历日分组。同一 `(turn, step)` 的后续报告会替换先前报告，包括跨午夜的情况；计费输入等于未缓存输入加缓存读取与写入。
- `tool/call` 会增加当日分桶与日志工具名计数。`skill` 调用还会增加从参数中解析出的非空字符串 `name`；参数格式错误或形状不同只影响工具计数。
- `request/header` 更新当前模型与推理强度。其后的每条 `step/start` 都增加该配置的计数，因此请求头不变的连续请求仍会计入；从未进入步骤的请求头不计。
- `firstAt` 与 `lastAt` 覆盖有贡献的用量样本、工具调用和已进入步骤。空日志提供 null 边界与空计数记录。

## 组合

```yaml
- id: session-stats
  name: '@deepseek-ai/dsh-session-stats'
```

注入 `sessionProjections`——这是插件的全部用途；在没有 registry 的装配中 fiber 保持挂起，不注册任何内容。

## 模型体验

无，因为插件只计算面向客户端的、由已写入日志的会话事件派生的读模型，不改变任何提示词、消息、流或工具结果。

#### KV Cache 影响

无；插件从不组装或发送提供方请求。

## 已知局限与延后工作

- **步数统计的是已发生的工作，而非可见输出**——在产生任何可见内容前就失败的步仍以 `step/end` 关闭并计入；被崩溃打断的步在会话重新加载后计入，届时崩溃恢复为其补写合成的 `step/end`（dsh-session 的 `interruptedTurnClosers`）。
- **被取消的步计数但不计时**——没有组装出 assistant 消息，其部分流式时间不进入任何墙钟数字，与窗口折叠的无计时 interrupted 节点一致；反之 max-tokens 的 usage 宿主消息贡献 surface 上看不到的模型时间。
- **计数是日志口径，不是 surface 口径**——消息后来被压缩掉的步仍然计入；数字描述整个会话，而非当前模型可见 surface。
- **Host 本地用量日期**——回放使用 Host 时区；在不同时区间移动日志可能重新分配午夜附近事件的日期，但不会改变总量。
- **仅挂载于 web-app bundle**——其他装配不提供这两个键；`sessionStats` 缺失时 Web 统计条回退到窗口口径计数。
