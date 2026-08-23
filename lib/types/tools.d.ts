/**
 * weread-export — model-facing tools.
 *
 * Mounted via ctx.tools.register. Covers the WeRead surface: status,
 * config, search, book info, shelf, notes/highlights, reading stats,
 * cache sync, and multi-target export (flomo / local file / Notion) with
 * optional LLM prompt processing. Every tool resolves to { ok, message, ... }
 * and never throws for API-level outcomes.
 */
import type { WereadStore } from './store.ts';
import type { ExportDest } from './store.ts';
/** Shared tool dependencies. */
export interface ToolContext {
    store: WereadStore;
}
/** Status tool: configuration + cache + export targets. */
export declare function wereadStatusTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Config tool: set/clear the API key, default flomo tag, and export limit. */
export declare function wereadConfigTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Search tool: book store search. */
export declare function wereadSearchTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Book tool: metadata + progress + chapter catalog summary. */
export declare function wereadBookTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Shelf tool: live bookshelf (optionally from cache). */
export declare function wereadShelfTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Notes tool: notebook overview or per-book highlights + thoughts. */
export declare function wereadNotesTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Readdata tool: reading statistics. */
export declare function wereadReaddataTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Sync tool: pull shelf + notebooks into the local cache. */
export declare function wereadSyncTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Shared export request. */
export interface ExportRequest {
    bookId?: string;
    dest?: ExportDest;
    localDir?: string;
    tag?: string;
    prompt?: string;
    usePrompt?: boolean;
    limit?: number;
}
/** Export result shape. */
export interface ExportResult {
    ok: boolean;
    message: string;
    dest: ExportDest;
    sent?: number;
    file?: string;
    pageId?: string;
    memoCount?: number;
    bookId?: string;
}
/**
 * Core export pipeline: pull highlights (+ thoughts), optionally process
 * through the LLM prompt, then deliver to flomo / local file / Notion.
 */
export declare function runExport(ctx: ToolContext, req: ExportRequest): Promise<ExportResult>;
/** Multi-target export tool: flomo / local file / Notion + optional prompt. */
export declare function wereadExportTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Flomo tool: convenience wrapper around weread_export with dest=flomo. */
export declare function wereadFlomoTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Build every weread tool. */
export declare function buildTools(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition[];
