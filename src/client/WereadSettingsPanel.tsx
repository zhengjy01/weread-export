/**
 * WeRead settings panel — rendered inside the web settings page
 * (settings.section entry). Connection setup (Skills API key, default flomo
 * tag), a test button, manual sync, and a quick highlight→flomo export with
 * a customizable tag. Plain React, inline styles only.
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
    maxWidth: '620px',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(128,128,128,0.3)',
    fontSize: '13px',
    color: 'inherit',
  } as const,
  title: { fontWeight: 600, fontSize: '13px', margin: 0 } as const,
  status: { fontSize: '12px', opacity: 0.85 } as const,
  statusWarn: { fontSize: '12px', opacity: 0.9, color: '#c9763a' } as const,
  row: { display: 'flex', gap: '6px', alignItems: 'center' } as const,
  label: { fontSize: '12px', opacity: 0.8, whiteSpace: 'nowrap' } as const,
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '5px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(128,128,128,0.35)',
    background: 'rgba(128,128,128,0.08)',
    color: 'inherit',
    fontSize: '12px',
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
  return (
    '已配置 · Key ' + view.apiKeyMasked +
    ' · 默认 flomo 标签 #' + view.defaultFlomoTag +
    ' · flomo ' + (view.flomoConfigured ? '已配置' : '未配置') +
    ' · 缓存书架 ' + view.cachedShelfBooks + ' 本 / 有笔记 ' + view.cachedNoteBooks + ' 本' +
    (view.lastSyncAt !== '' ? ' · 最近同步 ' + view.lastSyncAt : '')
  )
}

/** The WeRead settings panel component. */
export function WereadSettingsPanel(): JSX.Element {
  const [view, setView] = useState<WereadStatusView | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [defaultFlomoTag, setDefaultFlomoTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [books, setBooks] = useState<WereadBook[]>([])
  const [bookId, setBookId] = useState('')
  const [flomoTag, setFlomoTag] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await api.getStatus()
      setView(next)
      setDefaultFlomoTag((prev) => prev === '' ? next.defaultFlomoTag : prev)
      setFlomoTag((prev) => prev === '' ? next.defaultFlomoTag : prev)
    } catch (error) {
      setMessage('状态读取失败: ' + String(error instanceof Error ? error.message : error))
    }
  }, [])

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

  const saveConfig = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      if (apiKey.trim() !== '') patch.apiKey = apiKey.trim()
      if (defaultFlomoTag.trim() !== '') patch.defaultFlomoTag = defaultFlomoTag.trim()
      const next: WereadConfigView = await api.setConfig(patch)
      setView({ ...next, flomoConfigured: view?.flomoConfigured ?? false, cachedShelfBooks: view?.cachedShelfBooks ?? 0, cachedNoteBooks: view?.cachedNoteBooks ?? 0, cacheUpdatedAt: view?.cacheUpdatedAt ?? '' })
      setMessage(next.configured ? '配置已保存。' : '配置未保存完整：缺少 API Key。')
      setApiKey('')
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
      const next: WereadConfigView = await api.setConfig({ reset: true })
      setView({ ...next, flomoConfigured: view?.flomoConfigured ?? false, cachedShelfBooks: view?.cachedShelfBooks ?? 0, cachedNoteBooks: view?.cachedNoteBooks ?? 0, cacheUpdatedAt: view?.cacheUpdatedAt ?? '' })
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

  const runExport = async (): Promise<void> => {
    if (bookId === '') {
      setMessage('请先同步以加载书籍列表。')
      return
    }
    setBusy(true)
    setMessage('导出中…')
    try {
      const result: WereadFlomoResult = await api.exportFlomo(bookId, flomoTag.trim())
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
          style={{ ...s.input, width: '180px' }}
          placeholder="如 读书笔记（存配置）"
          value={defaultFlomoTag}
          onChange={(e) => setDefaultFlomoTag(e.target.value)}
        />
        <div style={s.flex} />
        <button style={s.button} onClick={() => void saveConfig()} disabled={busy}>保存配置</button>
        <button style={s.button} onClick={() => void runTest()} disabled={busy || !view?.configured}>测试连接</button>
        <button style={s.button} onClick={() => void clearConfig()} disabled={busy}>清除</button>
      </div>
      <div style={s.row}>
        <button style={s.button} onClick={() => void runSync()} disabled={busy || !view?.configured}>同步书架/笔记</button>
      </div>
      <div style={s.row}>
        <span style={s.label}>选择书籍</span>
        <select style={s.select} value={bookId} onChange={(e) => setBookId(e.target.value)} disabled={books.length === 0}>
          {books.length === 0 ? <option value="">（缓存无书籍，先同步）</option> : books.map((b) => (
            <option key={b.bookId} value={b.bookId}>《{b.title}》{b.author !== '' ? ' · ' + b.author : ''}</option>
          ))}
        </select>
      </div>
      <div style={s.row}>
        <span style={s.label}>本次导出标签</span>
        <input
          style={{ ...s.input, width: '180px' }}
          placeholder="不填则用默认导出标签"
          value={flomoTag}
          onChange={(e) => setFlomoTag(e.target.value)}
        />
        <div style={s.flex} />
        <button style={s.button} onClick={() => void runExport()} disabled={busy || !view?.configured || !view?.flomoConfigured}>
          导出划线到 flomo
        </button>
      </div>
      {message !== '' && <div style={s.msg}>{message}</div>}
      <div style={s.hint}>
        【API Key】打开 https://weread.qq.com/r/weread-skills → 微信读书账号登录 → 「创建 Key」→ 复制（wrk- 开头）。Key 绑定你的账号身份，可读取你的读书数据，请勿泄露。存于 ~/.dsh/dsh-weread.json（权限 0600）。
      </div>
      <div style={s.hint}>
        【flomo 标签】flomo 没有「目录」，标签就是写进 MEMO 的 #标签（如 #读书笔记），用于分类归档。
        「默认导出标签」存进本插件配置，是 weread_flomo 工具或面板导出时没指定标签的兜底；
        「本次导出标签」只影响当前这一次导出（选书 → 填标签 → 点导出），留空则用默认标签。
      </div>
      <div style={s.hint}>
        【其他】同步快照存 ~/.dsh/dsh-weread-cache.json；flomo 导出复用「Flomo」面板的凭据。
        同步后可用 weread_shelf / weread_notes / weread_readdata / weread_search / weread_book 等工具。
      </div>
    </div>
  )
}
