/**
 * weixinread-flomo — model-facing tools.
 *
 * Mounted via ctx.tools.register. Covers the WeRead surface: status,
 * config, search, book info, shelf, notes/highlights, reading stats,
 * cache sync, and multi-target export (flomo / local file / Notion) with
 * optional LLM prompt processing. Every tool resolves to { ok, message, ... }
 * and never throws for API-level outcomes.
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { WereadApi, WereadApiError } from './api.ts'
import type { WereadStore } from './store.ts'
import { flomoConfigured, resolveFlomoUrl } from './flomo.ts'
import {
  readCache, doSync, dateLabel, formatDate, formatDuration, formatRating, deepLink,
  shelfLine, notebookLines, buildNotesMarkdown, chapterTitleMap,
} from './cache.ts'
import { buildExportMarkdown, processWithPrompt, exportToLocal, exportToNotion, exportToFlomo } from './export.ts'
import { llmConfigured } from './llm.ts'
import type { ExportDest } from './store.ts'

/** One text content block (the only render shape these tools emit). */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

/** Shared tool dependencies. */
export interface ToolContext {
  store: WereadStore
}

/** Readable error for API failures. */
function apiError(err: unknown): string {
  if (err instanceof WereadApiError) return err.message
  return String(err instanceof Error ? err.message : err)
}

/** Build the api client from the store's current key (throws when unconfigured). */
async function requireApi(ctx: ToolContext): Promise<WereadApi> {
  const cfg = await ctx.store.load()
  return new WereadApi(cfg.apiKey)
}

/** Masked-ish summary for search book entries. */
function formatSearchBook(entry: { bookInfo?: { bookId?: string; title?: string; author?: string; cover?: string; intro?: string; deepLink?: string }; newRating?: number; newRatingCount?: number; readingCount?: number }): string {
  const info = entry.bookInfo ?? {}
  const rating = formatRating(entry.newRating)
  const reading = typeof entry.readingCount === 'number' && entry.readingCount > 0 ? '在读 ' + formatCount(entry.readingCount) : ''
  const link = deepLink(info.bookId, info.deepLink)
  return '- 《' + (info.title ?? '未知书名') + '》· ' + (info.author ?? '未知作者') +
    (rating !== '' ? ' · 评分 ' + rating : '') +
    (reading !== '' ? ' · ' + reading : '') +
    ' · bookId=' + (info.bookId ?? '?') +
    (link !== '' ? '\n  ' + link : '')
}

/** 12000 → 1.2万, 1234567 → 123万. */
function formatCount(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

/** Status tool: configuration + cache + export targets. */
export function wereadStatusTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_status',
    description: '查看 weixinread-flomo 插件状态：微信读书 API Key 配置、默认 flomo 标签、导出条数（0=全部）、默认导出目标（flomo/本地/Notion）、Notion 与 LLM（prompt 处理）配置状态、最近同步、缓存规模。不会泄露任何 Key。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          configured: { type: 'boolean' },
          apiKeyMasked: { type: 'string' },
          defaultFlomoTag: { type: 'string' },
          exportLimit: { type: 'number' },
          exportDest: { type: 'string' },
          localExportDir: { type: 'string' },
          notionConfigured: { type: 'boolean' },
          notionTargetPageId: { type: 'string' },
          usePrompt: { type: 'boolean' },
          llmConfigured: { type: 'boolean' },
          llmBaseUrl: { type: 'string' },
          llmModel: { type: 'string' },
          lastSyncAt: { type: 'string' },
          flomoConfigured: { type: 'boolean' },
          configPath: { type: 'string' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute() {
      const view = await ctx.store.view()
      const cache = await readCache()
      const flomoOk = await flomoConfigured()
      const destLabel = view.exportDest === 'local' ? '本地文件' : (view.exportDest === 'notion' ? 'Notion' : 'flomo')
      const lines = [
        view.configured
          ? '已配置：API Key ' + view.apiKeyMasked + '（在 https://weread.qq.com/r/weread-skills 创建）'
          : '未配置：请先调用 weread_config 填入 API Key（https://weread.qq.com/r/weread-skills 登录后「创建 Key」）。',
        '默认导出目标：' + destLabel +
          (view.exportDest === 'local' ? (view.localExportDir !== '' ? '（' + view.localExportDir + '）' : '（未设路径，导出时需指定）') : '') +
          (view.exportDest === 'notion' ? (view.notionConfigured && view.notionTargetPageId !== '' ? '（目标页 ' + view.notionTargetPageId + '）' : '（Notion 未配置完整）') : ''),
        '默认 flomo 标签：#' + view.defaultFlomoTag + (flomoOk ? '（flomo 已配置）' : '（flomo 未配置，flomo 导出不可用）'),
        '导出条数：' + (view.exportLimit === 0 ? '全部导出（超长自动拆多条 MEMO）' : '最多 ' + view.exportLimit + ' 条'),
        'prompt 处理：' + (view.usePrompt ? '已开启（LLM ' + (view.llmConfigured ? view.llmModel + ' @ ' + view.llmBaseUrl : '未配置') + '）' : '关闭'),
        'Notion：' + (view.notionConfigured ? '已配置 token' + (view.notionTargetPageId !== '' ? ' + 目标页' : '（未填目标页）') : '未配置'),
        '最近同步：' + (view.lastSyncAt !== '' ? view.lastSyncAt : '从未同步（可 weread_sync）'),
        '缓存：书架 ' + cache.shelfBooks.length + ' 本 · 有笔记的书 ' + cache.notebooks.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0).length + ' 本',
        '配置路径：' + view.configPath,
      ]
      return {
        ok: true,
        message: lines.join('\n'),
        configured: view.configured,
        apiKeyMasked: view.apiKeyMasked,
        defaultFlomoTag: view.defaultFlomoTag,
        exportLimit: view.exportLimit,
        exportDest: view.exportDest,
        localExportDir: view.localExportDir,
        notionConfigured: view.notionConfigured,
        notionTargetPageId: view.notionTargetPageId,
        usePrompt: view.usePrompt,
        llmConfigured: view.llmConfigured,
        llmBaseUrl: view.llmBaseUrl,
        llmModel: view.llmModel,
        lastSyncAt: view.lastSyncAt,
        flomoConfigured: flomoOk,
        configPath: view.configPath,
      }
    },
  })
}

/** Config tool: set/clear the API key, default flomo tag, and export limit. */
export function wereadConfigTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_config',
    description: '配置或清除 weixinread-flomo 的凭据与导出偏好：apiKey 为微信读书 Skills API Key（wrk- 开头，https://weread.qq.com/r/weread-skills 创建）；defaultFlomoTag 为 flomo 导出默认标签；exportLimit 为导出条数（0=全部）；exportDest 为默认导出目标（flomo/local/notion）；localExportDir 为本地导出目录；notionToken/notionTargetPageId 为 Notion 导出凭据与目标页；usePrompt/exportPrompt 为 LLM prompt 处理开关与模板；llmBaseUrl/llmApiKey/llmModel 为 LLM 配置（OpenAI 兼容）。test: true 保存后测试微信读书连接。reset: true 清除全部。凭据存 ~/.dsh/weixinread-flomo.json（0600）。',
    parameters: {
      apiKey: { type: 'string', description: '微信读书 Skills API Key（wrk- 开头）' },
      defaultFlomoTag: { type: 'string', description: 'flomo 导出默认标签（不带 #，如 读书笔记）' },
      exportLimit: { type: 'number', description: '每次导出的划线条数：0=全部导出，N>0=最多 N 条（默认 20）' },
      exportDest: { type: 'string', enum: ['flomo', 'local', 'notion'], description: '默认导出目标（weread_export 不传 dest 时使用）' },
      localExportDir: { type: 'string', description: '本地导出目录（dest=local 时用，导出时也可临时传 localDir）' },
      notionToken: { type: 'string', description: 'Notion Integration Token（本插件独立配置，页面需分享给该 Integration）' },
      notionTargetPageId: { type: 'string', description: 'Notion 目标父页面 URL 或 32 位页面 ID' },
      usePrompt: { type: 'boolean', description: '是否用 LLM 按 prompt 整理后再导出' },
      exportPrompt: { type: 'string', description: '导出 prompt 模板，占位符 {title}/{author}/{highlights}/{thoughts}' },
      llmBaseUrl: { type: 'string', description: 'LLM Base URL（OpenAI 兼容，默认 https://api.deepseek.com/v1）' },
      llmApiKey: { type: 'string', description: 'LLM API Key' },
      llmModel: { type: 'string', description: 'LLM 模型名（默认 deepseek-chat）' },
      test: { type: 'boolean', description: 'true 时保存后立即测试微信读书连接' },
      reset: { type: 'boolean', description: '设为 true 清除全部凭据' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          configured: { type: 'boolean' },
          apiKeyMasked: { type: 'string' },
          defaultFlomoTag: { type: 'string' },
          exportLimit: { type: 'number' },
          exportDest: { type: 'string' },
          localExportDir: { type: 'string' },
          notionConfigured: { type: 'boolean' },
          notionTargetPageId: { type: 'string' },
          usePrompt: { type: 'boolean' },
          llmConfigured: { type: 'boolean' },
          llmBaseUrl: { type: 'string' },
          llmModel: { type: 'string' },
          lastSyncAt: { type: 'string' },
          configPath: { type: 'string' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: {
      apiKey?: string; defaultFlomoTag?: string; exportLimit?: number; exportDest?: string;
      localExportDir?: string; notionToken?: string; notionTargetPageId?: string;
      usePrompt?: boolean; exportPrompt?: string; llmBaseUrl?: string; llmApiKey?: string; llmModel?: string;
      test?: boolean; reset?: boolean;
    }) {
      const view = await ctx.store.patch(args)
      if (!view.configured) {
        return { ok: false, message: '配置未生效：缺少 API Key。请在 https://weread.qq.com/r/weread-skills 登录后创建 Key 并填入。', configured: view.configured, apiKeyMasked: view.apiKeyMasked, defaultFlomoTag: view.defaultFlomoTag, exportLimit: view.exportLimit, exportDest: view.exportDest, localExportDir: view.localExportDir, notionConfigured: view.notionConfigured, notionTargetPageId: view.notionTargetPageId, usePrompt: view.usePrompt, llmConfigured: view.llmConfigured, llmBaseUrl: view.llmBaseUrl, llmModel: view.llmModel, lastSyncAt: view.lastSyncAt, configPath: view.configPath }
      }
      const parts = [
        '已保存配置：API Key ' + view.apiKeyMasked,
        '默认 flomo 标签 #' + view.defaultFlomoTag,
        '导出策略 ' + (view.exportLimit === 0 ? '全部导出' : '最多 ' + view.exportLimit + ' 条'),
        '默认目标 ' + view.exportDest,
      ]
      if (view.usePrompt) parts.push('prompt 处理已开启（' + (view.llmConfigured ? view.llmModel + ' @ ' + view.llmBaseUrl : 'LLM 未配置') + '）')
      if (view.notionConfigured) parts.push('Notion 已配置' + (view.notionTargetPageId !== '' ? '（目标页 ' + view.notionTargetPageId + '）' : '（未填目标页）'))
      if (args?.test === true) {
        try {
          await (await requireApi(ctx)).list()
          parts.push('连接测试：成功（网关可用）')
        } catch (error) {
          parts.push('连接测试：失败（' + apiError(error) + '）')
        }
      }
      return { ok: true, message: parts.join('；') + '。', configured: view.configured, apiKeyMasked: view.apiKeyMasked, defaultFlomoTag: view.defaultFlomoTag, exportLimit: view.exportLimit, exportDest: view.exportDest, localExportDir: view.localExportDir, notionConfigured: view.notionConfigured, notionTargetPageId: view.notionTargetPageId, usePrompt: view.usePrompt, llmConfigured: view.llmConfigured, llmBaseUrl: view.llmBaseUrl, llmModel: view.llmModel, lastSyncAt: view.lastSyncAt, configPath: view.configPath }
    },
  })
}

/** Search tool: book store search. */
export function wereadSearchTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_search',
    description: '在微信读书书城搜索书籍：按关键词返回书名、作者、评分（0-10）、在读人数、bookId 与跳转链接。scope 搜索类型：10=电子书（默认）、0=全部、16=网文小说、14=有声书/专辑、6=作者、12=全文、13=书单、2=公众号、4=文章。拿到 bookId 后可继续用 weread_book（详情/进度/章节）、weread_notes（划线/想法）。',
    parameters: {
      keyword: { type: 'string', required: true, description: '搜索关键词（书名/作者）' },
      scope: { type: 'number', description: '搜索类型（默认 10=电子书；0=全部；16=网文；14=听书；6=作者；12=全文）' },
      count: { type: 'number', description: '返回条数上限（默认 10）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          count: { type: 'number' },
          keyword: { type: 'string' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: { keyword?: string; scope?: number; count?: number }) {
      const keyword = (args?.keyword ?? '').trim()
      if (keyword === '') return { ok: false, message: '请提供搜索关键词 keyword。' }
      const count = typeof args?.count === 'number' && args.count > 0 ? Math.min(Math.floor(args.count), 50) : 10
      const scope = typeof args?.scope === 'number' ? args.scope : 10
      let data
      try {
        data = await (await requireApi(ctx)).search(keyword, count, scope)
      } catch (error) {
        return { ok: false, message: '搜索失败：' + apiError(error) }
      }
      const entries = (data.results ?? []).flatMap((r) => (Array.isArray(r.books) ? r.books : []))
      const lines = entries.length === 0 ? ['（没有找到相关书籍）'] : entries.slice(0, count).map(formatSearchBook)
      return { ok: true, message: '「' + keyword + '」搜索结果（' + entries.length + ' 条）：\n' + lines.join('\n'), count: entries.length, keyword }
    },
  })
}

/** Book tool: metadata + progress + chapter catalog summary. */
export function wereadBookTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_book',
    description: '查看微信读书单本书详情：作者/出版社/分类/字数/评分/简介 + 阅读进度 + 章节目录概览（章节数、各级章节数）。bookId 来自 weread_search 或 weread_shelf。',
    parameters: {
      bookId: { type: 'string', required: true, description: '书籍 bookId' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          bookId: { type: 'string' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: { bookId?: string }) {
      const bookId = (args?.bookId ?? '').trim()
      if (bookId === '') return { ok: false, message: '请提供 bookId。' }
      const api = await requireApi(ctx)
      try {
        const [info, progress, chapters] = await Promise.all([
          api.bookInfo(bookId),
          api.getProgress(bookId),
          api.chapterInfo(bookId).catch(() => undefined),
        ])
        const lines = [
          '📖 《' + (info.title ?? '未知书名') + '》· ' + (info.author ?? '未知作者'),
        ]
        const meta: string[] = []
        const rating = formatRating(info.newRating)
        if (rating !== '') meta.push('评分 ' + rating + (typeof info.newRatingCount === 'number' && info.newRatingCount > 0 ? '（' + formatCount(info.newRatingCount) + ' 人）' : ''))
        if (info.category) meta.push(info.category)
        if (info.publisher) meta.push(info.publisher)
        if (typeof info.wordCount === 'number' && info.wordCount > 0) meta.push(formatCount(info.wordCount) + ' 字')
        if (meta.length > 0) lines.push('信息：' + meta.join(' · '))
        if (info.intro) lines.push('简介：' + info.intro.slice(0, 200) + (info.intro.length > 200 ? '…' : ''))
        const progressValue = progress.book?.progress
        if (typeof progressValue === 'number') {
          const time = formatDate(progress.book?.updateTime)
          lines.push('阅读进度：' + progressValue + '%' + (progressValue >= 100 ? '（已读完）' : '') + (time !== '' ? '（更新于 ' + time + '）' : ''))
        }
        const recordTime = progress.book?.recordReadingTime
        if (typeof recordTime === 'number' && recordTime > 0) lines.push('累计阅读：' + formatDuration(recordTime))
        const chapterList = chapters?.chapters
        if (Array.isArray(chapterList) && chapterList.length > 0) {
          const topLevel = chapterList.filter((c) => (c.level ?? 1) === 1).length
          lines.push('章节：共 ' + chapterList.length + ' 章' + (topLevel > 0 && topLevel < chapterList.length ? '（一级章节 ' + topLevel + '）' : ''))
          const first = chapterList.slice(0, 5).map((c) => c.title ?? '').filter(Boolean)
          if (first.length > 0) lines.push('  前几章：' + first.join(' / '))
        }
        const link = deepLink(bookId, info.deepLink)
        if (link !== '') lines.push('链接：' + link)
        return { ok: true, message: lines.join('\n'), bookId }
      } catch (error) {
        return { ok: false, message: '查询书籍失败：' + apiError(error), bookId }
      }
    },
  })
}

/** Shelf tool: live bookshelf (optionally from cache). */
export function wereadShelfTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_shelf',
    description: '查看微信读书书架：返回书籍列表（书名/作者/进度/最近阅读时间/是否读完）与有声书、公众号条目数。默认实时拉取；useCache: true 时读本地缓存（先 weread_sync）。',
    parameters: {
      useCache: { type: 'boolean', description: 'true 时读本地缓存而非实时拉取' },
      limit: { type: 'number', description: '最多展示条数（默认 100）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          bookCount: { type: 'number' },
          albumsCount: { type: 'number' },
          mpCount: { type: 'number' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: { useCache?: boolean; limit?: number }) {
      const api = await requireApi(ctx)
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.min(Math.floor(args.limit), 200) : 100
      try {
        if (args?.useCache === true) {
          const cache = await readCache()
          if (cache.shelfBooks.length === 0 && cache.updatedAt === '') {
            return { ok: false, message: '本地缓存为空：请先 weread_sync 或去掉 useCache 实时拉取。', bookCount: 0, albumsCount: 0, mpCount: 0 }
          }
          return renderShelf(cache.shelfBooks, cache.albumsCount, cache.mpCount, cache.notebooks, limit, '缓存（更新于 ' + (cache.updatedAt !== '' ? formatDate(Math.floor(new Date(cache.updatedAt).getTime() / 1000)) : '?') + '）')
        }
        const [shelf, notebooks] = await Promise.all([api.shelf(), api.notebooks(200).catch(() => undefined)])
        const books = Array.isArray(shelf.books) ? shelf.books : []
        const albums = Array.isArray(shelf.albums) ? shelf.albums : []
        const mpCount = shelf.mp !== undefined && shelf.mp !== null ? 1 : 0
        const notebookEntries = Array.isArray(notebooks?.books) ? notebooks.books : []
        return renderShelf(books, albums.length, mpCount, notebookEntries, limit, '实时')
      } catch (error) {
        return { ok: false, message: '拉取书架失败：' + apiError(error), bookCount: 0, albumsCount: 0, mpCount: 0 }
      }
    },
  })
}

/** Shared shelf renderer. */
function renderShelf(
  books: { bookId?: string; title?: string; author?: string; readUpdateTime?: number; finishReading?: boolean | number }[],
  albumsCount: number,
  mpCount: number,
  notebookEntries: { bookId?: string; readingProgress?: number }[],
  limit: number,
  source: string,
): { ok: boolean; message: string; bookCount: number; albumsCount: number; mpCount: number } {
  const progressByBookId = new Map<string, number>()
  for (const entry of notebookEntries) {
    if (typeof entry.readingProgress === 'number' && entry.bookId !== undefined) {
      progressByBookId.set(entry.bookId, entry.readingProgress)
    }
  }
  const lines = books.slice(0, limit).map((book) => shelfLine(book, progressByBookId))
  const extra = books.length > limit ? '\n…（共 ' + books.length + ' 本，仅展示前 ' + limit + ' 本）' : ''
  const total = books.length + albumsCount + mpCount
  const summary =
    '书架可见条目共 ' + total + '：' + books.length + ' 本电子书' +
    (albumsCount > 0 ? ' + ' + albumsCount + ' 部有声书' : '') +
    (mpCount > 0 ? ' + ' + mpCount + ' 个文章收藏' : '') +
    '（' + source + '）：'
  return {
    ok: true,
    message: summary + (lines.length > 0 ? '\n' + lines.join('\n') + extra : '\n（书架为空）'),
    bookCount: books.length,
    albumsCount,
    mpCount,
  }
}

/** Notes tool: notebook overview or per-book highlights + thoughts. */
export function wereadNotesTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_notes',
    description: '查看微信读书笔记：不给 bookId 时返回「笔记本概览」（所有有笔记的书，含划线/想法/笔记数、阅读进度）；给 bookId 时返回该书全部划线（markText + 章节 + 时间）与想法（点评 + 章节 + 时间），并附跳转链接。',
    parameters: {
      bookId: { type: 'string', description: '书籍 bookId（省略=笔记本概览）' },
      count: { type: 'number', description: '概览模式返回条数上限（默认 50）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          bookId: { type: 'string' },
          highlightCount: { type: 'number' },
          reviewCount: { type: 'number' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: { bookId?: string; count?: number }) {
      const api = await requireApi(ctx)
      const bookId = (args?.bookId ?? '').trim()
      if (bookId === '') {
        try {
          const data = await api.notebooks(typeof args?.count === 'number' && args.count > 0 ? Math.min(Math.floor(args.count), 200) : 50)
          const entries = Array.isArray(data.books) ? data.books : []
          const lines = notebookLines(entries)
          return {
            ok: true,
            message: '笔记本概览（共 ' + String(data.totalBookCount ?? '?') + ' 本书、' + String(data.totalNoteCount ?? '?') + ' 条笔记/想法/划线）：\n' + (lines.length > 0 ? lines.join('\n') : '（暂无笔记）'),
            highlightCount: 0,
            reviewCount: 0,
          }
        } catch (error) {
          return { ok: false, message: '拉取笔记本概览失败：' + apiError(error) }
        }
      }
      try {
        const [bookmarks, reviews, info] = await Promise.all([
          api.bookmarklist(bookId),
          api.reviewListMine(bookId, 50).catch(() => undefined),
          api.bookInfo(bookId).catch(() => undefined),
        ])
        const highlights = Array.isArray(bookmarks.updated) ? bookmarks.updated : []
        const thoughts = Array.isArray(reviews?.reviews) ? reviews.reviews : []
        const markdown = buildNotesMarkdown(
          info?.title ?? '未知书名',
          info?.author ?? '',
          highlights,
          thoughts,
          bookmarks.chapters,
        )
        const link = deepLink(bookId, info?.deepLink)
        return {
          ok: true,
          message: markdown + (link !== '' ? '\n\n链接：' + link : ''),
          bookId,
          highlightCount: highlights.length,
          reviewCount: thoughts.length,
        }
      } catch (error) {
        return { ok: false, message: '拉取笔记失败：' + apiError(error), bookId }
      }
    },
  })
}

/** Readdata tool: reading statistics. */
export function wereadReaddataTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_readdata',
    description: '查看微信读书阅读统计：模式支持 weekly/monthly/annually/overall（默认 monthly，可 baseTime 指定统计周期内的 Unix 秒时间戳）。返回总阅读时长、阅读天数、日均时长、阅读/听书时长、排名、偏好分类与读得最久的书。',
    parameters: {
      mode: { type: 'string', description: '统计模式：weekly / monthly / annually / overall（默认 monthly）' },
      baseTime: { type: 'number', description: '目标周期内的 Unix 时间戳（秒），overall 用 0' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          mode: { type: 'string' },
          totalReadTime: { type: 'number' },
          readDays: { type: 'number' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: { mode?: string; baseTime?: number }) {
      const mode = typeof args?.mode === 'string' && ['weekly', 'monthly', 'annually', 'overall'].includes(args.mode) ? args.mode : 'monthly'
      try {
        const data = await (await requireApi(ctx)).readdata(mode, args?.baseTime)
        const lines = ['📊 阅读统计（' + modeLabel(mode) + '）']
        const total = data.totalReadTime ?? 0
        lines.push('- 总阅读时长：' + formatDuration(total))
        if (typeof data.readDays === 'number') lines.push('- 阅读天数：' + data.readDays + ' 天')
        if (typeof data.dayAverageReadTime === 'number' && data.dayAverageReadTime > 0) lines.push('- 日均阅读：' + formatDuration(data.dayAverageReadTime) + '（按自然日）')
        if (typeof data.readRate === 'number' && data.readRate > 0) {
          lines.push('- 文字阅读占比：' + data.readRate + '%' + (typeof data.wrListenTime === 'number' && data.wrListenTime > 0 ? '（听书 ' + formatDuration(data.wrListenTime) + '）' : ''))
        }
        const compare = formatCompare(data.compare)
        if (compare !== '') lines.push('- 较上期日均：' + compare)
        const rankText = rankTextOf(data.rank)
        if (rankText !== '') lines.push('- ' + rankText)
        const stats = formatReadStat(data.readStat)
        if (stats !== '') lines.push('- ' + stats)
        const longest = formatLongest(data.readLongest)
        if (longest !== '') lines.push('- 读得最久的书：' + longest)
        const categories = formatCategories(data.preferCategory)
        if (categories !== '') lines.push('- 偏好分类：' + categories)
        const authors = formatAuthors(data.preferAuthor)
        if (authors !== '') lines.push('- 偏好作者：' + authors)
        if (typeof data.preferTimeWord === 'string' && data.preferTimeWord !== '') lines.push('- 偏好时段：' + data.preferTimeWord)
        return { ok: true, message: lines.join('\n'), mode, totalReadTime: total, readDays: data.readDays ?? 0 }
      } catch (error) {
        return { ok: false, message: '拉取阅读统计失败：' + apiError(error), mode }
      }
    },
  })
}

/** Statistic mode label. */
function modeLabel(mode: string): string {
  switch (mode) {
    case 'weekly': return '本周'
    case 'monthly': return '本月'
    case 'annually': return '今年'
    case 'overall': return '累计'
    default: return mode
  }
}

/** compare (ratio vs last period): 0.2 → +20%. */
function formatCompare(compare: unknown): string {
  if (typeof compare !== 'number' || !Number.isFinite(compare)) return ''
  const percent = Math.round(compare * 100)
  return (percent >= 0 ? '+' : '') + percent + '%'
}

/** rank is an object { text, scheme } in the current gateway format. */
function rankTextOf(rank: unknown): string {
  if (typeof rank !== 'object' || rank === null) return ''
  const record = rank as Record<string, unknown>
  return typeof record.text === 'string' ? record.text : ''
}

/** readStat[]: { stat, counts } e.g. 读过/读完/笔记 with文案 like '12本'. */
function formatReadStat(list: unknown): string {
  if (!Array.isArray(list)) return ''
  const parts: string[] = []
  for (const entry of list.slice(0, 6)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const stat = typeof record.stat === 'string' ? record.stat : ''
    const counts = typeof record.counts === 'string' ? record.counts : ''
    if (stat !== '' && counts !== '') parts.push(stat + ' ' + counts)
  }
  return parts.join(' · ')
}

/** readLongest[]: { book: {title}, albumInfo: {name}, readTime(秒) }. */
function formatLongest(list: unknown): string {
  if (!Array.isArray(list)) return ''
  const parts: string[] = []
  for (const entry of list.slice(0, 3)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const book = typeof record.book === 'object' && record.book !== null ? record.book as Record<string, unknown> : null
    const album = typeof record.albumInfo === 'object' && record.albumInfo !== null ? record.albumInfo as Record<string, unknown> : null
    const title = (book !== null && typeof book.title === 'string' ? book.title : '') ||
      (album !== null && typeof album.name === 'string' ? album.name : '')
    if (title === '') continue
    const time = typeof record.readTime === 'number' && record.readTime > 0 ? '（' + formatDuration(record.readTime) + '）' : ''
    parts.push('《' + title + '》' + time)
  }
  return parts.join('、')
}

/** preferCategory[]: { categoryTitle, readingTime(秒) }. */
function formatCategories(list: unknown): string {
  if (!Array.isArray(list)) return ''
  const parts: string[] = []
  for (const entry of list.slice(0, 4)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const title = typeof record.categoryTitle === 'string' ? record.categoryTitle : ''
    if (title === '') continue
    const time = typeof record.readingTime === 'number' && record.readingTime > 0 ? '（' + formatDuration(record.readingTime) + '）' : ''
    parts.push(title + time)
  }
  return parts.join('、')
}

/** preferAuthor[]: { name, count(本), readTime(格式化字符串) }. */
function formatAuthors(list: unknown): string {
  if (!Array.isArray(list)) return ''
  const parts: string[] = []
  for (const entry of list.slice(0, 3)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : ''
    if (name === '') continue
    const count = typeof record.count === 'number' && record.count > 0 ? '（' + record.count + ' 本）' : ''
    parts.push(name + count)
  }
  return parts.join('、')
}

/** Sync tool: pull shelf + notebooks into the local cache. */
export function wereadSyncTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_sync',
    description: '同步微信读书到本地缓存（~/.dsh/weixinread-flomo-cache.json）：拉取书架与笔记本概览（有笔记的书），更新最近同步时间。之后 weread_shelf useCache / 设置面板可读缓存。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          shelfBooks: { type: 'number' },
          notebooks: { type: 'number' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute() {
      try {
        const result = await doSync(await requireApi(ctx))
        await ctx.store.patch({ lastSyncAt: new Date().toISOString() })
        return { ok: result.ok, message: result.message, shelfBooks: result.cache.shelfBooks.length, notebooks: result.cache.notebooks.length }
      } catch (error) {
        return { ok: false, message: '同步失败：' + apiError(error), shelfBooks: 0, notebooks: 0 }
      }
    },
  })
}

/** Shared export request. */
export interface ExportRequest {
  bookId?: string
  dest?: ExportDest
  localDir?: string
  tag?: string
  prompt?: string
  usePrompt?: boolean
  limit?: number
}

/** Export result shape. */
export interface ExportResult {
  ok: boolean
  message: string
  dest: ExportDest
  sent?: number
  file?: string
  pageId?: string
  memoCount?: number
  bookId?: string
}

/**
 * Core export pipeline: pull highlights (+ thoughts), optionally process
 * through the LLM prompt, then deliver to flomo / local file / Notion.
 */
export async function runExport(ctx: ToolContext, req: ExportRequest): Promise<ExportResult> {
  const bookId = (req.bookId ?? '').trim()
  if (bookId === '') return { ok: false, message: '请提供 bookId。', dest: 'flomo' }
  const creds = await ctx.store.load()
  const dest: ExportDest = req.dest === 'local' || req.dest === 'notion' ? req.dest : creds.exportDest

  try {
    const api = await requireApi(ctx)
    const [bookmarks, info, reviews] = await Promise.all([
      api.bookmarklist(bookId),
      api.bookInfo(bookId).catch(() => undefined),
      api.reviewListMine(bookId, 50).catch(() => undefined),
    ])
    const highlights = Array.isArray(bookmarks.updated) ? bookmarks.updated : []
    const thoughts = Array.isArray(reviews?.reviews) ? reviews.reviews : []
    const title = info?.title ?? '未知书名'
    const author = info?.author ?? ''

    if (highlights.length === 0 && thoughts.length === 0) {
      return { ok: false, message: '《' + title + '》暂无划线与想法，未导出。', dest, bookId }
    }

    // limit applies to highlights (0 = all).
    const limit = typeof req.limit === 'number' && Number.isFinite(req.limit)
      ? Math.max(0, Math.floor(req.limit))
      : creds.exportLimit
    const sliceHighlights = limit === 0 || limit >= highlights.length ? highlights : highlights.slice(0, limit)

    // Build the base markdown.
    let content = buildExportMarkdown(title, author, sliceHighlights, thoughts, bookmarks.chapters)

    // Optional LLM prompt processing.
    const usePrompt = typeof req.usePrompt === 'boolean' ? req.usePrompt : creds.usePrompt
    if (usePrompt) {
      const llm = { baseUrl: creds.llmBaseUrl, apiKey: creds.llmApiKey, model: creds.llmModel }
      if (!llmConfigured(llm)) {
        return { ok: false, message: '已启用 prompt 处理但 LLM 未配置：请在设置面板「AI」区填写 API Key / Base URL / 模型，或关闭 prompt 开关。', dest, bookId }
      }
      const template = (req.prompt ?? '').trim() !== '' ? (req.prompt as string) : creds.exportPrompt
      const highlightsText = sliceHighlights.map((h) => '- “' + (h.markText ?? '').trim() + '”').join('\n')
      const thoughtsText = thoughts.map((t) => '- ' + ((t.review?.content ?? '').trim())).join('\n')
      try {
        content = await processWithPrompt(llm, template, { title, author, highlights: highlightsText, thoughts: thoughtsText })
      } catch (error) {
        return { ok: false, message: 'LLM 处理失败：' + apiError(error), dest, bookId }
      }
    }

    // Deliver to the selected destination.
    if (dest === 'local') {
      const dir = (req.localDir ?? '').trim() !== '' ? (req.localDir as string) : creds.localExportDir
      if (dir === '') {
        return { ok: false, message: '本地导出需要提供目录：请填 localDir 参数（或面板导出时填写导出路径）。', dest, bookId }
      }
      const file = await exportToLocal(dir, title, content)
      const scope = sliceHighlights.length === highlights.length ? '全部 ' + highlights.length + ' 条' : sliceHighlights.length + ' 条（共 ' + highlights.length + ' 条）'
      return { ok: true, message: '已导出 ' + scope + ' 划线到本地：' + file, dest, sent: sliceHighlights.length, file, bookId }
    }

    if (dest === 'notion') {
      if (creds.notionToken.trim() === '') {
        return { ok: false, message: 'Notion 未配置：请在设置面板「Notion」区填写 Integration Token（notion.so/my-integrations 创建，页面需分享给该 Integration）。', dest, bookId }
      }
      if (creds.notionTargetPageId.trim() === '') {
        return { ok: false, message: 'Notion 目标页面未配置：请在设置面板「Notion」区填写目标页面 URL 或 ID。', dest, bookId }
      }
      const pageId = await exportToNotion(creds.notionToken, creds.notionTargetPageId, title, content)
      const scope = sliceHighlights.length === highlights.length ? '全部 ' + highlights.length + ' 条' : sliceHighlights.length + ' 条（共 ' + highlights.length + ' 条）'
      return { ok: true, message: '已导出 ' + scope + ' 划线到 Notion 页面：https://www.notion.so/' + pageId, dest, sent: sliceHighlights.length, pageId, bookId }
    }

    // flomo
    const flomoUrl = await resolveFlomoUrl()
    if (flomoUrl === null) {
      return { ok: false, message: 'flomo 未配置：请先在 Web 设置页「Flomo」面板或 flomo_config 配置 API URL / API Key（flomo 设置页 https://flomoapp.com/mine?source=incoming_webhook 获取）。', dest, bookId }
    }
    const tag = (req.tag ?? '').trim() || creds.defaultFlomoTag
    const result = await exportToFlomo(flomoUrl, title, content, tag)
    const scope = sliceHighlights.length === highlights.length ? '全部 ' + highlights.length + ' 条' : sliceHighlights.length + ' 条（共 ' + highlights.length + ' 条）'
    return {
      ok: result.failed === 0,
      message: (result.sent > 0 ? '已导出 ' + scope + ' 划线到 flomo（#' + tag + '）：' + result.message : result.message),
      dest,
      sent: sliceHighlights.length,
      memoCount: result.memoCount,
      bookId,
    }
  } catch (error) {
    return { ok: false, message: '导出失败：' + apiError(error), dest, bookId }
  }
}

/** Multi-target export tool: flomo / local file / Notion + optional prompt. */
export function wereadExportTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_export',
    description: '把微信读书某本书的划线/想法导出到指定目标：dest=flomo（默认，复用「Flomo」面板凭据，超长自动拆多条 MEMO）、dest=local（导出到本地 Markdown 文件，需提供 localDir 目录，每次必填）、dest=notion（用本插件配置的 Notion Token 与目标页面创建子页面）。可按配置 exportLimit 控制条数（0=全部）。若配置 usePrompt（或传 prompt），会先按 prompt 用 LLM 整理内容再导出（AI 配置见设置面板）。tag 仅 flomo 用。',
    parameters: {
      bookId: { type: 'string', required: true, description: '书籍 bookId（来自 weread_shelf / weread_search）' },
      dest: { type: 'string', enum: ['flomo', 'local', 'notion'], description: '导出目标（默认配置 exportDest，通常是 flomo）' },
      localDir: { type: 'string', description: 'dest=local 时必填：本地导出目录（绝对路径）' },
      tag: { type: 'string', description: 'flomo 标签（不带 #，可空格分隔多个）' },
      prompt: { type: 'string', description: '临时覆盖导出 prompt（需配合 usePrompt: true 或配置开启）' },
      usePrompt: { type: 'boolean', description: '本次是否用 LLM 按 prompt 处理后再导出（不填用配置 usePrompt）' },
      limit: { type: 'number', description: '临时覆盖导出条数：0=全部，N>0=最多 N 条（不填用配置 exportLimit）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          dest: { type: 'string' },
          sent: { type: 'number' },
          file: { type: 'string' },
          pageId: { type: 'string' },
          memoCount: { type: 'number' },
          bookId: { type: 'string' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: ExportRequest) {
      return runExport(ctx, args ?? {})
    },
  })
}

/** Flomo tool: convenience wrapper around weread_export with dest=flomo. */
export function wereadFlomoTool(ctx: ToolContext) {
  return defineTool({
    name: 'weread_flomo',
    description: '把微信读书某本书的划线导出到 flomo（浮墨笔记）：发送带 #标签 的 MEMO（书名 + 划线列表）。默认按插件配置的导出条数（exportLimit，见 weread_status / 设置面板；0=全部导出，超长自动拆成多条 MEMO 发送）。limit 参数可临时覆盖（0=全部）。标签可用 tag 参数自定义（不填用插件默认标签）。若配置了 usePrompt，导出前会用 LLM 按 prompt 整理（AI 配置见设置面板）。复用 ~/.dsh/dsh-flomo.json 的 flomo 凭据，无需重复配置。',
    parameters: {
      bookId: { type: 'string', required: true, description: '书籍 bookId（来自 weread_shelf / weread_search）' },
      tag: { type: 'string', description: 'flomo 标签（不带 #，可用空格分隔多个，如 读书笔记 微信读书）' },
      limit: { type: 'number', description: '临时覆盖导出条数：0=全部导出，N>0=最多 N 条（不填用配置 exportLimit）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          sent: { type: 'number' },
          memoCount: { type: 'number' },
          bookId: { type: 'string' },
        },
      },
      render: (_args: unknown, value: Record<string, unknown>) => text(String(value.message ?? '')),
    },
    async execute(args: { bookId?: string; tag?: string; limit?: number }) {
      return runExport(ctx, { ...(args ?? {}), dest: 'flomo' })
    },
  })
}

/** Build every weread tool. */
export function buildTools(ctx: ToolContext) {
  return [
    wereadStatusTool(ctx),
    wereadConfigTool(ctx),
    wereadSearchTool(ctx),
    wereadBookTool(ctx),
    wereadShelfTool(ctx),
    wereadNotesTool(ctx),
    wereadReaddataTool(ctx),
    wereadSyncTool(ctx),
    wereadExportTool(ctx),
    wereadFlomoTool(ctx),
  ]
}
