/**
 * weixinread-flomo — browser half. Registers the WeRead settings panel into the
 * web settings page (settings.section entry). The panel configures the
 * Skills API key, default flomo tag, drives manual syncs, and quick-exports
 * highlights to flomo. Failure policy: registration problems are logged,
 * never thrown — the web shell fails the whole boot when a plugin apply
 * throws, and an external plugin must not take the GUI down.
 */
// Type-only: pulls the settings-surface SlotMap merge (the 'settings.section'
// entry) and the client runtime Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { WereadSettingsPanel } from './WereadSettingsPanel.tsx'

/** Required services. */
export const inject = ['slots']

/**
 * Register the WeRead settings page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  try {
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'weread',
      order: 316,
      label: () => '微信读书',
    }, WereadSettingsPanel))
  } catch (error) {
    console.warn('[weixinread-flomo] settings panel registration failed:', error)
  }
}
