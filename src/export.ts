/**
 * weixinread-flomo — unified export targets.
 *
 * One pipeline, three destinations: flomo, local file, Notion page.
 * Highlights (+ thoughts) are rendered to markdown, optionally processed by
 * the configured LLM prompt, then delivered to the selected target. The
 * flomo path reuses the dsh-flomo credentials file; the Notion path uses
 * this plugin's own token + parent page; the local path writes a .md file
 * to a user-supplied directory (no default — the caller must provide it).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Highlight, MineReviewEntry, Chapter } from './api.ts'
import { chapterTitleMap, formatDate } from './cache.ts'
import type { LlmConfig } from './llm.ts'
import { chatComplete, renderPrompt } from './llm.ts'
import { buildFlomoMemos, FLOMO_MAX_CHARS } from './cache.ts'
import { postMemo, buildTaggedContent } from './flomo.ts'

/** Render full export markdown: highlights + thoughts with chapter/time. */
export function buildExportMarkdown(
  title: string,
  author: string,
  highlights: Highlight[],
  thoughts: MineReviewEntry[],
  chapters: Chapter[] | undefined,
): string {
  const chapterMap = chapterTitleMap(chapters)
  const lines: string[] = ['# 《' + title + '》' + (author ? ' · ' + author : '')]
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
  return lines.join('\n') + '\n'
}

/** Run export text through the configured LLM prompt. */
export async function processWithPrompt(
  llm: LlmConfig,
  promptTemplate: string,
  vars: { title: string; author: string; highlights: string; thoughts: string },
): Promise<string> {
  const user = renderPrompt(promptTemplate, vars)
  return chatComplete(llm, '你是读书笔记整理助手，请严格按用户的 prompt 要求输出。', user)
}

/** Write content to <dir>/<title>.md; creates the directory. */
export async function exportToLocal(dir: string, title: string, content: string): Promise<string> {
  const targetDir = dir.trim()
  if (targetDir === '') throw new Error('本地导出需要填写目标目录（不设默认值）。')
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || '未命名'
  await mkdir(targetDir, { recursive: true })
  const file = path.join(targetDir, safe + '.md')
  await writeFile(file, content, 'utf8')
  return file
}

/* ------------------------------------------------------------------ */
/* Notion                                                                */
/* ------------------------------------------------------------------ */

/** Notion REST base URL. */
export const NOTION_API = 'https://api.notion.com'
/** API version header (covers every endpoint used here). */
export const NOTION_VERSION = '2022-06-28'
/** Notion allows at most 100 blocks per create/append call. */
const NOTION_BLOCKS_PER_CALL = 100

/** Normalize a Notion page URL / id to the 32-char page id. */
export function normalizeNotionPageId(input: string): string {
  const value = input.trim()
  if (value === '') throw new Error('请填写 Notion 目标页面 URL 或 ID。')
  // URL forms: https://www.notion.so/<workspace>/<32hex>?..., /<32hex>?..., xxx-xxxx...
  const hex = value.match(/[0-9a-f]{32}/i)
  if (hex) return hex[0].toLowerCase()
  const compact = value.replace(/-/g, '')
  if (/^[0-9a-f]{32}$/i.test(compact)) return compact.toLowerCase()
  throw new Error('无法识别 Notion 页面 ID：请粘贴页面链接或 32 位页面 ID。')
}

/** Split markdown text into Notion paragraph blocks. */
export function toNotionBlocks(content: string): Array<Record<string, unknown>> {
  const lines = content.split('\n').map((l) => l.trimEnd())
  const blocks: Array<Record<string, unknown>> = []
  for (const line of lines) {
    if (line === '') continue
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: line.slice(0, 2000) } }],
      },
    })
  }
  return blocks
}

/** One Notion API call with normalized errors. */
async function notionCall(token: string, method: string, apiPath: string, body: unknown): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(NOTION_API + apiPath, {
      method,
      headers: {
        'Authorization': 'Bearer ' + token.trim(),
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new Error('Notion 请求失败（网络错误）: ' + String(error instanceof Error ? error.message : error))
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Notion 返回了无法解析的响应（HTTP ' + response.status + '）')
  }
  if (!response.ok) {
    const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
    const message = typeof record.message === 'string' ? record.message : 'HTTP ' + response.status
    throw new Error('Notion API 错误: ' + message)
  }
  return (typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {})
}

/**
 * Create a child page under the target parent page with the export content,
 * appending extra blocks in batches if needed.
 */
export async function exportToNotion(
  token: string,
  parentId: string,
  title: string,
  content: string,
): Promise<string> {
  if (token.trim() === '') throw new Error('Notion 未配置：请先在设置面板「Notion」区填写 Integration Token。')
  const pageId = normalizeNotionPageId(parentId)
  const blocks = toNotionBlocks(content)
  const children = blocks.slice(0, NOTION_BLOCKS_PER_CALL)
  const created = await notionCall(token, 'POST', '/v1/pages', {
    parent: { page_id: pageId },
    properties: {
      title: { title: [{ text: { content: title.slice(0, 200) } }] },
    },
    children,
  })
  const newPageId = typeof created.id === 'string' ? created.id : ''
  // Append remaining blocks (beyond the first 100) via the blocks endpoint.
  for (let offset = NOTION_BLOCKS_PER_CALL; offset < blocks.length; offset += NOTION_BLOCKS_PER_CALL) {
    const batch = blocks.slice(offset, offset + NOTION_BLOCKS_PER_CALL)
    await notionCall(token, 'PATCH', '/v1/blocks/' + newPageId + '/children', { children: batch })
  }
  return newPageId
}

/* ------------------------------------------------------------------ */
/* Flomo                                                                */
/* ------------------------------------------------------------------ */

/** Send text to flomo, chunking by size (never truncates). */
export async function exportToFlomo(
  flomoUrl: string,
  title: string,
  content: string,
  tag: string,
): Promise<{ sent: number; memoCount: number; failed: number; message: string }> {
  const memos = chunkText(content, FLOMO_MAX_CHARS, title)
  let sent = 0
  let failed = 0
  for (const memo of memos) {
    const result = await postMemo(flomoUrl, buildTaggedContent(memo, tag))
    if (result.ok) sent += 1
    else failed += 1
  }
  const message = sent > 0
    ? '已导出到 flomo（#' + tag + '）：' + sent + ' 条 MEMO 发送成功' + (failed > 0 ? '，' + failed + ' 条失败' : '') + '。'
    : 'flomo 发送失败：全部 ' + memos.length + ' 条 MEMO 发送失败'
  return { sent, memoCount: memos.length, failed, message }
}

/** Split arbitrary text into size-capped chunks with a small header. */
export function chunkText(text: string, maxChars: number, title: string): string[] {
  const header = '📖《' + title + '》'
  const memos: string[] = []
  let current = header
  const lines = text.split('\n')
  for (const line of lines) {
    if (current.length + 1 + line.length > maxChars && current !== header) {
      memos.push(current)
      current = header + '（续）'
    }
    current += '\n' + line
  }
  memos.push(current)
  return memos
}
