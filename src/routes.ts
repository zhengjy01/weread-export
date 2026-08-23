/**
 * weixinread-flomo — loopback HTTP routes for the web settings panel.
 *
 * Route family: /api/weixinread-flomo/*. All routes are loopback-only
 * (127.0.0.1/localhost, same-origin) — the settings panel is the only
 * consumer.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WereadStore } from './store.ts'
import { WereadApi } from './api.ts'
import { readCache, doSync } from './cache.ts'
import { resolveFlomoUrl } from './flomo.ts'
import { runExport, type ExportRequest, type ToolContext } from './tools.ts'

/** Route paths. */
export const WEREAD_API = {
  config: '/api/weixinread-flomo/config',
  status: '/api/weixinread-flomo/status',
  test: '/api/weixinread-flomo/test',
  sync: '/api/weixinread-flomo/sync',
  export: '/api/weixinread-flomo/export',
  flomo: '/api/weixinread-flomo/flomo',
  books: '/api/weixinread-flomo/books',
} as const

/** Cap on JSON request bodies. */
const MAX_JSON_BODY_BYTES = 256 * 1024

/** Strict loopback fence for all routes. */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** One JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** Route handler context. */
export interface RouteContext {
  store: WereadStore
}

/** Build the api client from the store's current key. */
async function apiFor(store: WereadStore): Promise<WereadApi> {
  const cfg = await store.load()
  return new WereadApi(cfg.apiKey)
}

/**
 * Build every /api/weixinread-flomo route (exact paths).
 * @param deps - store (the API client is built lazily per request).
 * @returns the route list.
 */
export function makeRoutes(deps: RouteContext) {
  const { store } = deps

  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' })
      return false
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: `method not allowed: ${req.method}` })
      return false
    }
    return true
  }

  return [
    {
      kind: 'exact' as const,
      path: WEREAD_API.config,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const method = req.method ?? 'GET'
        if (method === 'GET') {
          if (!guard(req, res, 'GET')) return
          writeJson(res, 200, await store.view())
          return
        }
        if (method === 'POST') {
          if (!guard(req, res, 'POST')) return
          const body = await readJsonBody(req)
          if (body === undefined) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          writeJson(res, 200, await store.patch(body))
          return
        }
        writeJson(res, 405, { error: `method not allowed: ${method}` })
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.status,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'GET')) return
        const view = await store.view()
        const cache = await readCache()
        const flomoOk = await resolveFlomoUrl().then((url) => url !== null).catch(() => false)
        const noteBooks = cache.notebooks.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0).length
        writeJson(res, 200, {
          ...view,
          flomoConfigured: flomoOk,
          cachedShelfBooks: cache.shelfBooks.length,
          cachedNoteBooks: noteBooks,
          cacheUpdatedAt: cache.updatedAt,
        })
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.test,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        const view = await store.view()
        if (!view.configured) {
          writeJson(res, 400, { error: '未配置微信读书 API Key：请先在面板填写 Key。' })
          return
        }
        try {
          await (await apiFor(store)).list()
          writeJson(res, 200, { ok: true, message: '连接成功：微信读书 Skills 网关可用。' })
        } catch (error) {
          writeJson(res, 200, { ok: false, message: '连接失败：' + String(error instanceof Error ? error.message : error) })
        }
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.sync,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        const view = await store.view()
        if (!view.configured) {
          writeJson(res, 400, { error: '未配置微信读书 API Key：请先在面板填写 Key。' })
          return
        }
        try {
          const result = await doSync(await apiFor(store))
          await store.patch({ lastSyncAt: new Date().toISOString() })
          writeJson(res, 200, result)
        } catch (error) {
          writeJson(res, 200, { ok: false, message: '同步失败：' + String(error instanceof Error ? error.message : error) })
        }
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.books,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'GET')) return
        const cache = await readCache()
        const byId = new Map<string, { bookId: string; title: string; author: string }>()
        for (const book of cache.shelfBooks) {
          if (book.bookId !== undefined && book.bookId !== '') {
            byId.set(book.bookId, { bookId: book.bookId, title: book.title ?? '未知书名', author: book.author ?? '' })
          }
        }
        for (const entry of cache.notebooks) {
          if (entry.bookId !== undefined && entry.bookId !== '' && !byId.has(entry.bookId)) {
            byId.set(entry.bookId, { bookId: entry.bookId, title: entry.book?.title ?? '未知书名', author: entry.book?.author ?? '' })
          }
        }
        const books = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh'))
        writeJson(res, 200, { books, count: books.length })
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.export,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        const view = await store.view()
        if (!view.configured) {
          writeJson(res, 400, { error: '未配置微信读书 API Key。' })
          return
        }
        const body = (await readJsonBody(req)) ?? {}
        const req2: ExportRequest = {
          bookId: typeof body.bookId === 'string' ? body.bookId : undefined,
          dest: body.dest === 'local' || body.dest === 'notion' ? body.dest : undefined,
          localDir: typeof body.localDir === 'string' ? body.localDir : undefined,
          tag: typeof body.tag === 'string' ? body.tag : undefined,
          prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
          usePrompt: typeof body.usePrompt === 'boolean' ? body.usePrompt : undefined,
          limit: typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : undefined,
        }
        if ((req2.bookId ?? '').trim() === '') {
          writeJson(res, 400, { error: '缺少 bookId。' })
          return
        }
        const ctx: ToolContext = { store }
        const result = await runExport(ctx, req2)
        writeJson(res, 200, result)
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.flomo,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        const view = await store.view()
        if (!view.configured) {
          writeJson(res, 400, { error: '未配置微信读书 API Key。' })
          return
        }
        const body = (await readJsonBody(req)) ?? {}
        const req2: ExportRequest = {
          bookId: typeof body.bookId === 'string' ? body.bookId : undefined,
          dest: 'flomo',
          tag: typeof body.tag === 'string' ? body.tag : undefined,
          limit: typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : undefined,
        }
        if ((req2.bookId ?? '').trim() === '') {
          writeJson(res, 400, { error: '缺少 bookId。' })
          return
        }
        const ctx: ToolContext = { store }
        const result = await runExport(ctx, req2)
        writeJson(res, 200, result)
      },
    },
  ]
}
