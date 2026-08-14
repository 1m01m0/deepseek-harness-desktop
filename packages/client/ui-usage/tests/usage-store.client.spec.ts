import { describe, expect, it, vi } from 'vitest'
import { UsageController, refreshIfLoaded } from '../src/client/usage-store.ts'

function successful(items: unknown[] = []) {
  return Promise.resolve({ result: { ok: true as const, value: { items } } })
}

describe('UsageController', () => {
  it('publishes loading and the folded successful response', async () => {
    const list = vi.fn().mockImplementation(() => successful([]))
    const controller = new UsageController({ sessions: { list } } as never)
    const task = controller.load()
    expect(controller.store.getSnapshot().status).toBe('loading')
    await task
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'ready', error: null })
    expect(controller.store.getSnapshot().overview?.sessions).toBe(0)
  })

  it('contains wire and transport failures', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ result: { ok: false, error: { message: 'wire failed' } } })
      .mockRejectedValueOnce(new Error('transport failed'))
      .mockRejectedValueOnce('plain failure')
    const controller = new UsageController({ sessions: { list } } as never)
    await controller.load()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'error', error: 'wire failed' })
    await controller.load()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'error', error: 'transport failed' })
    await controller.load()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'error', error: 'plain failure' })
  })

  it('lets the newest load win and suppresses an in-flight result after disposal', async () => {
    let finishFirst: ((value: unknown) => void) | undefined
    const first = new Promise((resolve) => { finishFirst = resolve })
    const list = vi.fn()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(() => successful([]))
      .mockImplementationOnce(() => successful([]))
    const controller = new UsageController({ sessions: { list } } as never)
    const stale = controller.load()
    await controller.load()
    finishFirst?.({ result: { ok: false, error: { message: 'stale' } } })
    await stale
    expect(controller.store.getSnapshot().status).toBe('ready')

    const inFlight = controller.load()
    controller.dispose()
    const afterDispose = controller.store.getSnapshot()
    await inFlight
    await controller.load()
    expect(controller.store.getSnapshot()).toEqual(afterDispose)
  })

  it('contains a rejection only when it still belongs to the newest load', async () => {
    let rejectFirst: ((reason: unknown) => void) | undefined
    const first = new Promise((_resolve, reject) => { rejectFirst = reject })
    const list = vi.fn()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(() => successful([]))
    const controller = new UsageController({ sessions: { list } } as never)
    const stale = controller.load()
    await controller.load()
    rejectFirst?.(new Error('stale rejection'))
    await stale
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'ready', error: null })
  })

  it('refreshes only a controller that already loaded', () => {
    const idle = new UsageController({ sessions: { list: vi.fn() } } as never)
    const idleLoad = vi.spyOn(idle, 'load')
    refreshIfLoaded(idle)
    expect(idleLoad).not.toHaveBeenCalled()

    idle.store.update((state) => { state.status = 'ready' })
    refreshIfLoaded(idle)
    expect(idleLoad).toHaveBeenCalledOnce()
  })
})
