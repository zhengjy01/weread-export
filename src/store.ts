/**
 * weixinread-flomo — credential/cache store.
 *
 * Persists the WeRead Skills API key (wrk-...) to ~/.dsh/weixinread-flomo.json
 * (mode 0600) and the latest sync snapshot (bookshelf + notebook overview)
 * to ~/.dsh/weixinread-flomo-cache.json. The config file holds the API key plus
 * the default flomo tag used by weread_flomo. Reads are lazy and cached;
 * the public view() never exposes secrets. Config paths can be overridden
 * with DSH_WEREAD_CONFIG / DSH_WEREAD_CACHE (used by tests).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

/** Default machine-wide config location (mode 0600). */
export const DEFAULT_CONFIG_FILE = path.join(homedir(), '.dsh', 'weixinread-flomo.json')

/** Default sync cache location (mode 0600). */
export const DEFAULT_CACHE_FILE = path.join(homedir(), '.dsh', 'weixinread-flomo-cache.json')

/** Test override for the config location. */
export function configPath(): string {
  const override = process.env.DSH_WEREAD_CONFIG
  return override !== undefined && override !== '' ? override : DEFAULT_CONFIG_FILE
}

/** Test override for the cache location. */
export function cachePath(): string {
  const override = process.env.DSH_WEREAD_CACHE
  return override !== undefined && override !== '' ? override : DEFAULT_CACHE_FILE
}

/** Persisted credential shape. Secrets never leave this module. */
export interface WereadCredentials {
  /** WeRead Skills API key (wrk-...), user-bound. */
  apiKey: string
  /** Default flomo tag for weread_flomo exports (without leading #). */
  defaultFlomoTag: string
  /** ISO timestamp of the last successful sync. */
  lastSyncAt: string
}

/** Public, secret-free status view. */
export interface WereadConfigView {
  configured: boolean
  apiKeyMasked: string
  defaultFlomoTag: string
  lastSyncAt: string
  configPath: string
}

/** Mask a credential for display, keeping only the head and tail. */
export function mask(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return value.slice(0, 2) + '****'
  return value.slice(0, 4) + '****' + value.slice(-4)
}

/** Empty credentials record. */
function empty(): WereadCredentials {
  return { apiKey: '', defaultFlomoTag: '微信读书', lastSyncAt: '' }
}

/** Parse an unknown JSON record into credentials (tolerates missing keys). */
function parse(raw: unknown): WereadCredentials {
  const record = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
  const str = (value: unknown): string => (typeof value === 'string' ? value : '')
  return {
    apiKey: str(record.apiKey),
    defaultFlomoTag: str(record.defaultFlomoTag) || '微信读书',
    lastSyncAt: str(record.lastSyncAt),
  }
}

/**
 * Small credential store backed by ~/.dsh/weixinread-flomo.json.
 * Reads are lazy and cached; writes use mode 0600 so the API key never
 * leaks to other local users.
 */
export class WereadStore {
  config: WereadCredentials | null = null

  async load(): Promise<WereadCredentials> {
    if (this.config !== null) return this.config
    try {
      const raw = await readFile(configPath(), 'utf8')
      this.config = parse(JSON.parse(raw))
    } catch {
      // Missing or unreadable config file: treat as unconfigured.
      this.config = empty()
    }
    return this.config
  }

  async save(next: WereadCredentials): Promise<void> {
    this.config = next
    await mkdir(path.dirname(configPath()), { recursive: true })
    await writeFile(configPath(), JSON.stringify(next, null, 2), { mode: 0o600 })
  }

  /** Public, secret-free view. */
  async view(): Promise<WereadConfigView> {
    const cfg = await this.load()
    return {
      configured: cfg.apiKey.trim() !== '',
      apiKeyMasked: cfg.apiKey.trim() !== '' ? mask(cfg.apiKey) : '',
      defaultFlomoTag: cfg.defaultFlomoTag,
      lastSyncAt: cfg.lastSyncAt,
      configPath: configPath(),
    }
  }

  /**
   * Apply a config patch: apiKey / defaultFlomoTag replace, reset clears.
   * Returns the public view.
   */
  async patch(args: Record<string, unknown> | undefined): Promise<WereadConfigView> {
    const cfg = await this.load()
    let next: WereadCredentials = { ...cfg }
    if (args !== undefined && args.reset === true) {
      next = { ...empty(), defaultFlomoTag: cfg.defaultFlomoTag }
    }
    if (args !== undefined && typeof args.apiKey === 'string') next.apiKey = args.apiKey.trim()
    if (args !== undefined && typeof args.defaultFlomoTag === 'string') {
      next.defaultFlomoTag = args.defaultFlomoTag.trim().replace(/^#+/, '') || '微信读书'
    }
    if (args !== undefined && typeof args.lastSyncAt === 'string') next.lastSyncAt = args.lastSyncAt
    await this.save(next)
    return this.view()
  }
}
