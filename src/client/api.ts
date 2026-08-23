/**
 * Browser-side API client for the /api/weixinread-flomo route family. The only
 * data access path the settings panel uses — plain fetch, same origin.
 */

/** Public config view (mirrors the host contract). */
export interface WereadConfigView {
  configured: boolean
  apiKeyMasked: string
  defaultFlomoTag: string
  /** 0 = export ALL highlights; N > 0 = cap at N. */
  exportLimit: number
  exportDest: string
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

/** Status view with cache + flomo stats. */
export interface WereadStatusView extends WereadConfigView {
  flomoConfigured: boolean
  cachedShelfBooks: number
  cachedNoteBooks: number
  cacheUpdatedAt: string
}

/** Sync result. */
export interface WereadSyncResult {
  ok: boolean
  message: string
  shelfBooks: number
  notebooks: number
}

/** One cached book for the export picker. */
export interface WereadBook {
  bookId: string
  title: string
  author: string
}

/** Flomo export result. */
export interface WereadFlomoResult {
  ok: boolean
  message: string
  sent: number
  memoCount?: number
  bookId?: string
}

/** Error carrying the route's JSON error message. */
export class WereadApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WereadApiError'
  }
}

/** Parse a JSON response or throw a WereadApiError. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new WereadApiError(`HTTP ${response.status}: invalid JSON response`)
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `HTTP ${response.status}`
    throw new WereadApiError(message)
  }
  return body as T
}

/** Plain fetch helper with an error wrapper. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (error) {
    throw new WereadApiError('网络请求失败: ' + String(error instanceof Error ? error.message : error))
  }
  return readJson<T>(response)
}

/** The weread panel API. */
export class WereadApi {
  async getConfig(): Promise<WereadConfigView> {
    return request<WereadConfigView>('/api/weixinread-flomo/config')
  }

  async setConfig(patch: Record<string, unknown>): Promise<WereadConfigView> {
    return request<WereadConfigView>('/api/weixinread-flomo/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async getStatus(): Promise<WereadStatusView> {
    return request<WereadStatusView>('/api/weixinread-flomo/status')
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>('/api/weixinread-flomo/test', { method: 'POST' })
  }

  async sync(): Promise<WereadSyncResult> {
    return request<WereadSyncResult>('/api/weixinread-flomo/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  }

  async books(): Promise<WereadBook[]> {
    const data = await request<{ books: WereadBook[] }>('/api/weixinread-flomo/books')
    return data.books ?? []
  }

  async exportFlomo(bookId: string, tag: string, limit = 20): Promise<WereadFlomoResult> {
    return request<WereadFlomoResult>('/api/weixinread-flomo/flomo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, tag, limit }),
    })
  }

  /** Multi-target export: flomo / local / notion with optional prompt. */
  async exportData(body: Record<string, unknown>): Promise<WereadFlomoResult> {
    return request<WereadFlomoResult>('/api/weixinread-flomo/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
}
