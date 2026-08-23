/**
 * weixinread-flomo — local sync snapshot & render helpers.
 *
 * weread_sync pulls the bookshelf and the notebook overview into
 * ~/.dsh/weixinread-flomo-cache.json (mode 0600) so the settings panel and
 * quick actions can render without hammering the gateway. Markdown
 * builders here are shared by the tools and the panel routes.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { WereadApi, ShelfBook, NotebookEntry, Highlight, Chapter, MineReviewEntry } from './api.ts'
import { cachePath } from './store.ts'

/** Persistent snapshot shape. */
export interface WereadCache {
  updatedAt: string
  shelfBooks: ShelfBook[]
  albumsCount: number
  mpCount: number
  notebooks: NotebookEntry[]
}

/** Empty snapshot. */
export function emptyCache(): WereadCache {
  return { updatedAt: '', shelfBooks: [], albumsCount: 0, mpCount: 0, notebooks: [] }
}

/** Read the snapshot (never throws). */
export async function readCache(): Promise<WereadCache> {
  try {
    const raw = await readFile(cachePath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const record = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
    const books = Array.isArray(record.shelfBooks) ? record.shelfBooks as ShelfBook[] : []
    const notebooks = Array.isArray(record.notebooks) ? record.notebooks as NotebookEntry[] : []
    return {
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
      shelfBooks: books,
      albumsCount: typeof record.albumsCount === 'number' ? record.albumsCount : 0,
      mpCount: typeof record.mpCount === 'number' ? record.mpCount : 0,
      notebooks,
    }
  } catch {
    return emptyCache()
  }
}

/** Persist the snapshot (mode 0600). */
export async function writeCache(next: WereadCache): Promise<void> {
  await mkdir(path.dirname(cachePath()), { recursive: true })
  await writeFile(cachePath(), JSON.stringify(next, null, 2), { mode: 0o600 })
}

/** Pull shelf + notebooks into the snapshot. */
export async function doSync(api: WereadApi): Promise<{ ok: boolean; message: string; cache: WereadCache }> {
  const [shelf, notebooksFirst] = await Promise.all([
    api.shelf(),
    api.notebooks(200),
  ])
  const books = Array.isArray(shelf.books) ? shelf.books : []
  const albums = Array.isArray(shelf.albums) ? shelf.albums : []
  const mpCount = shelf.mp !== undefined && shelf.mp !== null ? 1 : 0

  // Page through the notebook overview (cap at 5 pages).
  const entries = [...(Array.isArray(notebooksFirst.books) ? notebooksFirst.books : [])]
  let lastSort = entries.length > 0 ? (entries[entries.length - 1]?.sort ?? undefined) : undefined
  let hasMore = notebooksFirst.hasMore === true || notebooksFirst.hasMore === 1
  let page = 1
  while (hasMore && page < 5 && lastSort !== undefined) {
    const next = await api.notebooks(200, lastSort)
    const nextBooks = Array.isArray(next.books) ? next.books : []
    if (nextBooks.length === 0) break
    entries.push(...nextBooks)
    lastSort = nextBooks[nextBooks.length - 1]?.sort ?? lastSort
    hasMore = next.hasMore === true || next.hasMore === 1
    page += 1
  }

  const cache: WereadCache = {
    updatedAt: new Date().toISOString(),
    shelfBooks: books,
    albumsCount: albums.length,
    mpCount,
    notebooks: entries,
  }
  await writeCache(cache)
  const noteBooks = entries.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0)
  return {
    ok: true,
    message:
      '同步完成：书架 ' + books.length + ' 本书' +
      (albums.length > 0 ? '、有声书 ' + albums.length + ' 部' : '') +
      (mpCount > 0 ? '、公众号 1 个' : '') +
      '；有笔记的书 ' + noteBooks.length + ' 本（笔记/想法/书签共 ' + String(notebooksFirst.totalNoteCount ?? '?') + ' 条）。',
    cache,
  }
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** Unix seconds → 'YYYY-MM-DD' (local); '' for missing values. */
export function formatDate(ts?: number): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** Local date label 'YYYY-MM-DD（周X）'. */
export function dateLabel(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    '（周' + WEEKDAYS[date.getDay()] + '）'
  )
}

/** Seconds → 'X小时Y分钟' / 'N分钟' / 'N秒'. */
export function formatDuration(seconds?: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '0分钟'
  const total = Math.round(seconds)
  if (total < 60) return total + '秒'
  if (total < 3600) return Math.floor(total / 60) + '分钟'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return m > 0 ? h + '小时' + m + '分钟' : h + '小时'
}

/** Rating display: the gateway returns a 0-100 score; show as 0-10. */
export function formatRating(n?: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return ''
  const value = n > 10 ? n / 10 : n
  return value.toFixed(1)
}

/** Book detail deep link, preferring the service-provided one. */
export function deepLink(bookId?: string, provided?: string): string {
  if (typeof provided === 'string' && provided !== '') return provided
  if (typeof bookId === 'string' && bookId !== '') return 'https://weread.qq.com/web/bookDetail/' + bookId
  return ''
}

/** ChapterUid → title map for note rendering. */
export function chapterTitleMap(chapters: Chapter[] | undefined): Map<number, string> {
  const map = new Map<number, string>()
  if (Array.isArray(chapters)) {
    for (const chapter of chapters) {
      if (typeof chapter.chapterUid === 'number' && typeof chapter.title === 'string') {
        map.set(chapter.chapterUid, chapter.title)
      }
    }
  }
  return map
}

/** One-line shelf entry. */
export function shelfLine(book: ShelfBook, progressByBookId: Map<string, number>): string {
  const progress = progressByBookId.get(book.bookId ?? '')
  const finished = book.finishReading === true || book.finishReading === 1
  const progressText = typeof progress === 'number' && progress > 0 && progress < 100
    ? ' 在读 ' + progress + '%'
    : (progress === 100 || finished ? ' 已读完' : '')
  const time = formatDate(book.readUpdateTime)
  const timeText = time !== '' ? '（更新于 ' + time + '）' : ''
  return '- 《' + (book.title ?? '未知书名') + '》· ' + (book.author ?? '未知作者') + progressText + timeText
}

/** Notebook overview lines (笔记数 = 划线 + 想法 + 书签). */
export function notebookLines(entries: NotebookEntry[]): string[] {
  const lines: string[] = []
  for (const entry of entries) {
    const review = entry.reviewCount ?? 0
    const note = entry.noteCount ?? 0
    const bookmark = entry.bookmarkCount ?? 0
    const total = review + note + bookmark
    if (total <= 0) continue
    lines.push(
      '- 《' + (entry.book?.title ?? entry.bookId ?? '未知书名') + '》：共 ' + total + ' 条（划线 ' + note + ' · 想法 ' + review + ' · 书签 ' + bookmark + '）' +
      (typeof entry.readingProgress === 'number' && entry.readingProgress > 0 ? ' · 进度 ' + entry.readingProgress + '%' : ''),
    )
  }
  return lines
}

/** Per-book notes markdown: highlights + thoughts. */
export function buildNotesMarkdown(
  title: string,
  author: string,
  highlights: Highlight[],
  thoughts: MineReviewEntry[],
  chapters: Chapter[] | undefined,
): string {
  const chapterMap = chapterTitleMap(chapters)
  const lines: string[] = ['📖 《' + title + '》' + (author ? ' · ' + author : '')]
  if (highlights.length > 0) {
    lines.push('', '## 划线 ' + highlights.length + ' 条')
    for (const h of highlights) {
      const chapter = typeof h.chapterUid === 'number' ? chapterMap.get(h.chapterUid) : undefined
      const time = formatDate(h.createTime)
      lines.push('- “' + (h.markText ?? '').trim() + '”' + (chapter ? '（' + chapter + '）' : '') + (time !== '' ? ' · ' + time : ''))
    }
  }
  if (thoughts.length > 0) {
    lines.push('', '## 想法 ' + thoughts.length + ' 条')
    for (const entry of thoughts) {
      const review = entry.review
      if (!review) continue
      const chapter = review.chapterName ?? ''
      const time = formatDate(review.createTime)
      const abstract = (review.abstract ?? '').trim()
      const abstractText = abstract !== '' && abstract !== review.content ? '\n  > 原文：' + abstract : ''
      lines.push('- ' + (review.content ?? '').trim() + abstractText + (chapter ? '（' + chapter + '）' : '') + (time !== '' ? ' · ' + time : ''))
    }
  }
  if (highlights.length === 0 && thoughts.length === 0) {
    lines.push('（这本书暂无划线与想法）')
  }
  return lines.join('\n')
}

/** One flomo memo body for a book's highlights (truncated at `limit`). */
export function buildFlomoMemo(
  title: string,
  highlights: Highlight[],
  chapters: Chapter[] | undefined,
  total: number,
  limit: number,
): string {
  const chapterMap = chapterTitleMap(chapters)
  const lines: string[] = ['📖《' + title + '》划线摘录 · 共 ' + total + ' 条']
  for (const h of highlights.slice(0, limit)) {
    const chapter = typeof h.chapterUid === 'number' ? chapterMap.get(h.chapterUid) : undefined
    lines.push('- “' + (h.markText ?? '').trim() + '”' + (chapter ? '（' + chapter + '）' : ''))
  }
  if (total > limit) lines.push('…（共 ' + total + ' 条，仅导出前 ' + limit + ' 条）')
  return lines.join('\n')
}

/** Safe per-memo size cap (flomo does not document a hard limit; stay conservative). */
export const FLOMO_MAX_CHARS = 1800

/**
 * Split a book's highlights into one or more flomo memo bodies so that
 * ALL highlights are exported — long lists are chunked by character count,
 * never truncated. A single over-long highlight becomes its own memo.
 */
export function buildFlomoMemos(
  title: string,
  highlights: Highlight[],
  chapters: Chapter[] | undefined,
  maxChars = FLOMO_MAX_CHARS,
): string[] {
  const chapterMap = chapterTitleMap(chapters)
  const header = '📖《' + title + '》划线摘录 · 共 ' + highlights.length + ' 条'
  const memos: string[] = []
  let current = header
  for (const h of highlights) {
    const chapter = typeof h.chapterUid === 'number' ? chapterMap.get(h.chapterUid) : undefined
    const line = '- “' + (h.markText ?? '').trim() + '”' + (chapter ? '（' + chapter + '）' : '')
    if (current.length + 1 + line.length > maxChars && current !== header) {
      memos.push(current)
      current = header + '（续）'
    }
    current += '\n' + line
  }
  memos.push(current)
  return memos
}
