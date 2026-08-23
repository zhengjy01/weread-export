/**
 * weread-export smoke tests — pure helpers, credential store, and the gateway
 * client's error paths (fetch stubbed). Run: node tests/smoke.mjs
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {
  WereadStore, WereadApi, WereadApiError, mask,
  formatDate, formatDuration, formatRating, deepLink, buildNotesMarkdown, buildFlomoMemo, buildFlomoMemos,
  emptyCache, readCache, writeCache, buildTaggedContent, shelfLine, notebookLines,
  buildExportMarkdown, chunkText, toNotionBlocks, normalizeNotionPageId, renderPrompt,
  readFlomoCredentials, writeFlomoCredentials, flomoStatus,
} from '../lib/index.js'

let failures = 0
function check(label, fn) {
  try {
    fn()
    console.log('  ✔ ' + label)
  } catch (error) {
    failures += 1
    console.error('  ✘ ' + label + ': ' + (error instanceof Error ? error.message : error))
  }
}

console.log('helpers')
check('formatDuration', () => {
  assert.equal(formatDuration(90), '1分钟')
  assert.equal(formatDuration(3661), '1小时1分钟')
  assert.equal(formatDuration(7200), '2小时')
  assert.equal(formatDuration(0), '0分钟')
})
check('formatRating', () => {
  // the gateway returns a 0-100 score; display as 0-10
  assert.equal(formatRating(89), '8.9')
  assert.equal(formatRating(45), '4.5')
  assert.equal(formatRating(0), '')
  assert.equal(formatRating(undefined), '')
})
check('formatDate', () => {
  assert.equal(formatDate(1756800000), '2025-09-02')
  assert.equal(formatDate(0), '')
  assert.equal(formatDate(undefined), '')
})
check('deepLink', () => {
  assert.equal(deepLink('123', ''), 'https://weread.qq.com/web/bookDetail/123')
  assert.equal(deepLink('123', 'https://weread.qq.com/web/reader/x'), 'https://weread.qq.com/web/reader/x')
})
check('mask', () => {
  assert.equal(mask('wrk-abcdefghijkl'), 'wrk-****ijkl')
  assert.equal(mask(''), '')
})

console.log('markdown builders')
check('buildNotesMarkdown', () => {
  const md = buildNotesMarkdown('三体', '刘慈欣', [
    { bookmarkId: 'b1', chapterUid: 2, markText: '给岁月以文明', createTime: 1756800000 },
  ], [
    { review: { reviewId: 'r1', content: '神作', createTime: 1756800000, chapterName: '序章' } },
  ], [{ chapterUid: 2, title: '第二章 台球' }])
  assert.ok(md.includes('《三体》'), md)
  assert.ok(md.includes('给岁月以文明'), md)
  assert.ok(md.includes('第二章 台球'), md)
  assert.ok(md.includes('神作'), md)
  assert.ok(md.includes('## 划线 1 条'), md)
  assert.ok(md.includes('## 想法 1 条'), md)
})
check('buildFlomoMemo', () => {
  const memo = buildFlomoMemo('三体', [
    { markText: '给岁月以文明', chapterUid: 1 },
    { markText: '弱小和无知不是生存的障碍', chapterUid: 2 },
  ], [{ chapterUid: 1, title: '第一章' }, { chapterUid: 2, title: '第二章' }], 5, 2)
  assert.ok(memo.includes('共 5 条'), memo)
  assert.ok(memo.includes('仅导出前 2 条'), memo)
})
check('buildFlomoMemos chunks all highlights', () => {
  const highlights = Array.from({ length: 60 }, (_, i) => ({ markText: '划线内容第 ' + (i + 1) + ' 条，这是一段足够长的文字以触发分片。' + '填充'.repeat(30) }))
  const memos = buildFlomoMemos('长书', highlights, undefined)
  assert.ok(memos.length > 1, 'expected multiple memos, got ' + memos.length)
  // every highlight appears across the memos, none dropped
  const joined = memos.join('\n')
  for (const h of highlights) assert.ok(joined.includes(h.markText.slice(0, 10)), 'missing ' + h.markText.slice(0, 10))
  // each memo stays under the size cap (header + continuation lines may push a bit)
  for (const memo of memos) assert.ok(memo.length <= 1800 + 64, 'memo too long: ' + memo.length)
})
check('buildFlomoMemos single memo when short', () => {
  const highlights = [{ markText: '短划线' }, { markText: '另一条' }]
  const memos = buildFlomoMemos('短书', highlights, undefined)
  assert.equal(memos.length, 1)
  assert.ok(memos[0].includes('共 2 条'), memos[0])
})
check('buildExportMarkdown', () => {
  const md = buildExportMarkdown('三体', '刘慈欣', [
    { markText: '给岁月以文明', chapterUid: 1, createTime: 1756800000 },
  ], [
    { review: { reviewId: 'r1', content: '神作', abstract: '给岁月以文明', chapterName: '第一章', createTime: 1756800000 } },
  ], [{ chapterUid: 1, title: '第一章' }])
  assert.ok(md.includes('# 《三体》'), md)
  assert.ok(md.includes('## 划线 1 条'), md)
  assert.ok(md.includes('## 想法 1 条'), md)
  assert.ok(md.includes('原文：给岁月以文明'), md)
})
check('chunkText splits long text', () => {
  const text = Array.from({ length: 80 }, (_, i) => '第 ' + (i + 1) + ' 行：' + '内容'.repeat(30)).join('\n')
  const chunks = chunkText(text, 1800, '长书')
  assert.ok(chunks.length > 1, 'expected multiple chunks, got ' + chunks.length)
  assert.equal(chunks.join('\n').length >= text.length, true)
  for (const c of chunks) assert.ok(c.length <= 1800 + 64, 'chunk too long: ' + c.length)
})
check('normalizeNotionPageId', () => {
  const id = '8ab3e1c2abcd4ef8901234567890abc1'
  assert.equal(normalizeNotionPageId(id), id)
  assert.equal(normalizeNotionPageId('https://www.notion.so/MyPage-' + id + '?pvs=4'), id)
  assert.equal(normalizeNotionPageId(id.toUpperCase()), id)
  assert.throws(() => normalizeNotionPageId(''), /目标页面/)
  assert.throws(() => normalizeNotionPageId('not-a-valid-id'), /无法识别/)
})
check('toNotionBlocks', () => {
  const blocks = toNotionBlocks('# 标题\n\n- 一条\n- 二条')
  assert.equal(blocks.length, 3)
  assert.equal(blocks[0].type, 'paragraph')
  assert.deepEqual(blocks[0].paragraph.rich_text[0].text, { content: '# 标题' })
})
check('renderPrompt', () => {
  const out = renderPrompt('《{title}》{author}\n{highlights}\n{thoughts}', { title: 'T', author: 'A', highlights: 'H', thoughts: 'R' })
  assert.equal(out, '《T》A\nH\nR')
})
check('buildTaggedContent', () => {
  assert.equal(buildTaggedContent('hello', '读书笔记 微信读书'), 'hello #读书笔记 #微信读书')
  assert.equal(buildTaggedContent('hello', '#读书笔记'), 'hello #读书笔记')
})
check('shelfLine finishReading 1/0', () => {
  assert.ok(shelfLine({ bookId: '1', title: 'A', author: 'B', finishReading: 1 }, new Map()).includes('已读完'))
  assert.ok(!shelfLine({ bookId: '1', title: 'A', author: 'B', finishReading: 0 }, new Map()).includes('已读完'))
  const progress = new Map([['1', 30]])
  assert.ok(shelfLine({ bookId: '1', title: 'A', author: 'B' }, progress).includes('30%'))
})
check('notebookLines count mapping', () => {
  // noteCount=划线, reviewCount=想法, bookmarkCount=书签; 总=三者之和
  const lines = notebookLines([{ bookId: '1', book: { title: 'T' }, reviewCount: 2, noteCount: 5, bookmarkCount: 1, readingProgress: 40 }])
  assert.equal(lines.length, 1)
  assert.ok(lines[0].includes('共 8 条'), lines[0])
  assert.ok(lines[0].includes('划线 5 · 想法 2 · 书签 1'), lines[0])
  assert.ok(lines[0].includes('进度 40%'), lines[0])
})

console.log('cache round-trip')
check('read/write/empty', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'weread-export-'))
  process.env.DSH_WEREAD_CACHE = path.join(dir, 'cache.json')
  try {
    assert.deepEqual(await readCache(), emptyCache())
    await writeCache({ updatedAt: 'now', shelfBooks: [{ bookId: '1', title: 'T' }], albumsCount: 0, mpCount: 0, notebooks: [] })
    const cache = await readCache()
    assert.equal(cache.updatedAt, 'now')
    assert.equal(cache.shelfBooks.length, 1)
  } finally {
    delete process.env.DSH_WEREAD_CACHE
    await rm(dir, { recursive: true, force: true })
  }
})

console.log('flomo shared credentials')
check('status shape + empty-read safe', async () => {
  // Never touch the real ~/.dsh/dsh-flomo.json: assert the view shape and
  // that reading an absent/missing file yields empty credentials safely.
  const status = await flomoStatus()
  assert.equal(typeof status.configured, 'boolean')
  assert.equal(status.configPath.includes('dsh-flomo.json'), true)
  const creds = await readFlomoCredentials()
  assert.equal(typeof creds.webhookUrl, 'string')
  assert.equal(typeof creds.apiKey, 'string')
})

console.log('store')
check('patch/view/mask + exportLimit', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'weread-export-'))
  process.env.DSH_WEREAD_CONFIG = path.join(dir, 'config.json')
  try {
    const store = new WereadStore()
    let view = await store.view()
    assert.equal(view.configured, false)
    assert.equal(view.exportLimit, 20, 'default export limit should be 20')
    view = await store.patch({ apiKey: 'wrk-test123456789', defaultFlomoTag: '读书笔记' })
    assert.equal(view.configured, true)
    assert.equal(view.apiKeyMasked, 'wrk-****6789')
    assert.equal(view.defaultFlomoTag, '读书笔记')
    view = await store.patch({ exportLimit: 0 })
    assert.equal(view.exportLimit, 0, 'exportLimit 0 = export all')
    view = await store.patch({ exportLimit: 150 })
    assert.equal(view.exportLimit, 150)
    view = await store.patch({ exportDest: 'local', localExportDir: '/tmp/wr-out', notionToken: 'ntn_secret123', notionTargetPageId: 'abc', usePrompt: true, llmApiKey: 'sk-x', llmModel: 'deepseek-chat', llmBaseUrl: 'https://x/v1' })
    assert.equal(view.exportDest, 'local')
    assert.equal(view.localExportDir, '/tmp/wr-out')
    assert.equal(view.notionConfigured, true)
    assert.equal(view.notionTargetPageId, 'abc')
    assert.equal(view.usePrompt, true)
    assert.equal(view.llmConfigured, true)
    assert.equal(view.llmModel, 'deepseek-chat')
    assert.equal(view.llmBaseUrl, 'https://x/v1')
    view = await store.patch({ reset: true })
    assert.equal(view.configured, false)
    assert.equal(view.exportLimit, 20, 'reset restores default limit')
    assert.equal(view.exportDest, 'flomo', 'reset restores default dest')
  } finally {
    delete process.env.DSH_WEREAD_CONFIG
    await rm(dir, { recursive: true, force: true })
  }
})

console.log('gateway client (fetch stubbed)')
check('errcode surfacing', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ errcode: 4002, errmsg: '参数错误' }), { status: 200 })
  try {
    const api = new WereadApi('wrk-test')
    await assert.rejects(api.search('三体'), (err) => {
      assert.ok(err instanceof WereadApiError)
      assert.equal(err.message, '参数错误')
      assert.equal(err.code, 4002)
      return true
    })
  } finally {
    globalThis.fetch = original
  }
})
check('upgrade_info surfacing', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ upgrade_info: { message: '请升级到 1.1.0' } }), { status: 200 })
  try {
    const api = new WereadApi('wrk-test')
    await assert.rejects(api.list(), /需要升级/)
  } finally {
    globalThis.fetch = original
  }
})
check('unconfigured key', async () => {
  const api = new WereadApi('')
  await assert.rejects(api.shelf(), /未配置微信读书 API Key/)
})

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll smoke checks passed.')
