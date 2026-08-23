/**
 * WeRead settings panel — rendered inside the web settings page
 * (settings.section entry). Connection setup (Skills API key), export
 * preferences (destination flomo/local/Notion, per-export limit, local dir,
 * Notion token + target page, LLM prompt processing with a user-editable
 * template), manual sync, and a quick multi-target export. Plain React,
 * inline styles only.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  WereadApi, type WereadConfigView, type WereadStatusView, type WereadSyncResult, type WereadBook, type WereadFlomoResult,
} from './api.ts'

/** Module-level API client (stateless; the component closes over it). */
const api = new WereadApi()

/** One shared style sheet (kept tiny and theme-agnostic). */
const s = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '680px',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(128,128,128,0.3)',
    fontSize: '13px',
    color: 'inherit',
  } as const,
  title: { fontWeight: 600, fontSize: '13px', margin: 0 } as const,
  /** One visually separated group card. */
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '6px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(128,128,128,0.22)',
    background: 'rgba(128,128,128,0.05)',
    minWidth: 0,
  } as const,
  groupTitle: {
    fontWeight: 600,
    fontSize: '12px',
    opacity: 0.95,
    margin: 0,
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(128,128,128,0.18)',
  } as const,
  status: { fontSize: '12px', opacity: 0.85, whiteSpace: 'pre-wrap' } as const,
  statusWarn: { fontSize: '12px', opacity: 0.9, color: '#c9763a' } as const,
  row: { display: 'flex', gap: '6px', alignItems: 'center', minWidth: 0, flexWrap: 'wrap' } as const,
  col: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 } as const,
  label: { fontSize: '12px', opacity: 0.8, whiteSpace: 'nowrap' } as const,
  input: {
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '5px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(128,128,128,0.35)',
    background: 'rgba(128,128,128,0.08)',
    color: 'inherit',
    fontSize: '12px',
  } as const,
  textarea: {
    width: '100%',
    minHeight: '96px',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(128,128,128,0.35)',
    background: 'rgba(128,128,128,0.08)',
    color: 'inherit',
    fontSize: '12px',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    resize: 'vertical',
  } as const,
  select: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '4px 6px',
    borderRadius: '6px',
    border: '1px solid rgba(128,128,128,0.35)',
    background: 'rgba(128,128,128,0.08)',
    color: 'inherit',
    fontSize: '12px',
  } as const,
  flex: { flex: 1 } as const,
  button: {
    padding: '4px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '1px solid rgba(128,128,128,0.4)',
    background: 'rgba(128,128,128,0.14)',
    color: 'inherit',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  } as const,
  msg: { fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', opacity: 0.9 } as const,
  hint: { fontSize: '11px', opacity: 0.75, lineHeight: 1.6 } as const,
}

/** Status line for the current config view. */
function statusText(view: WereadStatusView | null): string {
  if (view === null) return '加载中…'
  if (!view.configured) {
    return '未配置 — 打开 https://weread.qq.com/r/weread-skills，用微信读书账号登录后点击「创建 Key」并复制（wrk- 开头），粘贴到上方输入框。'
  }
  const destLabel = view.exportDest === 'local' ? '本地文件' : (view.exportDest === 'notion' ? 'Notion' : 'flomo')
  return (
    '已配置 · Key ' + view.apiKeyMasked +
    '\n默认导出目标 ' + destLabel + ' · 导出条数 ' + (view.exportLimit === 0 ? '全部' : view.exportLimit + ' 条') +
    ' · 默认标签 #' + view.defaultFlomoTag +
    '\nprompt 处理 ' + (view.usePrompt ? '开（' + (view.llmConfigured ? view.llmModel + ' @ ' + view.llmBaseUrl : 'LLM 未配置') + '）' : '关') +
    ' · Notion ' + (view.notionConfigured ? '已配置' + (view.notionTargetPageId !== '' ? ' + 目标页' : '（未填目标页）') : '未配置') +
    ' · flomo ' + (view.flomoConfigured ? '已配置（' + view.flomoSource + ' ' + view.flomoMasked + '）' : '未配置') +
    ' · 缓存书架 ' + view.cachedShelfBooks + ' 本 / 有笔记 ' + view.cachedNoteBooks + ' 本' +
    (view.lastSyncAt !== '' ? ' · 最近同步 ' + view.lastSyncAt : '')
  )
}

/** The WeRead settings panel component. */
export function WereadSettingsPanel(): JSX.Element {
  const [view, setView] = useState<WereadStatusView | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [defaultFlomoTag, setDefaultFlomoTag] = useState('')
  const [limitChoice, setLimitChoice] = useState('20')
  const [customLimit, setCustomLimit] = useState('')
  const [exportDest, setExportDest] = useState('flomo')
  const [localExportDir, setLocalExportDir] = useState('')
  const [notionToken, setNotionToken] = useState('')
  const [flomoWebhookUrl, setFlomoWebhookUrl] = useState('')
  const [flomoApiKey, setFlomoApiKey] = useState('')
  const [notionTargetPageId, setNotionTargetPageId] = useState('')
  const [usePrompt, setUsePrompt] = useState(false)
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [exportPrompt, setExportPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [books, setBooks] = useState<WereadBook[]>([])
  const [bookId, setBookId] = useState('')
  // Per-export (this run) controls.
  const [destNow, setDestNow] = useState('')
  const [localDirNow, setLocalDirNow] = useState('')
  const [flomoTagNow, setFlomoTagNow] = useState('')
  const [usePromptNow, setUsePromptNow] = useState<boolean | null>(null)

  /** Map the persisted exportLimit to the choice selector. */
  const limitFromView = (value: number): string => {
    if (value === 0) return '0'
    if ([20, 50, 100].includes(value)) return String(value)
    return 'custom'
  }

  const refresh = useCallback(async () => {
    try {
      const next = await api.getStatus()
      setView(next)
      setDefaultFlomoTag((prev) => prev === '' ? next.defaultFlomoTag : prev)
      setFlomoTagNow((prev) => prev === '' ? next.defaultFlomoTag : prev)
      setLimitChoice(limitFromView(next.exportLimit))
      if (![0, 20, 50, 100].includes(next.exportLimit)) setCustomLimit(String(next.exportLimit))
      setExportDest(next.exportDest)
      setLocalExportDir(next.localExportDir)
      setNotionTargetPageId(next.notionTargetPageId)
      setUsePrompt(next.usePrompt)
      setLlmBaseUrl(next.llmBaseUrl)
      setLlmModel(next.llmModel)
      if (destNow === '') setDestNow(next.exportDest)
    } catch (error) {
      setMessage('状态读取失败: ' + String(error instanceof Error ? error.message : error))
    }
  }, [destNow])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const reloadBooks = useCallback(async () => {
    try {
      const list = await api.books()
      setBooks(list)
      if (list.length > 0) setBookId((prev) => prev !== '' && list.some((b) => b.bookId === prev) ? prev : (list[0]?.bookId ?? ''))
    } catch {
      setBooks([])
    }
  }, [])

  useEffect(() => {
    void reloadBooks()
  }, [reloadBooks])

  /** Resolve the chosen export limit to a number (0 = all). */
  const resolveExportLimit = (): number => {
    if (limitChoice === 'custom') {
      const parsed = Number(customLimit)
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
    }
    return Number(limitChoice) || 0
  }

  const saveConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      if (apiKey.trim() !== '') patch.apiKey = apiKey.trim()
      if (defaultFlomoTag.trim() !== '') patch.defaultFlomoTag = defaultFlomoTag.trim()
      patch.exportLimit = resolveExportLimit()
      patch.exportDest = exportDest
      if (localExportDir.trim() !== '') patch.localExportDir = localExportDir.trim()
      if (notionToken.trim() !== '') patch.notionToken = notionToken.trim()
      if (notionTargetPageId.trim() !== '') patch.notionTargetPageId = notionTargetPageId.trim()
      if (flomoWebhookUrl.trim() !== '') patch.flomoWebhookUrl = flomoWebhookUrl.trim()
      if (flomoApiKey.trim() !== '') patch.flomoApiKey = flomoApiKey.trim()
      patch.usePrompt = usePrompt
      if (llmBaseUrl.trim() !== '') patch.llmBaseUrl = llmBaseUrl.trim()
      if (llmApiKey.trim() !== '') patch.llmApiKey = llmApiKey.trim()
      if (llmModel.trim() !== '') patch.llmModel = llmModel.trim()
      if (exportPrompt.trim() !== '') patch.exportPrompt = exportPrompt
      const next: WereadConfigView = await api.setConfig(patch)
      const status = await api.getStatus()
      setView(status)
      setMessage(next.configured ? '配置已保存。' : '配置未保存完整：缺少 API Key。')
      setApiKey('')
      setNotionToken('')
      setLlmApiKey('')
      setFlomoWebhookUrl('')
      setFlomoApiKey('')
    } catch (error) {
      setMessage('保存失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const clearFlomoConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      await api.setConfig({ flomoReset: true })
      setView(await api.getStatus())
      setMessage('已清除 flomo 配置。')
    } catch (error) {
      setMessage('清除失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const clearConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const next: WereadConfigView = await api.setConfig({ reset: true })
      setView({ ...next, flomoConfigured: view?.flomoConfigured ?? false, flomoSource: view?.flomoSource ?? '', flomoMasked: view?.flomoMasked ?? '', flomoConfigPath: view?.flomoConfigPath ?? '', cachedShelfBooks: view?.cachedShelfBooks ?? 0, cachedNoteBooks: view?.cachedNoteBooks ?? 0, cacheUpdatedAt: view?.cacheUpdatedAt ?? '' })
      setMessage('已清除配置。')
    } catch (error) {
      setMessage('清除失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const runTest = async (): Promise<void> => {
    setBusy(true)
    setMessage('测试中…')
    try {
      const result = await api.test()
      setMessage(result.ok ? result.message : '测试失败: ' + result.message)
    } catch (error) {
      setMessage('测试失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const runSync = async (): Promise<void> => {
    setBusy(true)
    setMessage('同步中…')
    try {
      const result: WereadSyncResult = await api.sync()
      setMessage(result.ok ? result.message : '同步失败: ' + result.message)
      await refresh()
      await reloadBooks()
    } catch (error) {
      setMessage('同步失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const runExportNow = async (): Promise<void> => {
    if (bookId === '') {
      setMessage('请先同步以加载书籍列表。')
      return
    }
    const dest = destNow || view?.exportDest || 'flomo'
    if (dest === 'local' && localDirNow.trim() === '') {
      setMessage('本地导出需要填写导出路径（每次必填）。')
      return
    }
    setBusy(true)
    setMessage('导出中…')
    try {
      const body: Record<string, unknown> = { bookId, dest }
      if (dest === 'local') body.localDir = localDirNow.trim()
      if (dest === 'flomo' && flomoTagNow.trim() !== '') body.tag = flomoTagNow.trim()
      if (usePromptNow !== null) body.usePrompt = usePromptNow
      const result: WereadFlomoResult = await api.exportData(body)
      setMessage(result.ok ? result.message : '导出失败: ' + result.message)
    } catch (error) {
      setMessage('导出失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.card}>
      <h3 style={s.title}>微信读书</h3>
      <div style={view?.configured === false ? s.statusWarn : s.status}>{statusText(view)}</div>

      <div style={s.group}>
        <div style={s.groupTitle}>① 连接与导出偏好</div>
        <div style={s.row}>
          <input
            style={s.input}
            placeholder="Skills API Key（wrk- 开头）"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div style={s.row}>
          <span style={s.label}>默认导出标签</span>
          <input
            style={{ ...s.input, width: '130px' }}
            placeholder="如 读书笔记"
            value={defaultFlomoTag}
            onChange={(e) => setDefaultFlomoTag(e.target.value)}
          />
          <span style={s.label}>导出条数</span>
          <select style={{ ...s.select, flex: 0, minWidth: '104px' }} value={limitChoice} onChange={(e) => setLimitChoice(e.target.value)}>
            <option value="0">全部导出</option>
            <option value="20">20 条（默认）</option>
            <option value="50">50 条</option>
            <option value="100">100 条</option>
            <option value="custom">自定义…</option>
          </select>
          {limitChoice === 'custom' && (
            <input style={{ ...s.input, width: '64px' }} placeholder="条数" value={customLimit} onChange={(e) => setCustomLimit(e.target.value)} />
          )}
        </div>
        <div style={s.row}>
          <span style={s.label}>默认目标</span>
          <select style={{ ...s.select, flex: 0, minWidth: '110px' }} value={exportDest} onChange={(e) => setExportDest(e.target.value)}>
            <option value="flomo">flomo</option>
            <option value="local">本地文件</option>
            <option value="notion">Notion</option>
          </select>
          {exportDest === 'local' && (
            <input style={s.input} placeholder="本地导出目录（绝对路径，可留空导出时填）" value={localExportDir} onChange={(e) => setLocalExportDir(e.target.value)} />
          )}
        </div>
        <div style={s.row}>
          <div style={s.flex} />
          <button style={s.button} onClick={() => void saveConfig()} disabled={busy}>保存配置</button>
          <button style={s.button} onClick={() => void runTest()} disabled={busy || !view?.configured}>测试连接</button>
          <button style={s.button} onClick={() => void clearConfig()} disabled={busy}>清除</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>② flomo 导出</div>
        <div style={view?.flomoConfigured === false ? s.statusWarn : s.status}>
          {view === null
            ? '加载中…'
            : (view.flomoConfigured
              ? '已配置：' + view.flomoSource + ' ' + view.flomoMasked + '（与「Flomo」面板共享，文件 ' + view.flomoConfigPath + '）'
              : '未配置 — 在 flomo 设置页（flomoapp.com/mine?source=incoming_webhook）获取 API URL，粘贴到下方。')}
        </div>
        <div style={s.row}>
          <input style={s.input} type="password" placeholder="flomo API URL（https://flomoapp.com/iwh/xxxx）" value={flomoWebhookUrl} onChange={(e) => setFlomoWebhookUrl(e.target.value)} />
        </div>
        <div style={s.row}>
          <input style={s.input} type="password" placeholder="或 flomo API Key（新版，与 URL 二选一）" value={flomoApiKey} onChange={(e) => setFlomoApiKey(e.target.value)} />
          <button style={s.button} onClick={() => void saveConfig()} disabled={busy}>保存 flomo</button>
          <button style={s.button} onClick={() => void clearFlomoConfig()} disabled={busy}>清除</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>③ Notion 导出</div>
        <div style={s.row}>
          <input style={s.input} type="password" placeholder="Notion Integration Token（notion.so/my-integrations 创建）" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} />
        </div>
        <div style={s.row}>
          <input style={s.input} placeholder="目标父页面 URL 或 32 位 ID（页面需分享给该 Integration）" value={notionTargetPageId} onChange={(e) => setNotionTargetPageId(e.target.value)} />
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>④ AI · prompt 处理（导出前用 LLM 按模板整理）</div>
        <div style={s.row}>
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={usePrompt} onChange={(e) => setUsePrompt(e.target.checked)} />
            启用
          </label>
          <input style={s.input} placeholder="Base URL（默认 https://api.deepseek.com/v1）" value={llmBaseUrl} onChange={(e) => setLlmBaseUrl(e.target.value)} />
          <input style={{ ...s.input, width: '130px' }} placeholder="模型" value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />
          <input style={s.input} type="password" placeholder="LLM API Key（自定义）" value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} />
        </div>
        <div style={s.col}>
          <textarea
            style={s.textarea}
            placeholder="导出 prompt 模板，可用 {title} {author} {highlights} {thoughts} 占位符"
            value={exportPrompt}
            onChange={(e) => setExportPrompt(e.target.value)}
          />
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>⑤ 快捷导出</div>
        <div style={s.row}>
          <span style={s.label}>选择书籍</span>
          <select style={s.select} value={bookId} onChange={(e) => setBookId(e.target.value)} disabled={books.length === 0}>
            {books.length === 0 ? <option value="">（缓存无书籍，先同步）</option> : books.map((b) => (
              <option key={b.bookId} value={b.bookId}>《{b.title}》{b.author !== '' ? ' · ' + b.author : ''}</option>
            ))}
          </select>
          <button style={s.button} onClick={() => void runSync()} disabled={busy || !view?.configured}>同步书架/笔记</button>
        </div>
        <div style={s.row}>
          <span style={s.label}>本次目标</span>
          <select style={{ ...s.select, flex: 0, minWidth: '110px' }} value={destNow} onChange={(e) => setDestNow(e.target.value)}>
            <option value="flomo">flomo</option>
            <option value="local">本地文件</option>
            <option value="notion">Notion</option>
          </select>
          {destNow === 'local' && (
            <input style={s.input} placeholder="导出路径（必填）" value={localDirNow} onChange={(e) => setLocalDirNow(e.target.value)} />
          )}
          {destNow === 'flomo' && (
            <input style={{ ...s.input, width: '150px' }} placeholder="本次标签（#）" value={flomoTagNow} onChange={(e) => setFlomoTagNow(e.target.value)} />
          )}
        </div>
        <div style={s.row}>
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={usePromptNow === null ? (view?.usePrompt ?? false) : usePromptNow}
              onChange={(e) => setUsePromptNow(e.target.checked)}
            />
            本次用 prompt 处理（默认跟随配置）
          </label>
          <div style={s.flex} />
          <button style={s.button} onClick={() => void runExportNow()} disabled={busy || !view?.configured}>
            导出到 {destNow === 'local' ? '本地' : (destNow === 'notion' ? 'Notion' : 'flomo')}
          </button>
        </div>
      </div>

      {message !== '' && <div style={s.msg}>{message}</div>}
      <div style={s.hint}>
        【API Key】打开 https://weread.qq.com/r/weread-skills → 微信读书账号登录 → 「创建 Key」→ 复制（wrk- 开头）。Key 绑定你的账号身份，请勿泄露。存于 ~/.dsh/weread-export.json（权限 0600）。
      </div>
      <div style={s.hint}>
        【导出目标】flomo = 发到浮墨（复用「Flomo」面板凭据，超长自动拆多条 MEMO）；本地 = 导出 Markdown 文件到指定目录（每次导出需填路径）；Notion = 用本插件自己的 Integration Token 在目标父页面下创建子页面写入（目标页需分享给该 Integration）。
      </div>
      <div style={s.hint}>
        【AI prompt】启用后导出前会调用 LLM（OpenAI 兼容，默认 DeepSeek）按模板整理划线内容再导出。模板支持 {'{title}'} {'{author}'} {'{highlights}'} {'{thoughts}'} 占位符，可随意编辑；本次导出也可临时开关。
      </div>
      <div style={s.hint}>
        【导出条数】「全部导出」= 全部划线都导出（flomo 超长自动拆多条）；「20/50/100/自定义」= 最多导出的条数。
        同步后可用 weread_shelf / weread_notes / weread_readdata / weread_search / weread_book / weread_export 等工具。
      </div>
    </div>
  )
}
