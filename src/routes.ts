/**
 * weread-export — loopback HTTP routes for the web settings panel.
 *
 * Route family: /api/weread-export/*. All routes are loopback-only
 * (127.0.0.1/localhost, same-origin) — the settings panel is the only
 * consumer.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WereadStore } from './store.ts'
import { WereadApi } from './api.ts'
import { readCache, doSync } from './cache.ts'
import { readFlomoCredentials, writeFlomoCredentials, flomoStatus, resolveFlomoUrl, postMemo } from './flomo.ts'
import { runExport, type ExportRequest, type ToolContext } from './tools.ts'
import { normalizeNotionPageId, NOTION_API, NOTION_VERSION } from './export.ts'

/** Minimal host directory-picker seam (duck-typed; native = OS folder chooser). */
export interface NativeDirectoryPicker {
  capability(): { kind: 'native'; pick(signal: AbortSignal): Promise<string | null> } | { kind: 'browse' }
}

/** Route paths. */
export const WEREAD_API = {
  config: '/api/weread-export/config',
  status: '/api/weread-export/status',
  test: '/api/weread-export/test',
  sync: '/api/weread-export/sync',
  export: '/api/weread-export/export',
  flomo: '/api/weread-export/flomo',
  books: '/api/weread-export/books',
  pickDir: '/api/weread-export/pick-dir',
  testFlomo: '/api/weread-export/test-flomo',
  testNotion: '/api/weread-export/test-notion',
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
  /** Host directory picker (native = OS folder chooser); optional. */
  directoryPicker?: NativeDirectoryPicker | undefined
}

/** Build the api client from the store's current key. */
async function apiFor(store: WereadStore): Promise<WereadApi> {
  const cfg = await store.load()
  return new WereadApi(cfg.apiKey)
}

/**
 * Build every /api/weread-export route (exact paths).
 * @param deps - store (the API client is built lazily per request).
 * @returns the route list.
 */
export function makeRoutes(deps: RouteContext) {
  const { store, directoryPicker } = deps

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
          // Flomo credentials are shared with the dsh-flomo plugin: saving
          // them here writes ~/.dsh/dsh-flomo.json (one place, both plugins).
          const hasFlomoFields = body.flomoWebhookUrl !== undefined || body.flomoApiKey !== undefined || body.flomoReset === true
          if (hasFlomoFields) {
            const creds = await readFlomoCredentials()
            const next = { ...creds }
            if (body.flomoReset === true) {
              next.webhookUrl = ''
              next.apiKey = ''
            } else {
              if (typeof body.flomoWebhookUrl === 'string') next.webhookUrl = body.flomoWebhookUrl.trim()
              if (typeof body.flomoApiKey === 'string') next.apiKey = body.flomoApiKey.trim()
            }
            await writeFlomoCredentials(next)
            const rest = { ...body }
            delete rest.flomoWebhookUrl
            delete rest.flomoApiKey
            delete rest.flomoReset
            await store.patch(rest)
          } else {
            await store.patch(body)
          }
          writeJson(res, 200, await store.view())
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
        const flomo = await flomoStatus()
        const noteBooks = cache.notebooks.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0).length
        writeJson(res, 200, {
          ...view,
          flomoConfigured: flomo.configured,
          flomoSource: flomo.source,
          flomoMasked: flomo.masked,
          flomoConfigPath: flomo.configPath,
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
      path: WEREAD_API.pickDir,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        try {
          const capability = directoryPicker?.capability()
          if (capability === undefined) {
            writeJson(res, 200, { ok: false, unsupported: true, message: '当前环境没有目录选择服务，请手动输入路径。' })
            return
          }
          if (capability.kind === 'native') {
            // Opens the OS folder chooser on the host display; the request
            // stays pending until the operator picks or cancels.
            const picked = await capability.pick(AbortSignal.timeout(5 * 60 * 1000))
            if (picked === null) {
              writeJson(res, 200, { ok: false, cancelled: true, message: '已取消选择。' })
              return
            }
            writeJson(res, 200, { ok: true, path: picked })
            return
          }
          // browse backend (remote clients): no OS dialog; let the panel know.
          writeJson(res, 200, { ok: false, unsupported: true, message: '当前为远程浏览模式，不支持系统文件夹对话框，请手动输入路径。' })
        } catch (error) {
          writeJson(res, 200, { ok: false, message: '选择文件夹失败：' + String(error instanceof Error ? error.message : error) })
        }
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.testFlomo,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        const url = await resolveFlomoUrl()
        if (url === null) {
          writeJson(res, 200, { ok: false, message: 'flomo 未配置：请先在「② flomo 导出」填写 API URL / API Key 并保存。' })
          return
        }
        try {
          // Sends one real test memo so the credential is fully verified.
          const result = await postMemo(url, '✅ weread-export 测试：flomo 配置有效（' + new Date().toISOString() + '）')
          writeJson(res, 200, result)
        } catch (error) {
          writeJson(res, 200, { ok: false, message: '测试失败：' + String(error instanceof Error ? error.message : error) })
        }
      },
    },
    {
      kind: 'exact' as const,
      path: WEREAD_API.testNotion,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        const view = await store.view()
        if (!view.notionConfigured) {
          writeJson(res, 200, { ok: false, message: 'Notion 未配置：请先在「③ Notion 导出」填写 Integration Token 并保存。' })
          return
        }
        const creds = await store.load()
        try {
          // 1) Verify the token via /users/me.
          const meRes = await fetch(NOTION_API + '/v1/users/me', {
            headers: {
              'Authorization': 'Bearer ' + creds.notionToken.trim(),
              'Notion-Version': NOTION_VERSION,
            },
            signal: AbortSignal.timeout(15000),
          })
          if (!meRes.ok) {
            const body = await meRes.text().catch(() => '')
            writeJson(res, 200, { ok: false, message: 'Token 无效（HTTP ' + meRes.status + '）：' + body.slice(0, 200) + '。请检查 Token 是否正确。' })
            return
          }
          const me = await meRes.json().catch(() => ({}))
          const workspace = (me as { name?: string }).name ?? '未知工作区'

          // 2) Verify the target page is shareable with this integration.
          if (creds.notionTargetPageId.trim() === '') {
            writeJson(res, 200, { ok: true, message: 'Token 有效（工作区：' + workspace + '）。未配置目标页面，导出时还需在「③ Notion 导出」填写目标页。' })
            return
          }
          let pageId: string
          try {
            pageId = normalizeNotionPageId(creds.notionTargetPageId)
          } catch (error) {
            writeJson(res, 200, { ok: false, message: 'Token 有效（工作区：' + workspace + '），但目标页面 ID 无法解析：' + String(error instanceof Error ? error.message : error) })
            return
          }
          const pageRes = await fetch(NOTION_API + '/v1/pages/' + pageId, {
            headers: {
              'Authorization': 'Bearer ' + creds.notionToken.trim(),
              'Notion-Version': NOTION_VERSION,
            },
            signal: AbortSignal.timeout(15000),
          })
          if (pageRes.status === 404) {
            writeJson(res, 200, { ok: false, message: 'Token 有效（工作区：' + workspace + '），但目标页面不可访问（404）：请先在 Notion 中把该页面分享给此 Integration（页面右上角 ··· → Connections → 添加 Integration）。' })
            return
          }
          if (!pageRes.ok) {
            writeJson(res, 200, { ok: false, message: 'Token 有效（工作区：' + workspace + '），但读取目标页失败（HTTP ' + pageRes.status + '）。' })
            return
          }
          writeJson(res, 200, { ok: true, message: '✅ Notion 配置有效：工作区「' + workspace + '」，目标页面可访问。' })
        } catch (error) {
          writeJson(res, 200, { ok: false, message: '测试失败：' + String(error instanceof Error ? error.message : error) })
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
          dest: body.dest === 'local' || body.dest === 'notion' || body.dest === 'all' ? body.dest : undefined,
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
