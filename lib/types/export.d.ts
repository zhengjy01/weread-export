/**
 * weread-export — unified export targets.
 *
 * One pipeline, three destinations: flomo, local file, Notion page.
 * Highlights (+ thoughts) are rendered to markdown, optionally processed by
 * the configured LLM prompt, then delivered to the selected target. The
 * flomo path reuses the dsh-flomo credentials file; the Notion path uses
 * this plugin's own token + parent page; the local path writes a .md file
 * to a user-supplied directory (no default — the caller must provide it).
 */
import type { Highlight, MineReviewEntry, Chapter } from './api.ts';
import type { LlmConfig } from './llm.ts';
/** Render full export markdown: highlights + thoughts with chapter/time. */
export declare function buildExportMarkdown(title: string, author: string, highlights: Highlight[], thoughts: MineReviewEntry[], chapters: Chapter[] | undefined): string;
/** Run export text through the configured LLM prompt. */
export declare function processWithPrompt(llm: LlmConfig, promptTemplate: string, vars: {
    title: string;
    author: string;
    highlights: string;
    thoughts: string;
}): Promise<string>;
/** Write content to <dir>/<title>.md; creates the directory. */
export declare function exportToLocal(dir: string, title: string, content: string): Promise<string>;
/** Notion REST base URL. */
export declare const NOTION_API = "https://api.notion.com";
/** API version header (covers every endpoint used here). */
export declare const NOTION_VERSION = "2022-06-28";
/** Normalize a Notion page URL / id to the 32-char page id. */
export declare function normalizeNotionPageId(input: string): string;
/** Split markdown text into Notion paragraph blocks. */
export declare function toNotionBlocks(content: string): Array<Record<string, unknown>>;
/**
 * Create a child page under the target parent page with the export content,
 * appending extra blocks in batches if needed.
 */
export declare function exportToNotion(token: string, parentId: string, title: string, content: string): Promise<string>;
/** Send text to flomo, chunking by size (never truncates). */
export declare function exportToFlomo(flomoUrl: string, title: string, content: string, tag: string): Promise<{
    sent: number;
    memoCount: number;
    failed: number;
    message: string;
}>;
/** Split arbitrary text into size-capped chunks with a small header. */
export declare function chunkText(text: string, maxChars: number, title: string): string[];
