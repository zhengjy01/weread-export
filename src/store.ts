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
  /** Highlights per export: 0 = export ALL, N > 0 = cap at N. */
  exportLimit: number
  /** Default export destination: flomo | local | notion. */
  exportDest: ExportDest
  /** Local export directory (required when dest=local; no default). */
  localExportDir: string
  /** Notion integration token (plugin-owned, independent of dsh-notion). */
  notionToken: string
  /** Notion target parent page: id or URL (page must share with the token). */
  notionTargetPageId: string
  /** Whether to run highlights through the LLM prompt before export. */
  usePrompt: boolean
  /** LLM prompt template ({title}/{author}/{highlights}/{thoughts} placeholders). */
  exportPrompt: string
  /** OpenAI-compatible chat completions base URL. */
  llmBaseUrl: string
  /** LLM API key (custom, panel-configured). */
  llmApiKey: string
  /** LLM model name. */
  llmModel: string
  /** ISO timestamp of the last successful sync. */
  lastSyncAt: string
}

/** Export destination. */
export type ExportDest = 'flomo' | 'local' | 'notion'

/** Public, secret-free status view. */
export interface WereadConfigView {
  configured: boolean
  apiKeyMasked: string
  defaultFlomoTag: string
  exportLimit: number
  exportDest: ExportDest
  localExportDir: string
  notionConfigured: boolean
  notionTargetPageId: string
  usePrompt: boolean
  llmConfigured: boolean
  llmBaseUrl: string
  llmModel: string
  lastSyncAt: string
  configPath: string
}

/** Mask a credential for display, keeping only the head and tail. */
export function mask(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return value.slice(0, 2) + '****'
  return value.slice(0, 4) + '****' + value.slice(-4)
}

/** Default export prompt template. */
export const DEFAULT_EXPORT_PROMPT =
  '你是读书笔记整理助手。请根据下面提供的微信读书划线内容，输出一份结构化读书笔记：\n' +
  '## 核心观点\n## 金句摘录\n## 我的思考\n' +
  '要求：保留划线原文要点，语言精炼，使用 Markdown 格式。\n\n' +
  '书籍：{title}\n作者：{author}\n划线内容：\n{highlights}'

/** Empty credentials record. */
function empty(): WereadCredentials {
  return {
    apiKey: '',
    defaultFlomoTag: '微信读书',
    exportLimit: 20,
    exportDest: 'flomo',
    localExportDir: '',
    notionToken: '',
    notionTargetPageId: '',
    usePrompt: false,
    exportPrompt: DEFAULT_EXPORT_PROMPT,
    llmBaseUrl: 'https://api.deepseek.com/v1',
    llmApiKey: '',
    llmModel: 'deepseek-chat',
    lastSyncAt: '',
  }
}

/** Parse an unknown JSON record into credentials (tolerates missing keys). */
function parse(raw: unknown): WereadCredentials {
  const record = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
  const str = (value: unknown): string => (typeof value === 'string' ? value : '')
  const limit = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 20
  const dest = (value: unknown): ExportDest =>
    value === 'local' || value === 'notion' ? value : (value === 'flomo' ? 'flomo' : 'flomo')
  const bool = (value: unknown): boolean => value === true
  const base = empty()
  return {
    apiKey: str(record.apiKey),
    defaultFlomoTag: str(record.defaultFlomoTag) || base.defaultFlomoTag,
    exportLimit: limit(record.exportLimit),
    exportDest: dest(record.exportDest),
    localExportDir: str(record.localExportDir),
    notionToken: str(record.notionToken),
    notionTargetPageId: str(record.notionTargetPageId),
    usePrompt: bool(record.usePrompt),
    exportPrompt: str(record.exportPrompt) || base.exportPrompt,
    llmBaseUrl: str(record.llmBaseUrl) || base.llmBaseUrl,
    llmApiKey: str(record.llmApiKey),
    llmModel: str(record.llmModel) || base.llmModel,
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
      exportLimit: cfg.exportLimit,
      exportDest: cfg.exportDest,
      localExportDir: cfg.localExportDir,
      notionConfigured: cfg.notionToken.trim() !== '',
      notionTargetPageId: cfg.notionTargetPageId,
      usePrompt: cfg.usePrompt,
      llmConfigured: cfg.llmApiKey.trim() !== '',
      llmBaseUrl: cfg.llmBaseUrl,
      llmModel: cfg.llmModel,
      lastSyncAt: cfg.lastSyncAt,
      configPath: configPath(),
    }
  }

  /**
   * Apply a config patch: any supported field replaces, reset clears.
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
    if (args !== undefined && typeof args.exportLimit === 'number' && Number.isFinite(args.exportLimit)) {
      next.exportLimit = Math.max(0, Math.floor(args.exportLimit))
    }
    if (args !== undefined && (args.exportDest === 'flomo' || args.exportDest === 'local' || args.exportDest === 'notion')) {
      next.exportDest = args.exportDest
    }
    if (args !== undefined && typeof args.localExportDir === 'string') next.localExportDir = args.localExportDir.trim()
    if (args !== undefined && typeof args.notionToken === 'string') next.notionToken = args.notionToken.trim()
    if (args !== undefined && typeof args.notionTargetPageId === 'string') next.notionTargetPageId = args.notionTargetPageId.trim()
    if (args !== undefined && typeof args.usePrompt === 'boolean') next.usePrompt = args.usePrompt
    if (args !== undefined && typeof args.exportPrompt === 'string') next.exportPrompt = args.exportPrompt
    if (args !== undefined && typeof args.llmBaseUrl === 'string') next.llmBaseUrl = args.llmBaseUrl.trim()
    if (args !== undefined && typeof args.llmApiKey === 'string') next.llmApiKey = args.llmApiKey.trim()
    if (args !== undefined && typeof args.llmModel === 'string') next.llmModel = args.llmModel.trim()
    if (args !== undefined && typeof args.lastSyncAt === 'string') next.lastSyncAt = args.lastSyncAt
    await this.save(next)
    return this.view()
  }
}
