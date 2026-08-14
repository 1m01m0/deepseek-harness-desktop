/**
 * State owner for the Usage dashboard: pulls the session list and folds its
 * per-session `usageStats` projection baselines into the dashboard overview.
 * The controller owns the wire face only; the fold is pure (./usage-fold.ts).
 */

import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { foldUsage, type UsageOverview } from './usage-fold.ts'

/** Browser state of the Usage dashboard. */
export interface UsageState {
  /** Load phase; idle means never requested. */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** The folded overview; null until the first successful load. */
  overview: UsageOverview | null
  /** Last failure diagnostic; the UI exposes only localized copy. */
  error: string | null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Loads the session list and folds the dashboard overview.
 */
export class UsageController {
  /** uSES-safe state source shared by the registered section. */
  readonly store: SnapshotStore<UsageState> = createSnapshotStore({
    status: 'idle', overview: null, error: null,
  })

  private generation = 0
  private disposed = false

  /**
   * @param api - the connection's unified API face (sessions domain).
   */
  constructor(private readonly api: Pick<IApiClient, 'sessions'>) {}

  /**
   * Pull the session list and fold the overview.
   * @returns after the latest response updates the store.
   */
  async load(): Promise<void> {
    if (this.disposed) return
    const generation = ++this.generation
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const { result } = await this.api.sessions.list({})
      if (this.disposed || generation !== this.generation) return
      if (!result.ok) {
        this.store.update((state) => {
          state.status = 'error'
          state.error = result.error.message
        })
        return
      }
      this.store.update((state) => {
        state.status = 'ready'
        state.overview = foldUsage(result.value.items)
        state.error = null
      })
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'error'
        state.error = messageOf(error)
      })
    }
  }

  /** Stop future loads and suppress publication from the request already in flight. */
  dispose(): void {
    this.disposed = true
    this.generation += 1
  }
}

/**
 * Refresh the dashboard only after its first load: an unopened Usage page
 * must not fetch on background invalidations.
 * @param controller - the section's state owner.
 */
export function refreshIfLoaded(controller: UsageController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
