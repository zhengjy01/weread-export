/**
 * dsh-weread — local sync snapshot & render helpers.
 *
 * weread_sync pulls the bookshelf and the notebook overview into
 * ~/.dsh/dsh-weread-cache.json (mode 0600) so the settings panel and
 * quick actions can render without hammering the gateway. Markdown
 * builders here are shared by the tools and the panel routes.
 */
import type { WereadApi, ShelfBook, NotebookEntry, Highlight, Chapter, MineReviewEntry } from './api.ts';
/** Persistent snapshot shape. */
export interface WereadCache {
    updatedAt: string;
    shelfBooks: ShelfBook[];
    albumsCount: number;
    mpCount: number;
    notebooks: NotebookEntry[];
}
/** Empty snapshot. */
export declare function emptyCache(): WereadCache;
/** Read the snapshot (never throws). */
export declare function readCache(): Promise<WereadCache>;
/** Persist the snapshot (mode 0600). */
export declare function writeCache(next: WereadCache): Promise<void>;
/** Pull shelf + notebooks into the snapshot. */
export declare function doSync(api: WereadApi): Promise<{
    ok: boolean;
    message: string;
    cache: WereadCache;
}>;
/** Unix seconds → 'YYYY-MM-DD' (local); '' for missing values. */
export declare function formatDate(ts?: number): string;
/** Local date label 'YYYY-MM-DD（周X）'. */
export declare function dateLabel(date: Date): string;
/** Seconds → 'X小时Y分钟' / 'N分钟' / 'N秒'. */
export declare function formatDuration(seconds?: number): string;
/** Rating display: the gateway returns a 0-100 score; show as 0-10. */
export declare function formatRating(n?: number): string;
/** Book detail deep link, preferring the service-provided one. */
export declare function deepLink(bookId?: string, provided?: string): string;
/** ChapterUid → title map for note rendering. */
export declare function chapterTitleMap(chapters: Chapter[] | undefined): Map<number, string>;
/** One-line shelf entry. */
export declare function shelfLine(book: ShelfBook, progressByBookId: Map<string, number>): string;
/** Notebook overview lines (笔记数 = 划线 + 想法 + 书签). */
export declare function notebookLines(entries: NotebookEntry[]): string[];
/** Per-book notes markdown: highlights + thoughts. */
export declare function buildNotesMarkdown(title: string, author: string, highlights: Highlight[], thoughts: MineReviewEntry[], chapters: Chapter[] | undefined): string;
/** One flomo memo body for a book's highlights. */
export declare function buildFlomoMemo(title: string, highlights: Highlight[], chapters: Chapter[] | undefined, total: number, limit: number): string;
