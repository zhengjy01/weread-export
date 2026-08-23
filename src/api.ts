/**
 * weixinread-flomo — WeRead Skills Agent Gateway client.
 *
 * Official interface: POST https://i.weread.qq.com/api/agent/gateway with
 * `Authorization: Bearer <wrk-...>`; the body carries `api_name`,
 * `skill_version` and business parameters flattened at the top level.
 * Responses are field-trimmed by the service; `errcode !== 0` means an
 * error with a Chinese message, and an `upgrade_info` field means the
 * client's skill_version is stale and must be bumped.
 *
 * API key acquisition: open https://weread.qq.com/r/weread-skills, log in
 * with your WeRead account, click 创建 Key, copy the wrk- key.
 */

/** Gateway endpoint. */
export const WEREAD_GATEWAY = 'https://i.weread.qq.com/api/agent/gateway'

/** Skill version reported on every request (mirrors the weread-skills pack). */
export const SKILL_VERSION = '1.0.4'

/** Request timeout for a gateway call. */
const REQUEST_TIMEOUT_MS = 20000

/** Error surfaced from the gateway (carries an optional errcode). */
export class WereadApiError extends Error {
  code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.name = 'WereadApiError'
    this.code = code
  }
}

/** Minimal upgrade instruction shape. */
interface UpgradeInfo {
  message?: unknown
}

/** Parse an unknown gateway payload into a record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * WeRead Skills gateway client. All methods resolve parsed payloads and
 * throw WereadApiError for API-level failures.
 */
export class WereadApi {
  constructor(private readonly apiKey: string) {}

  /**
   * Call one gateway endpoint.
   * @param apiName - interface name, e.g. '/store/search' or '/_list'.
   * @param params - business parameters, flattened at the top level.
   */
  async gateway<T = Record<string, unknown>>(apiName: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.apiKey.trim() === '') {
      throw new WereadApiError('未配置微信读书 API Key：请先调用 weread_config 配置（在 https://weread.qq.com/r/weread-skills 登录后创建 Key）。')
    }
    let response: Response
    try {
      response = await fetch(WEREAD_GATEWAY, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.apiKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_name: apiName, skill_version: SKILL_VERSION, ...params }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new WereadApiError('请求微信读书失败（网络错误）: ' + String(error instanceof Error ? error.message : error))
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new WereadApiError('微信读书返回了无法解析的响应（HTTP ' + response.status + '）')
    }
    if (!response.ok) {
      throw new WereadApiError('微信读书请求失败（HTTP ' + response.status + '）')
    }

    const record = asRecord(payload)
    const upgrade = record.upgrade_info
    if (upgrade !== undefined) {
      const message = asRecord(upgrade).message
      const detail = typeof message === 'string' ? message : JSON.stringify(upgrade)
      throw new WereadApiError('微信读书 Skills 需要升级，请先完成升级再继续：' + detail)
    }
    const errcode = record.errcode
    if (typeof errcode === 'number' && errcode !== 0) {
      const message = typeof record.errmsg === 'string' ? record.errmsg
        : (typeof record.message === 'string' ? record.message : '未知错误')
      throw new WereadApiError(message, errcode)
    }
    return payload as T
  }

  /** List every available endpoint and its parameter definition. */
  list(): Promise<Record<string, unknown>> {
    return this.gateway('/_list')
  }

  /** Search the book store. */
  search(keyword: string, count = 10, scope?: number): Promise<SearchResponse> {
    return this.gateway<SearchResponse>('/store/search', { keyword, count, ...(scope !== undefined ? { scope } : {}) })
  }

  /** Book metadata. */
  bookInfo(bookId: string): Promise<BookInfo> {
    return this.gateway<BookInfo>('/book/info', { bookId })
  }

  /** Official chapter catalog (metadata only). */
  chapterInfo(bookId: string): Promise<ChapterInfoResponse> {
    return this.gateway<ChapterInfoResponse>('/book/chapterinfo', { bookId })
  }

  /** Reading progress for one book. */
  getProgress(bookId: string): Promise<ProgressResponse> {
    return this.gateway<ProgressResponse>('/book/getprogress', { bookId })
  }

  /** The current bookshelf (books + audiobook albums + mp). */
  shelf(): Promise<ShelfResponse> {
    return this.gateway<ShelfResponse>('/shelf/sync')
  }

  /** Notebook overview: every book with note/review/bookmark counts. */
  notebooks(count = 50, lastSort?: number): Promise<NotebooksResponse> {
    return this.gateway<NotebooksResponse>('/user/notebooks', { count, ...(lastSort !== undefined ? { lastSort } : {}) })
  }

  /** Underlines (highlights) for one book. */
  bookmarklist(bookId: string): Promise<BookmarkListResponse> {
    return this.gateway<BookmarkListResponse>('/book/bookmarklist', { bookId })
  }

  /** Personal thoughts/reviews for one book. */
  reviewListMine(bookid: string, count = 50, synckey?: number): Promise<ReviewListMineResponse> {
    return this.gateway<ReviewListMineResponse>('/review/list/mine', {
      bookid,
      count,
      ...(synckey !== undefined ? { synckey } : {}),
    })
  }

  /** Reading statistics. mode: weekly | monthly | annually | overall. */
  readdata(mode: string, baseTime?: number): Promise<ReadDataResponse> {
    return this.gateway<ReadDataResponse>('/readdata/detail', {
      mode,
      ...(baseTime !== undefined ? { baseTime } : {}),
    })
  }
}

/* ------------------------------------------------------------------ */
/* Response shapes (fields are trimmed by the service; accessors below  */
/* are defensive about nesting).                                       */
/* ------------------------------------------------------------------ */

export interface SearchResponse {
  sid?: string
  /** 1=有更多, 0=无. */
  hasMore?: number | boolean
  results?: SearchResult[]
}

export interface SearchResult {
  title?: string
  scope?: number
  books?: SearchBookEntry[]
}

export interface SearchBookEntry {
  searchIdx?: number
  bookInfo?: BookInfo
  newRating?: number
  newRatingCount?: number
  readingCount?: number
  deepLink?: string
}

export interface BookInfo {
  bookId?: string
  title?: string
  author?: string
  translator?: string
  cover?: string
  intro?: string
  category?: string
  publisher?: string
  publishTime?: string
  isbn?: string
  wordCount?: number
  newRating?: number
  newRatingCount?: number
  deepLink?: string
}

export interface ChapterInfoResponse {
  bookId?: string
  synckey?: number
  chapterUpdateTime?: number
  chapters?: Chapter[]
}

export interface Chapter {
  chapterUid?: number
  chapterIdx?: number
  title?: string
  wordCount?: number
  level?: number
  updateTime?: number
  price?: number
  paid?: boolean
  isMPChapter?: boolean
  anchors?: unknown
}

export interface ProgressResponse {
  bookId?: string
  book?: ProgressBook
  timestamp?: number
}

export interface ProgressBook {
  chapterUid?: number
  chapterOffset?: number
  /** 0–100 integer (1 means 1%, not complete). */
  progress?: number
  updateTime?: number
  recordReadingTime?: number
  finishTime?: number
  isStartReading?: boolean
}

export interface ShelfResponse {
  books?: ShelfBook[]
  albums?: ShelfAlbum[]
  mp?: unknown
  archive?: unknown[]
  bookCount?: number
}

export interface ShelfBook {
  bookId?: string
  title?: string
  author?: string
  cover?: string
  category?: string
  readUpdateTime?: number
  /** 1=读完 (the gateway returns 1/0). */
  finishReading?: boolean | number
  secret?: boolean | number
  deepLink?: string
}

export interface ShelfAlbum {
  albumInfo?: {
    albumId?: string
    name?: string
    authorName?: string
    cover?: string
    trackCount?: number
  }
  albumInfoExtra?: { secret?: boolean }
}

export interface NotebooksResponse {
  totalBookCount?: number
  totalNoteCount?: number
  /** 1=有更多, 0=无. */
  hasMore?: number | boolean
  books?: NotebookEntry[]
}

export interface NotebookEntry {
  bookId?: string
  book?: { title?: string; author?: string; cover?: string }
  /** 想法/点评数（划线想法、章节点评、书评等） */
  reviewCount?: number
  /** 划线数（高亮原文条数） */
  noteCount?: number
  /** 书签数（仅统计，不导出内容） */
  bookmarkCount?: number
  readingProgress?: number
  markedStatus?: number
  sort?: number
}

export interface BookmarkListResponse {
  updated?: Highlight[]
  chapters?: Chapter[]
  book?: unknown
}

export interface Highlight {
  bookmarkId?: string
  bookId?: string
  chapterUid?: number
  markText?: string
  createTime?: number
  type?: number
  range?: string
  colorStyle?: number
}

export interface ReviewListMineResponse {
  reviews?: MineReviewEntry[]
  totalCount?: number
  /** 1=有更多, 0=无. */
  hasMore?: number | boolean
  synckey?: number
}

export interface MineReviewEntry {
  review?: {
    reviewId?: string
    content?: string
    /** 想法对应的划线原文（划线想法时有值） */
    abstract?: string
    /** 划线原文位置范围，如 "2959-3007" */
    range?: string
    chapterUid?: number
    createTime?: number
    star?: number
    chapterName?: string
    isFinish?: boolean
  }
}

export interface ReadDataResponse {
  baseTime?: number
  readTimes?: unknown
  dailyReadTimes?: unknown
  readDays?: number
  totalReadTime?: number
  dayAverageReadTime?: number
  compare?: unknown
  readLongest?: unknown[]
  readStat?: unknown[]
  preferCategory?: unknown[]
  preferTime?: unknown[]
  preferTimeWord?: string
  preferAuthor?: unknown[]
  /** 文字阅读占比（%），约 wrReadTime/(wrReadTime+wrListenTime)*100 */
  readRate?: number
  wrReadTime?: number
  wrListenTime?: number
  /** 好友排行：{ text, scheme } */
  rank?: unknown
  yearReport?: unknown
}
