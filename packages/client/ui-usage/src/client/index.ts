/**
 * Usage dashboard settings plugin, browser half: registers the Usage section
 * (a Codex-style overview of token usage and tool calls) into the settings
 * nav. The section folds the session list's per-session `usageStats`
 * projection baselines entirely client-side; this plugin owns the wire
 * access, the copy dictionaries, and the registration. Export discipline:
 * packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the ctx.connection Context merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the settings slot declarations (settings.section) and the
// ctx.locale merge into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { UsageSection } from './UsageSection.tsx'
import type { UsageSectionInjected } from './UsageSection.tsx'
import { UsageController, refreshIfLoaded } from './usage-store.ts'
import { en, NS, zh, type UsageLocaleKey } from './locales.ts'

export type { UsageSectionInjected, UsageSectionProps } from './UsageSection.tsx'
export type { UsageLocaleKey } from './locales.ts'
export type { UsageOverview, UsageDay, CountEntry } from './usage-fold.ts'
export type { UsageState } from './usage-store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Usage dashboard section copy. */
    'settings.usage': UsageLocaleKey
  }
}

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; the registration depends on the slot through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'connection']

/**
 * Register the Usage section once the `settings.section` declaration is on
 * the ledger, and keep it fresh on every connection reset.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-usage: dictionaries')

  const connection = ctx.get('connection') as { readonly api: Pick<IApiClient, 'sessions'> }
  const controller = new UsageController(connection.api)
  const t = ctx.locale.bind(NS)
  const injected = (): UsageSectionInjected => ({
    hooks: { usage: controller.store },
    load: () => controller.load(),
  })

  ctx.effect(() => {
    const dispose = ctx.on('connection/reset', () => { refreshIfLoaded(controller) })
    return () => {
      dispose()
      controller.dispose()
    }
  }, 'ui-usage: invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 20,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, UsageSection))
}
