import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { UsageSection } from '../src/client/UsageSection.tsx'
import type { UsageSectionInjected } from '../src/client/UsageSection.tsx'
import { apply, inject } from '../src/client/index.ts'
import { NS } from '../src/client/locales.ts'
import { apply as applyHost } from '../src/index.ts'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const list = vi.fn().mockResolvedValue({ result: { ok: true, value: { items: [] } } })
  ctx.provide('connection', { api: { sessions: { list } } } as never)
  return { ctx, locale, list, slots: ctx.slots }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-usage browser plugin', () => {
  it('declares only its runtime dependencies', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection'])
    expect(applyHost()).toBeUndefined()
  })

  it('registers lazily, follows locale, refreshes only after load, and disposes cleanly', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.section')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(1) })
    let entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(UsageSection)
    expect(entry.options).toMatchObject({ id: 'usage', order: 20 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('用量统计')
    const injected = (entry.inject as unknown as () => UsageSectionInjected)()
    expect(injected.hooks.usage.getSnapshot().status).toBe('idle')
    expect(b.list).not.toHaveBeenCalled()
    b.ctx.emit('connection/reset')
    expect(b.list).not.toHaveBeenCalled()
    await injected.load()
    expect(b.list).toHaveBeenCalledOnce()
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => { expect(b.list).toHaveBeenCalledTimes(2) })

    b.locale.setLocale('en')
    expect(resolveSlotLabel(entry.options.label)).toBe('Usage')
    stop()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(1) })
    entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(UsageSection)

    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    b.ctx.emit('connection/reset')
    expect(b.list).toHaveBeenCalledTimes(2)
    await b.ctx.fiber.dispose()
  })
})
