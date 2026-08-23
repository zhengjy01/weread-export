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
export declare const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
/** Skill version reported on every request (mirrors the weread-skills pack). */
export declare const SKILL_VERSION = "1.0.4";
/** Error surfaced from the gateway (carries an optional errcode). */
export declare class WereadApiError extends Error {
    code?: number;
    constructor(message: string, code?: number);
}
/**
 * WeRead Skills gateway client. All methods resolve parsed payloads and
 * throw WereadApiError for API-level failures.
 */
export declare class WereadApi {
    private readonly apiKey;
    constructor(apiKey: string);
    /**
     * Call one gateway endpoint.
     * @param apiName - interface name, e.g. '/store/search' or '/_list'.
     * @param params - business parameters, flattened at the top level.
     */
    gateway<T = Record<string, unknown>>(apiName: string, params?: Record<string, unknown>): Promise<T>;
    /** List every available endpoint and its parameter definition. */
    list(): Promise<Record<string, unknown>>;
    /** Search the book store. */
    search(keyword: string, count?: number, scope?: number): Promise<SearchResponse>;
    /** Book metadata. */
    bookInfo(bookId: string): Promise<BookInfo>;
    /** Official chapter catalog (metadata only). */
    chapterInfo(bookId: string): Promise<ChapterInfoResponse>;
    /** Reading progress for one book. */
    getProgress(bookId: string): Promise<ProgressResponse>;
    /** The current bookshelf (books + audiobook albums + mp). */
    shelf(): Promise<ShelfResponse>;
    /** Notebook overview: every book with note/review/bookmark counts. */
    notebooks(count?: number, lastSort?: number): Promise<NotebooksResponse>;
    /** Underlines (highlights) for one book. */
    bookmarklist(bookId: string): Promise<BookmarkListResponse>;
    /** Personal thoughts/reviews for one book. */
    reviewListMine(bookid: string, count?: number, synckey?: number): Promise<ReviewListMineResponse>;
    /** Reading statistics. mode: weekly | monthly | annually | overall. */
    readdata(mode: string, baseTime?: number): Promise<ReadDataResponse>;
}
export interface SearchResponse {
    sid?: string;
    /** 1=有更多, 0=无. */
    hasMore?: number | boolean;
    results?: SearchResult[];
}
export interface SearchResult {
    title?: string;
    scope?: number;
    books?: SearchBookEntry[];
}
export interface SearchBookEntry {
    searchIdx?: number;
    bookInfo?: BookInfo;
    newRating?: number;
    newRatingCount?: number;
    readingCount?: number;
    deepLink?: string;
}
export interface BookInfo {
    bookId?: string;
    title?: string;
    author?: string;
    translator?: string;
    cover?: string;
    intro?: string;
    category?: string;
    publisher?: string;
    publishTime?: string;
    isbn?: string;
    wordCount?: number;
    newRating?: number;
    newRatingCount?: number;
    deepLink?: string;
}
export interface ChapterInfoResponse {
    bookId?: string;
    synckey?: number;
    chapterUpdateTime?: number;
    chapters?: Chapter[];
}
export interface Chapter {
    chapterUid?: number;
    chapterIdx?: number;
    title?: string;
    wordCount?: number;
    level?: number;
    updateTime?: number;
    price?: number;
    paid?: boolean;
    isMPChapter?: boolean;
    anchors?: unknown;
}
export interface ProgressResponse {
    bookId?: string;
    book?: ProgressBook;
    timestamp?: number;
}
export interface ProgressBook {
    chapterUid?: number;
    chapterOffset?: number;
    /** 0–100 integer (1 means 1%, not complete). */
    progress?: number;
    updateTime?: number;
    recordReadingTime?: number;
    finishTime?: number;
    isStartReading?: boolean;
}
export interface ShelfResponse {
    books?: ShelfBook[];
    albums?: ShelfAlbum[];
    mp?: unknown;
    archive?: unknown[];
    bookCount?: number;
}
export interface ShelfBook {
    bookId?: string;
    title?: string;
    author?: string;
    cover?: string;
    category?: string;
    readUpdateTime?: number;
    /** 1=读完 (the gateway returns 1/0). */
    finishReading?: boolean | number;
    secret?: boolean | number;
    deepLink?: string;
}
export interface ShelfAlbum {
    albumInfo?: {
        albumId?: string;
        name?: string;
        authorName?: string;
        cover?: string;
        trackCount?: number;
    };
    albumInfoExtra?: {
        secret?: boolean;
    };
}
export interface NotebooksResponse {
    totalBookCount?: number;
    totalNoteCount?: number;
    /** 1=有更多, 0=无. */
    hasMore?: number | boolean;
    books?: NotebookEntry[];
}
export interface NotebookEntry {
    bookId?: string;
    book?: {
        title?: string;
        author?: string;
        cover?: string;
    };
    /** 想法/点评数（划线想法、章节点评、书评等） */
    reviewCount?: number;
    /** 划线数（高亮原文条数） */
    noteCount?: number;
    /** 书签数（仅统计，不导出内容） */
    bookmarkCount?: number;
    readingProgress?: number;
    markedStatus?: number;
    sort?: number;
}
export interface BookmarkListResponse {
    updated?: Highlight[];
    chapters?: Chapter[];
    book?: unknown;
}
export interface Highlight {
    bookmarkId?: string;
    bookId?: string;
    chapterUid?: number;
    markText?: string;
    createTime?: number;
    type?: number;
    range?: string;
    colorStyle?: number;
}
export interface ReviewListMineResponse {
    reviews?: MineReviewEntry[];
    totalCount?: number;
    /** 1=有更多, 0=无. */
    hasMore?: number | boolean;
    synckey?: number;
}
export interface MineReviewEntry {
    review?: {
        reviewId?: string;
        content?: string;
        /** 想法对应的划线原文（划线想法时有值） */
        abstract?: string;
        /** 划线原文位置范围，如 "2959-3007" */
        range?: string;
        chapterUid?: number;
        createTime?: number;
        star?: number;
        chapterName?: string;
        isFinish?: boolean;
    };
}
export interface ReadDataResponse {
    baseTime?: number;
    readTimes?: unknown;
    dailyReadTimes?: unknown;
    readDays?: number;
    totalReadTime?: number;
    dayAverageReadTime?: number;
    compare?: unknown;
    readLongest?: unknown[];
    readStat?: unknown[];
    preferCategory?: unknown[];
    preferTime?: unknown[];
    preferTimeWord?: string;
    preferAuthor?: unknown[];
    /** 文字阅读占比（%），约 wrReadTime/(wrReadTime+wrListenTime)*100 */
    readRate?: number;
    wrReadTime?: number;
    wrListenTime?: number;
    /** 好友排行：{ text, scheme } */
    rank?: unknown;
    yearReport?: unknown;
}
