/**
 * weread-export — 微信读书 (WeChat Reading) integration for DeepSeek Harness.
 * Host half.
 *
 * Mounts the weread tools (status / config / search / book / shelf / notes /
 * readdata / sync / flomo), the /api/weread-export route family the settings
 * panel talks to, and a system-prompt announcement. Data rides the official
 * WeRead Skills Agent Gateway (i.weread.qq.com/api/agent/gateway) with a
 * user-bound wrk- API key created at https://weread.qq.com/r/weread-skills.
 * The key lives in ~/.dsh/weread-export.json (mode 0600) and the sync snapshot
 * in ~/.dsh/weread-export-cache.json. Tools and routes build the API client
 * lazily from the store, so a key configured later takes effect immediately.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { WereadStore } from './store.ts'
import { buildTools } from './tools.ts'
import { makeRoutes, type NativeDirectoryPicker } from './routes.ts'

/** Stable cordis plugin name. */
export const name = 'weread'

/** Services required before the weread surfaces can mount. */
export const inject = ['tools', 'systemPrompt', 'webServer']

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 160

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const WEREAD_GUIDANCE =
  '本机已安装 weread-export 插件（微信读书集成）：配置一次官方 Skills API Key（wrk- 开头，在 https://weread.qq.com/r/weread-skills 用微信读书账号登录后「创建 Key」获取）后，' +
  '可用 weread_shelf 查看书架、weread_notes 导出划线/想法/书签（不给 bookId 时返回笔记本概览）、weread_search 搜索书城、weread_book 查看书籍详情/进度/章节、' +
  'weread_readdata 查看阅读统计（weekly/monthly/annually/overall）、weread_sync 同步本地缓存。' +
  '导出：weread_export 支持三个目标——flomo（默认，超长自动拆多条 MEMO）、local（本地 Markdown 文件，需 localDir）、notion（本插件独立配置 Token 与目标页）；weread_flomo 是 flomo 快捷方式。' +
  '可按配置 exportLimit 控制条数（0=全部），并可用 usePrompt/exportPrompt 让 LLM 按自定义 prompt 整理后再导出（AI 配置在设置面板，OpenAI 兼容，可自定义 Base URL/Key/模型）。' +
  '凭据存 ~/.dsh/weread-export.json（权限 0600），同步快照存 ~/.dsh/weread-export-cache.json；weread_status 查看状态与导出配置（不回显完整 Key）。' +
  '也可在 Web 设置页「微信读书」面板中配置 Key、导出目标（flomo/本地/Notion）、导出条数、prompt 与 AI 配置、测试连接、同步与快捷导出。' +
  '用户提到「微信读书 / weread / 读书笔记 / 导出划线 / 阅读统计」时即指本插件，请据此协作。'

/** Plugin config, read from the composition row. */
export interface Config {
  /** When true (default), a system-prompt section announces the plugin. */
  announceToAgent?: boolean
  /** Master switch for the plugin (routes, tools, prompt section). */
  enabled?: boolean
}

/**
 * Mount the weread tools, routes, and announcement.
 * @param ctx - host plugin context carrying tools/systemPrompt/webServer.
 * @param config - plugin config from the composition row.
 */
export function apply(ctx: Context, config?: Config): void {
  const announceToAgent = config?.announceToAgent !== false
  const enabled = config?.enabled !== false
  const store = new WereadStore()

  const toolContext = { store }

  let disposeTools: (() => void) | undefined
  let disposeRoutes: (() => void) | undefined
  let disposeSection: (() => void) | undefined

  const sync = (): void => {
    if (disposeTools !== undefined) {
      disposeTools()
      disposeTools = undefined
    }
    if (disposeRoutes !== undefined) {
      disposeRoutes()
      disposeRoutes = undefined
    }
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    if (!enabled) return

    disposeTools = ctx.effect(
      () => {
        const disposers = buildTools(toolContext).map((tool) => ctx.tools.register(tool))
        return () => { for (const dispose of disposers) dispose() }
      },
      'weread-export: tools',
    )
    disposeRoutes = ctx.effect(
      () => {
        // The directory picker is optional (hosts without the service fall
        // back to manual path input); grab it defensively.
        let picker: NativeDirectoryPicker | undefined
        try {
          picker = (ctx as unknown as { directoryPicker?: NativeDirectoryPicker }).directoryPicker
        } catch {
          picker = undefined
        }
        const disposers = makeRoutes({ store, directoryPicker: picker }).map((route) => ctx.webServer.register(route))
        return () => { for (const dispose of disposers) dispose() }
      },
      'weread-export: routes',
    )
    if (announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:weread-export',
        order: SECTION_ORDER,
        text: WEREAD_GUIDANCE,
      })
    }
  }

  sync()
}

/** Re-exports for host consumers and smoke tests. */
export { WereadStore, mask, configPath, cachePath, DEFAULT_EXPORT_PROMPT, type WereadConfigView, type WereadCredentials, type ExportDest } from './store.ts'
export { WereadApi, WereadApiError, WEREAD_GATEWAY, SKILL_VERSION, type BookInfo, type ShelfBook, type NotebookEntry, type Highlight, type MineReviewEntry } from './api.ts'
export { wereadStatusTool, wereadConfigTool, wereadSearchTool, wereadBookTool, wereadShelfTool, wereadNotesTool, wereadReaddataTool, wereadSyncTool, wereadExportTool, wereadFlomoTool, runExport, buildTools, type ToolContext, type ExportRequest, type ExportResult } from './tools.ts'
export { doSync, readCache, writeCache, emptyCache, buildNotesMarkdown, buildFlomoMemo, buildFlomoMemos, FLOMO_MAX_CHARS, formatDate, formatDuration, formatRating, dateLabel, deepLink, shelfLine, notebookLines, type WereadCache } from './cache.ts'
export { resolveFlomoUrl, flomoConfigured, flomoStatus, readFlomoCredentials, writeFlomoCredentials, postMemo, buildTaggedContent, FLOMO_CONFIG_FILE, type FlomoStatusView, type FlomoCredentials } from './flomo.ts'
export { chatComplete, renderPrompt, llmConfigured, type LlmConfig } from './llm.ts'
export { buildExportMarkdown, processWithPrompt, exportToLocal, exportToNotion, exportToFlomo, chunkText, toNotionBlocks, normalizeNotionPageId, NOTION_API, NOTION_VERSION } from './export.ts'
export { makeRoutes, WEREAD_API } from './routes.ts'
export { defineTool }
