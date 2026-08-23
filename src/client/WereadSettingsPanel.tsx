/**
 * WeRead settings panel — rendered inside the web settings page
 * (settings.section entry).
 *
 * Layout: each export target configures its own parameters in its own card
 * (flomo: tag + URL/key; Notion: token + target page; local: directory),
 * and the quick-export card only picks a destination (flomo / Notion /
 * local / all) — no "default vs this-run" duplication. Plain React, inline
 * styles only.
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
    return '未配置 — 打开 https://weread.qq.com/r/weread-skills，用微信读书账号登录后点击「创建 Key」并复制（wrk- 开头），粘贴到「① 连接」卡片。'
  }
  return (
    '已配置 · Key ' + view.apiKeyMasked + ' · 导出条数 ' + (view.exportLimit === 0 ? '全部' : view.exportLimit + ' 条') +
    '\nflomo ' + (view.flomoConfigured ? '已配置（' + view.flomoSource + ' ' + view.flomoMasked + '）' : '未配置') +
    ' · Notion ' + (view.notionConfigured ? '已配置' + (view.notionTargetPageId !== '' ? ' + 目标页' : '（未填目标页）') : '未配置') +
    ' · 本地 ' + (view.localExportDir !== '' ? '已配置' : '未配置') +
    ' · prompt ' + (view.usePrompt ? '开（' + (view.llmConfigured ? view.llmModel : 'LLM 未配置') + '）' : '关') +
    ' · 缓存书架 ' + view.cachedShelfBooks + ' 本 / 有笔记 ' + view.cachedNoteBooks + ' 本'
  )
}

/** The WeRead settings panel component. */
export function WereadSettingsPanel(): JSX.Element {
  const [view, setView] = useState<WereadStatusView | null>(null)
  // ① connection
  const [apiKey, setApiKey] = useState('')
  const [limitChoice, setLimitChoice] = useState('20')
  const [customLimit, setCustomLimit] = useState('')
  // ② flomo
  const [defaultFlomoTag, setDefaultFlomoTag] = useState('')
  const [flomoWebhookUrl, setFlomoWebhookUrl] = useState('')
  const [flomoApiKey, setFlomoApiKey] = useState('')
  // ③ notion
  const [notionToken, setNotionToken] = useState('')
  const [notionTargetPageId, setNotionTargetPageId] = useState('')
  // ④ local
  const [localExportDir, setLocalExportDir] = useState('')
  // ⑤ AI
  const [usePrompt, setUsePrompt] = useState(false)
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [exportPrompt, setExportPrompt] = useState('')
  // shared + quick export
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [books, setBooks] = useState<WereadBook[]>([])
  const [bookId, setBookId] = useState('')
  const [destNow, setDestNow] = useState('flomo')
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
      setLimitChoice(limitFromView(next.exportLimit))
      if (![0, 20, 50, 100].includes(next.exportLimit)) setCustomLimit(String(next.exportLimit))
      setNotionTargetPageId(next.notionTargetPageId)
      setLocalExportDir(next.localExportDir)
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

  const afterSave = async (okMessage: string): Promise<void> => {
    setView(await api.getStatus())
    setMessage(okMessage)
    setApiKey('')
    setFlomoWebhookUrl('')
    setFlomoApiKey('')
    setNotionToken('')
    setLlmApiKey('')
  }

  /** ① connection: API key + export limit. */
  const saveMainConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      if (apiKey.trim() !== '') patch.apiKey = apiKey.trim()
      patch.exportLimit = resolveExportLimit()
      const next: WereadConfigView = await api.setConfig(patch)
      setMessage(next.configured ? '配置已保存。' : '配置未保存完整：缺少 API Key。')
      await afterSave('')
    } catch (error) {
      setMessage('保存失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  /** ② flomo: tag + URL / key. */
  const saveFlomoConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      if (defaultFlomoTag.trim() !== '') patch.defaultFlomoTag = defaultFlomoTag.trim()
      if (flomoWebhookUrl.trim() !== '') patch.flomoWebhookUrl = flomoWebhookUrl.trim()
      if (flomoApiKey.trim() !== '') patch.flomoApiKey = flomoApiKey.trim()
      await api.setConfig(patch)
      await afterSave('flomo 配置已保存。')
    } catch (error) {
      setMessage('保存失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  /** ③ notion: token + target page. */
  const saveNotionConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      if (notionToken.trim() !== '') patch.notionToken = notionToken.trim()
      if (notionTargetPageId.trim() !== '') patch.notionTargetPageId = notionTargetPageId.trim()
      await api.setConfig(patch)
      await afterSave('Notion 配置已保存。')
    } catch (error) {
      setMessage('保存失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  /** ④ local: export directory. */
  const saveLocalConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      if (localExportDir.trim() !== '') patch.localExportDir = localExportDir.trim()
      await api.setConfig(patch)
      await afterSave('本地导出目录已保存。')
    } catch (error) {
      setMessage('保存失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  /** ⑤ AI: prompt toggle + LLM config + template. */
  const saveAIConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = { usePrompt }
      if (llmBaseUrl.trim() !== '') patch.llmBaseUrl = llmBaseUrl.trim()
      if (llmApiKey.trim() !== '') patch.llmApiKey = llmApiKey.trim()
      if (llmModel.trim() !== '') patch.llmModel = llmModel.trim()
      if (exportPrompt.trim() !== '') patch.exportPrompt = exportPrompt
      await api.setConfig(patch)
      await afterSave('AI 配置已保存。')
    } catch (error) {
      setMessage('保存失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const clearConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      await api.setConfig({ reset: true })
      await afterSave('已清除全部配置。')
    } catch (error) {
      setMessage('清除失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  const clearFlomoConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      await api.setConfig({ flomoReset: true })
      await afterSave('已清除 flomo 配置。')
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

  /** Test flomo: saves any unsaved fields first, then sends a test memo. */
  const testFlomoConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('测试中…（会向 flomo 发送一条测试 MEMO）')
    try {
      if (defaultFlomoTag.trim() !== '' || flomoWebhookUrl.trim() !== '' || flomoApiKey.trim() !== '') {
        const patch: Record<string, unknown> = {}
        if (defaultFlomoTag.trim() !== '') patch.defaultFlomoTag = defaultFlomoTag.trim()
        if (flomoWebhookUrl.trim() !== '') patch.flomoWebhookUrl = flomoWebhookUrl.trim()
        if (flomoApiKey.trim() !== '') patch.flomoApiKey = flomoApiKey.trim()
        await api.setConfig(patch)
        setFlomoWebhookUrl('')
        setFlomoApiKey('')
        setView(await api.getStatus())
      }
      const result = await api.testFlomo()
      setMessage(result.ok ? '✅ ' + result.message : '测试失败: ' + result.message)
    } catch (error) {
      setMessage('测试失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  /** Test Notion: saves any unsaved fields first, then verifies token + page. */
  const testNotionConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('测试中…')
    try {
      if (notionToken.trim() !== '' || notionTargetPageId.trim() !== '') {
        const patch: Record<string, unknown> = {}
        if (notionToken.trim() !== '') patch.notionToken = notionToken.trim()
        if (notionTargetPageId.trim() !== '') patch.notionTargetPageId = notionTargetPageId.trim()
        await api.setConfig(patch)
        setNotionToken('')
        setView(await api.getStatus())
      }
      const result = await api.testNotion()
      setMessage(result.ok ? '✅ ' + result.message : '测试失败: ' + result.message)
    } catch (error) {
      setMessage('测试失败: ' + String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }

  /** Open the host OS folder chooser and apply the picked path. */
  const pickFolder = async (apply: (p: string) => void): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const result = await api.pickDir()
      if (result.ok && result.path !== undefined) {
        apply(result.path)
        setMessage('已选择文件夹：' + result.path)
      } else if (result.cancelled === true) {
        setMessage('已取消选择。')
      } else {
        setMessage(result.message ?? '无法弹出文件夹选择（当前环境不支持），请手动输入路径。')
      }
    } catch (error) {
      setMessage('选择文件夹失败: ' + String(error instanceof Error ? error.message : error))
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
    const dest = destNow || 'flomo'
    if (dest === 'local' && (view?.localExportDir ?? '') === '') {
      setMessage('本地导出需要先在「④ 本地导出」配置导出目录。')
      return
    }
    if (dest === 'all' && (view?.localExportDir ?? '') === '') {
      setMessage('全选导出包含本地目标，但「④ 本地导出」未配置目录；本地部分将跳过（其余目标照常导出）。')
    }
    setBusy(true)
    setMessage('导出中…')
    try {
      const body: Record<string, unknown> = { bookId, dest }
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
        <div style={s.groupTitle}>① 连接</div>
        <div style={s.row}>
          <input
            style={s.input}
            placeholder="微信读书 Skills API Key（wrk- 开头）"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div style={s.row}>
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
          <div style={s.flex} />
          <button style={s.button} onClick={() => void saveMainConfig()} disabled={busy}>保存</button>
          <button style={s.button} onClick={() => void runTest()} disabled={busy || !view?.configured}>测试连接</button>
          <button style={s.button} onClick={() => void clearConfig()} disabled={busy}>清除全部</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>② flomo 导出</div>
        <div style={view?.flomoConfigured === false ? s.statusWarn : s.status}>
          {view === null
            ? '加载中…'
            : (view.flomoConfigured
              ? '已配置：' + view.flomoSource + ' ' + view.flomoMasked + '（与「Flomo」面板共享凭据）'
              : '未配置 — 在 flomo 设置页（flomoapp.com/mine?source=incoming_webhook）获取 API URL。')}
        </div>
        <div style={s.row}>
          <span style={s.label}>标签</span>
          <input style={{ ...s.input, width: '160px' }} placeholder="如 读书笔记（#）" value={defaultFlomoTag} onChange={(e) => setDefaultFlomoTag(e.target.value)} />
        </div>
        <div style={s.row}>
          <input style={s.input} type="password" placeholder="flomo API URL（https://flomoapp.com/iwh/xxxx）" value={flomoWebhookUrl} onChange={(e) => setFlomoWebhookUrl(e.target.value)} />
        </div>
        <div style={s.row}>
          <input style={s.input} type="password" placeholder="或 flomo API Key（新版，与 URL 二选一）" value={flomoApiKey} onChange={(e) => setFlomoApiKey(e.target.value)} />
          <button style={s.button} onClick={() => void saveFlomoConfig()} disabled={busy}>保存 flomo</button>
          <button style={s.button} onClick={() => void testFlomoConfig()} disabled={busy || !view?.flomoConfigured}>测试 flomo</button>
          <button style={s.button} onClick={() => void clearFlomoConfig()} disabled={busy}>清除</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>③ Notion 导出</div>
        <div style={view?.notionConfigured === false ? s.statusWarn : s.status}>
          {view === null
            ? '加载中…'
            : (view.notionConfigured
              ? '已配置' + (view.notionTargetPageId !== '' ? ' · 目标页已填' : '（未填目标页）')
              : '未配置 — 在 notion.so/my-integrations 创建 Integration 并复制 Token。')}
        </div>
        <div style={s.row}>
          <input style={s.input} type="password" placeholder="Notion Integration Token" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} />
        </div>
        <div style={s.row}>
          <input style={s.input} placeholder="目标父页面 URL 或 32 位 ID（页面需分享给该 Integration）" value={notionTargetPageId} onChange={(e) => setNotionTargetPageId(e.target.value)} />
        </div>
        <div style={s.row}>
          <div style={s.flex} />
          <button style={s.button} onClick={() => void saveNotionConfig()} disabled={busy}>保存 Notion</button>
          <button style={s.button} onClick={() => void testNotionConfig()} disabled={busy || !view?.notionConfigured}>测试 Notion</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>④ 本地导出</div>
        <div style={view?.localExportDir === '' ? s.statusWarn : s.status}>
          {view === null ? '加载中…' : (view.localExportDir !== '' ? '已配置：' + view.localExportDir : '未配置 — 选择或填写一个导出目录，导出为 Markdown 文件。')}
        </div>
        <div style={s.row}>
          <input style={s.input} placeholder="导出目录（绝对路径）" value={localExportDir} onChange={(e) => setLocalExportDir(e.target.value)} />
          <button style={s.button} onClick={() => void pickFolder((p) => setLocalExportDir(p))} disabled={busy}>选择文件夹…</button>
          <button style={s.button} onClick={() => void saveLocalConfig()} disabled={busy}>保存本地</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>⑤ AI · prompt 处理（导出前用 LLM 按模板整理）</div>
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
        <div style={s.row}>
          <div style={s.flex} />
          <button style={s.button} onClick={() => void saveAIConfig()} disabled={busy}>保存 AI</button>
        </div>
      </div>

      <div style={s.group}>
        <div style={s.groupTitle}>⑥ 快捷导出</div>
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
          <span style={s.label}>导出到</span>
          <select style={{ ...s.select, flex: 0, minWidth: '130px' }} value={destNow} onChange={(e) => setDestNow(e.target.value)}>
            <option value="flomo">flomo</option>
            <option value="local">本地文件</option>
            <option value="notion">Notion</option>
            <option value="all">全选（flomo+本地+Notion）</option>
          </select>
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={usePromptNow === null ? (view?.usePrompt ?? false) : usePromptNow}
              onChange={(e) => setUsePromptNow(e.target.checked)}
            />
            本次用 prompt
          </label>
          <div style={s.flex} />
          <button style={s.button} onClick={() => void runExportNow()} disabled={busy || !view?.configured}>
            导出到 {destNow === 'all' ? '全部' : (destNow === 'local' ? '本地' : (destNow === 'notion' ? 'Notion' : 'flomo'))}
          </button>
        </div>
      </div>

      {message !== '' && <div style={s.msg}>{message}</div>}
      <div style={s.hint}>
        【API Key】打开 https://weread.qq.com/r/weread-skills → 微信读书账号登录 → 「创建 Key」→ 复制（wrk- 开头）。Key 绑定你的账号身份，请勿泄露。存于 ~/.dsh/weread-export.json（权限 0600）。
      </div>
      <div style={s.hint}>
        【各目标独立配置】②flomo：标签 + API URL/Key（与「Flomo」面板共享凭据）；③Notion：Integration Token + 目标页（页面需分享给该 Integration）；④本地：导出目录（导出为 Markdown 文件）。每个卡片「保存/测试」独立操作。
      </div>
      <div style={s.hint}>
        【导出】「⑥ 快捷导出」只选目标：flomo / 本地 / Notion / 全选（一次导出到所有已配置目标，未配置的跳过并说明）；prompt 处理可选，导出前按 ⑤ 模板整理一次再分发。
      </div>
      <div style={s.hint}>
        【导出条数】「全部导出」= 全部划线都导出（flomo 超长自动拆多条）；「20/50/100/自定义」= 最多导出的条数。
        同步后可用 weread_shelf / weread_notes / weread_readdata / weread_search / weread_book / weread_export 等工具。
      </div>
    </div>
  )
}
