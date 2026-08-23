import { defineTool, defineTool as defineTool$1 } from "@deepseek-ai/dsh-tools";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
//#region src/store.ts
/**
* weread-export — credential/cache store.
*
* Persists the WeRead Skills API key (wrk-...) to ~/.dsh/weread-export.json
* (mode 0600) and the latest sync snapshot (bookshelf + notebook overview)
* to ~/.dsh/weread-export-cache.json. The config file holds the API key plus
* the default flomo tag used by weread_flomo. Reads are lazy and cached;
* the public view() never exposes secrets. Config paths can be overridden
* with DSH_WEREAD_CONFIG / DSH_WEREAD_CACHE (used by tests).
*/
/** Default machine-wide config location (mode 0600). */
const DEFAULT_CONFIG_FILE = path.join(homedir(), ".dsh", "weread-export.json");
/** Default sync cache location (mode 0600). */
const DEFAULT_CACHE_FILE = path.join(homedir(), ".dsh", "weread-export-cache.json");
/** Test override for the config location. */
function configPath() {
	const override = process.env.DSH_WEREAD_CONFIG;
	return override !== void 0 && override !== "" ? override : DEFAULT_CONFIG_FILE;
}
/** Test override for the cache location. */
function cachePath() {
	const override = process.env.DSH_WEREAD_CACHE;
	return override !== void 0 && override !== "" ? override : DEFAULT_CACHE_FILE;
}
/** Mask a credential for display, keeping only the head and tail. */
function mask(value) {
	if (!value) return "";
	if (value.length <= 8) return value.slice(0, 2) + "****";
	return value.slice(0, 4) + "****" + value.slice(-4);
}
/** Default export prompt template. */
const DEFAULT_EXPORT_PROMPT = "你是读书笔记整理助手。请根据下面提供的微信读书划线内容，输出一份结构化读书笔记：\n## 核心观点\n## 金句摘录\n## 我的思考\n要求：保留划线原文要点，语言精炼，使用 Markdown 格式。\n\n书籍：{title}\n作者：{author}\n划线内容：\n{highlights}";
/** Empty credentials record. */
function empty() {
	return {
		apiKey: "",
		defaultFlomoTag: "微信读书",
		exportLimit: 20,
		exportDest: "flomo",
		localExportDir: "",
		notionToken: "",
		notionTargetPageId: "",
		usePrompt: false,
		exportPrompt: DEFAULT_EXPORT_PROMPT,
		llmBaseUrl: "https://api.deepseek.com/v1",
		llmApiKey: "",
		llmModel: "deepseek-chat",
		lastSyncAt: ""
	};
}
/** Parse an unknown JSON record into credentials (tolerates missing keys). */
function parse(raw) {
	const record = typeof raw === "object" && raw !== null ? raw : {};
	const str = (value) => typeof value === "string" ? value : "";
	const limit = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 20;
	const dest = (value) => value === "local" || value === "notion" || value === "all" ? value : value === "flomo" ? "flomo" : "flomo";
	const bool = (value) => value === true;
	const base = empty();
	return {
		apiKey: str(record.apiKey),
		defaultFlomoTag: str(record.defaultFlomoTag) || base.defaultFlomoTag,
		exportLimit: limit(record.exportLimit),
		exportDest: dest(record.exportDest),
		localExportDir: str(record.localExportDir),
		notionToken: str(record.notionToken),
		notionTargetPageId: str(record.notionTargetPageId),
		usePrompt: bool(record.usePrompt),
		exportPrompt: str(record.exportPrompt) || base.exportPrompt,
		llmBaseUrl: str(record.llmBaseUrl) || base.llmBaseUrl,
		llmApiKey: str(record.llmApiKey),
		llmModel: str(record.llmModel) || base.llmModel,
		lastSyncAt: str(record.lastSyncAt)
	};
}
/**
* Small credential store backed by ~/.dsh/weread-export.json.
* Reads are lazy and cached; writes use mode 0600 so the API key never
* leaks to other local users.
*/
var WereadStore = class {
	config = null;
	async load() {
		if (this.config !== null) return this.config;
		try {
			const raw = await readFile(configPath(), "utf8");
			this.config = parse(JSON.parse(raw));
		} catch {
			this.config = empty();
		}
		return this.config;
	}
	async save(next) {
		this.config = next;
		await mkdir(path.dirname(configPath()), { recursive: true });
		await writeFile(configPath(), JSON.stringify(next, null, 2), { mode: 384 });
	}
	/** Public, secret-free view. */
	async view() {
		const cfg = await this.load();
		return {
			configured: cfg.apiKey.trim() !== "",
			apiKeyMasked: cfg.apiKey.trim() !== "" ? mask(cfg.apiKey) : "",
			defaultFlomoTag: cfg.defaultFlomoTag,
			exportLimit: cfg.exportLimit,
			exportDest: cfg.exportDest,
			localExportDir: cfg.localExportDir,
			notionConfigured: cfg.notionToken.trim() !== "",
			notionTargetPageId: cfg.notionTargetPageId,
			usePrompt: cfg.usePrompt,
			llmConfigured: cfg.llmApiKey.trim() !== "",
			llmBaseUrl: cfg.llmBaseUrl,
			llmModel: cfg.llmModel,
			lastSyncAt: cfg.lastSyncAt,
			configPath: configPath()
		};
	}
	/**
	* Apply a config patch: any supported field replaces, reset clears.
	* Returns the public view.
	*/
	async patch(args) {
		const cfg = await this.load();
		let next = { ...cfg };
		if (args !== void 0 && args.reset === true) next = {
			...empty(),
			defaultFlomoTag: cfg.defaultFlomoTag
		};
		if (args !== void 0 && typeof args.apiKey === "string") next.apiKey = args.apiKey.trim();
		if (args !== void 0 && typeof args.defaultFlomoTag === "string") next.defaultFlomoTag = args.defaultFlomoTag.trim().replace(/^#+/, "") || "微信读书";
		if (args !== void 0 && typeof args.exportLimit === "number" && Number.isFinite(args.exportLimit)) next.exportLimit = Math.max(0, Math.floor(args.exportLimit));
		if (args !== void 0 && (args.exportDest === "flomo" || args.exportDest === "local" || args.exportDest === "notion" || args.exportDest === "all")) next.exportDest = args.exportDest;
		if (args !== void 0 && typeof args.localExportDir === "string") next.localExportDir = args.localExportDir.trim();
		if (args !== void 0 && typeof args.notionToken === "string") next.notionToken = args.notionToken.trim();
		if (args !== void 0 && typeof args.notionTargetPageId === "string") next.notionTargetPageId = args.notionTargetPageId.trim();
		if (args !== void 0 && typeof args.usePrompt === "boolean") next.usePrompt = args.usePrompt;
		if (args !== void 0 && typeof args.exportPrompt === "string") next.exportPrompt = args.exportPrompt;
		if (args !== void 0 && typeof args.llmBaseUrl === "string") next.llmBaseUrl = args.llmBaseUrl.trim();
		if (args !== void 0 && typeof args.llmApiKey === "string") next.llmApiKey = args.llmApiKey.trim();
		if (args !== void 0 && typeof args.llmModel === "string") next.llmModel = args.llmModel.trim();
		if (args !== void 0 && typeof args.lastSyncAt === "string") next.lastSyncAt = args.lastSyncAt;
		await this.save(next);
		return this.view();
	}
};
//#endregion
//#region src/api.ts
/**
* weread-export — WeRead Skills Agent Gateway client.
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
const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
/** Skill version reported on every request (mirrors the weread-skills pack). */
const SKILL_VERSION = "1.0.4";
/** Request timeout for a gateway call. */
const REQUEST_TIMEOUT_MS$2 = 2e4;
/** Error surfaced from the gateway (carries an optional errcode). */
var WereadApiError = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.name = "WereadApiError";
		this.code = code;
	}
};
/** Parse an unknown gateway payload into a record. */
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
/**
* WeRead Skills gateway client. All methods resolve parsed payloads and
* throw WereadApiError for API-level failures.
*/
var WereadApi = class {
	apiKey;
	constructor(apiKey) {
		this.apiKey = apiKey;
	}
	/**
	* Call one gateway endpoint.
	* @param apiName - interface name, e.g. '/store/search' or '/_list'.
	* @param params - business parameters, flattened at the top level.
	*/
	async gateway(apiName, params = {}) {
		if (this.apiKey.trim() === "") throw new WereadApiError("未配置微信读书 API Key：请先调用 weread_config 配置（在 https://weread.qq.com/r/weread-skills 登录后创建 Key）。");
		let response;
		try {
			response = await fetch(WEREAD_GATEWAY, {
				method: "POST",
				headers: {
					"Authorization": "Bearer " + this.apiKey.trim(),
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					api_name: apiName,
					skill_version: SKILL_VERSION,
					...params
				}),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS$2)
			});
		} catch (error) {
			throw new WereadApiError("请求微信读书失败（网络错误）: " + String(error instanceof Error ? error.message : error));
		}
		let payload;
		try {
			payload = await response.json();
		} catch {
			throw new WereadApiError("微信读书返回了无法解析的响应（HTTP " + response.status + "）");
		}
		if (!response.ok) throw new WereadApiError("微信读书请求失败（HTTP " + response.status + "）");
		const record = asRecord(payload);
		const upgrade = record.upgrade_info;
		if (upgrade !== void 0) {
			const message = asRecord(upgrade).message;
			throw new WereadApiError("微信读书 Skills 需要升级，请先完成升级再继续：" + (typeof message === "string" ? message : JSON.stringify(upgrade)));
		}
		const errcode = record.errcode;
		if (typeof errcode === "number" && errcode !== 0) throw new WereadApiError(typeof record.errmsg === "string" ? record.errmsg : typeof record.message === "string" ? record.message : "未知错误", errcode);
		return payload;
	}
	/** List every available endpoint and its parameter definition. */
	list() {
		return this.gateway("/_list");
	}
	/** Search the book store. */
	search(keyword, count = 10, scope) {
		return this.gateway("/store/search", {
			keyword,
			count,
			...scope !== void 0 ? { scope } : {}
		});
	}
	/** Book metadata. */
	bookInfo(bookId) {
		return this.gateway("/book/info", { bookId });
	}
	/** Official chapter catalog (metadata only). */
	chapterInfo(bookId) {
		return this.gateway("/book/chapterinfo", { bookId });
	}
	/** Reading progress for one book. */
	getProgress(bookId) {
		return this.gateway("/book/getprogress", { bookId });
	}
	/** The current bookshelf (books + audiobook albums + mp). */
	shelf() {
		return this.gateway("/shelf/sync");
	}
	/** Notebook overview: every book with note/review/bookmark counts. */
	notebooks(count = 50, lastSort) {
		return this.gateway("/user/notebooks", {
			count,
			...lastSort !== void 0 ? { lastSort } : {}
		});
	}
	/** Underlines (highlights) for one book. */
	bookmarklist(bookId) {
		return this.gateway("/book/bookmarklist", { bookId });
	}
	/** Personal thoughts/reviews for one book. */
	reviewListMine(bookid, count = 50, synckey) {
		return this.gateway("/review/list/mine", {
			bookid,
			count,
			...synckey !== void 0 ? { synckey } : {}
		});
	}
	/** Reading statistics. mode: weekly | monthly | annually | overall. */
	readdata(mode, baseTime) {
		return this.gateway("/readdata/detail", {
			mode,
			...baseTime !== void 0 ? { baseTime } : {}
		});
	}
};
//#endregion
//#region src/flomo.ts
/**
* weread-export — flomo export integration.
*
* weread_flomo sends a book's highlights/thoughts to flomo (浮墨笔记).
* It reuses the credentials already configured for the dsh-flomo plugin
* (~/.dsh/dsh-flomo.json, mode 0600): webhookUrl wins over apiKey. The
* flomo tag is fully customizable — the tool's `tag` parameter, or the
* store's defaultFlomoTag (defaults to 微信读书).
*/
/** Config file location shared with dsh-flomo (machine-wide, mode 0600). */
const FLOMO_CONFIG_FILE = path.join(homedir(), ".dsh", "dsh-flomo.json");
/** Request timeout for a flomo POST. */
const REQUEST_TIMEOUT_MS$1 = 2e4;
/** Mask a credential for display, keeping only the head and tail. */
function mask$1(value) {
	if (!value) return "";
	if (value.length <= 8) return value.slice(0, 2) + "****";
	return value.slice(0, 4) + "****" + value.slice(-4);
}
/** Whether flomo credentials exist on this machine. */
async function flomoConfigured() {
	return (await loadFlomoCredentials()).resolved !== null;
}
/** Public flomo status: source + masked credential. */
async function flomoStatus() {
	const creds = await readFlomoCredentials();
	const source = creds.webhookUrl !== "" ? "webhookUrl" : creds.apiKey !== "" ? "apiKey" : "";
	return {
		configured: source !== "",
		source,
		masked: source === "webhookUrl" ? mask$1(creds.webhookUrl) : source === "apiKey" ? mask$1(creds.apiKey) : "",
		configPath: FLOMO_CONFIG_FILE
	};
}
/** Read the persisted flomo credentials (never throws). */
async function readFlomoCredentials() {
	let record = {};
	try {
		const raw = await readFile(FLOMO_CONFIG_FILE, "utf8");
		const parsed = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null) record = parsed;
	} catch {}
	return {
		apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
		webhookUrl: typeof record.webhookUrl === "string" ? record.webhookUrl : ""
	};
}
/**
* Write flomo credentials to the shared ~/.dsh/dsh-flomo.json (mode 0600).
* Shared with the dsh-flomo plugin — one place, both plugins use it.
*/
async function writeFlomoCredentials(next) {
	await mkdir(path.dirname(FLOMO_CONFIG_FILE), { recursive: true });
	await writeFile(FLOMO_CONFIG_FILE, JSON.stringify(next, null, 2), { mode: 384 });
}
/** Load and resolve the flomo send URL (null when not configured). */
async function resolveFlomoUrl() {
	return (await loadFlomoCredentials()).resolved;
}
/** Read ~/.dsh/dsh-flomo.json and resolve the request URL. */
async function loadFlomoCredentials() {
	const creds = await readFlomoCredentials();
	const webhook = creds.webhookUrl.trim();
	if (webhook) return { resolved: webhook };
	const key = creds.apiKey.trim();
	if (key) return { resolved: "https://flomoapp.com/api/prod/apis/webhook/v1/?apiKey=" + encodeURIComponent(key) };
	return { resolved: null };
}
/**
* POST one memo to the flomo logging API. Resolves { ok, message, code? } —
* rejects only for transport-level failures.
*/
async function postMemo(url, content) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS$1)
	});
	const body = await res.text();
	let parsed = null;
	try {
		parsed = JSON.parse(body);
	} catch {}
	if (parsed && typeof parsed === "object" && typeof parsed.code === "number") {
		const record = parsed;
		if (record.code === 0) return {
			ok: true,
			message: "已写入 flomo",
			code: 0
		};
		return {
			ok: false,
			message: "flomo 返回错误: " + String(typeof record.message === "string" ? record.message : JSON.stringify(parsed)),
			code: record.code
		};
	}
	if (!res.ok) return {
		ok: false,
		message: "请求失败（HTTP " + res.status + "）: " + body.slice(0, 300)
	};
	return {
		ok: true,
		message: "flomo 已响应: " + body.slice(0, 300)
	};
}
/** Append normalized #tags to a memo body. */
function buildTaggedContent(content, tags) {
	const body = (content || "").trim();
	const suffix = (tags || "").split(/[\s,，;；]+/).map((t) => t.trim().replace(/^#+/, "")).filter(Boolean).map((t) => "#" + t).join(" ");
	return suffix ? body + " " + suffix : body;
}
//#endregion
//#region src/cache.ts
/**
* weread-export — local sync snapshot & render helpers.
*
* weread_sync pulls the bookshelf and the notebook overview into
* ~/.dsh/weread-export-cache.json (mode 0600) so the settings panel and
* quick actions can render without hammering the gateway. Markdown
* builders here are shared by the tools and the panel routes.
*/
/** Empty snapshot. */
function emptyCache() {
	return {
		updatedAt: "",
		shelfBooks: [],
		albumsCount: 0,
		mpCount: 0,
		notebooks: []
	};
}
/** Read the snapshot (never throws). */
async function readCache() {
	try {
		const raw = await readFile(cachePath(), "utf8");
		const parsed = JSON.parse(raw);
		const record = typeof parsed === "object" && parsed !== null ? parsed : {};
		const books = Array.isArray(record.shelfBooks) ? record.shelfBooks : [];
		const notebooks = Array.isArray(record.notebooks) ? record.notebooks : [];
		return {
			updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
			shelfBooks: books,
			albumsCount: typeof record.albumsCount === "number" ? record.albumsCount : 0,
			mpCount: typeof record.mpCount === "number" ? record.mpCount : 0,
			notebooks
		};
	} catch {
		return emptyCache();
	}
}
/** Persist the snapshot (mode 0600). */
async function writeCache(next) {
	await mkdir(path.dirname(cachePath()), { recursive: true });
	await writeFile(cachePath(), JSON.stringify(next, null, 2), { mode: 384 });
}
/** Pull shelf + notebooks into the snapshot. */
async function doSync(api) {
	const [shelf, notebooksFirst] = await Promise.all([api.shelf(), api.notebooks(200)]);
	const books = Array.isArray(shelf.books) ? shelf.books : [];
	const albums = Array.isArray(shelf.albums) ? shelf.albums : [];
	const mpCount = shelf.mp !== void 0 && shelf.mp !== null ? 1 : 0;
	const entries = [...Array.isArray(notebooksFirst.books) ? notebooksFirst.books : []];
	let lastSort = entries.length > 0 ? entries[entries.length - 1]?.sort ?? void 0 : void 0;
	let hasMore = notebooksFirst.hasMore === true || notebooksFirst.hasMore === 1;
	let page = 1;
	while (hasMore && page < 5 && lastSort !== void 0) {
		const next = await api.notebooks(200, lastSort);
		const nextBooks = Array.isArray(next.books) ? next.books : [];
		if (nextBooks.length === 0) break;
		entries.push(...nextBooks);
		lastSort = nextBooks[nextBooks.length - 1]?.sort ?? lastSort;
		hasMore = next.hasMore === true || next.hasMore === 1;
		page += 1;
	}
	const cache = {
		updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		shelfBooks: books,
		albumsCount: albums.length,
		mpCount,
		notebooks: entries
	};
	await writeCache(cache);
	const noteBooks = entries.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0);
	return {
		ok: true,
		message: "同步完成：书架 " + books.length + " 本书" + (albums.length > 0 ? "、有声书 " + albums.length + " 部" : "") + (mpCount > 0 ? "、公众号 1 个" : "") + "；有笔记的书 " + noteBooks.length + " 本（笔记/想法/书签共 " + String(notebooksFirst.totalNoteCount ?? "?") + " 条）。",
		cache
	};
}
const WEEKDAYS = [
	"日",
	"一",
	"二",
	"三",
	"四",
	"五",
	"六"
];
/** Unix seconds → 'YYYY-MM-DD' (local); '' for missing values. */
function formatDate(ts) {
	if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "";
	const d = /* @__PURE__ */ new Date(ts * 1e3);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n) => String(n).padStart(2, "0");
	return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
/** Local date label 'YYYY-MM-DD（周X）'. */
function dateLabel(date) {
	const pad = (n) => String(n).padStart(2, "0");
	return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "（周" + WEEKDAYS[date.getDay()] + "）";
}
/** Seconds → 'X小时Y分钟' / 'N分钟' / 'N秒'. */
function formatDuration(seconds) {
	if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "0分钟";
	const total = Math.round(seconds);
	if (total < 60) return total + "秒";
	if (total < 3600) return Math.floor(total / 60) + "分钟";
	const h = Math.floor(total / 3600);
	const m = Math.floor(total % 3600 / 60);
	return m > 0 ? h + "小时" + m + "分钟" : h + "小时";
}
/** Rating display: the gateway returns a 0-100 score; show as 0-10. */
function formatRating(n) {
	if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "";
	return (n > 10 ? n / 10 : n).toFixed(1);
}
/** Book detail deep link, preferring the service-provided one. */
function deepLink(bookId, provided) {
	if (typeof provided === "string" && provided !== "") return provided;
	if (typeof bookId === "string" && bookId !== "") return "https://weread.qq.com/web/bookDetail/" + bookId;
	return "";
}
/** ChapterUid → title map for note rendering. */
function chapterTitleMap(chapters) {
	const map = /* @__PURE__ */ new Map();
	if (Array.isArray(chapters)) {
		for (const chapter of chapters) if (typeof chapter.chapterUid === "number" && typeof chapter.title === "string") map.set(chapter.chapterUid, chapter.title);
	}
	return map;
}
/** One-line shelf entry. */
function shelfLine(book, progressByBookId) {
	const progress = progressByBookId.get(book.bookId ?? "");
	const finished = book.finishReading === true || book.finishReading === 1;
	const progressText = typeof progress === "number" && progress > 0 && progress < 100 ? " 在读 " + progress + "%" : progress === 100 || finished ? " 已读完" : "";
	const time = formatDate(book.readUpdateTime);
	const timeText = time !== "" ? "（更新于 " + time + "）" : "";
	return "- 《" + (book.title ?? "未知书名") + "》· " + (book.author ?? "未知作者") + progressText + timeText;
}
/** Notebook overview lines (笔记数 = 划线 + 想法 + 书签). */
function notebookLines(entries) {
	const lines = [];
	for (const entry of entries) {
		const review = entry.reviewCount ?? 0;
		const note = entry.noteCount ?? 0;
		const bookmark = entry.bookmarkCount ?? 0;
		const total = review + note + bookmark;
		if (total <= 0) continue;
		lines.push("- 《" + (entry.book?.title ?? entry.bookId ?? "未知书名") + "》：共 " + total + " 条（划线 " + note + " · 想法 " + review + " · 书签 " + bookmark + "）" + (typeof entry.readingProgress === "number" && entry.readingProgress > 0 ? " · 进度 " + entry.readingProgress + "%" : ""));
	}
	return lines;
}
/** Per-book notes markdown: highlights + thoughts. */
function buildNotesMarkdown(title, author, highlights, thoughts, chapters) {
	const chapterMap = chapterTitleMap(chapters);
	const lines = ["📖 《" + title + "》" + (author ? " · " + author : "")];
	if (highlights.length > 0) {
		lines.push("", "## 划线 " + highlights.length + " 条");
		for (const h of highlights) {
			const chapter = typeof h.chapterUid === "number" ? chapterMap.get(h.chapterUid) : void 0;
			const time = formatDate(h.createTime);
			lines.push("- “" + (h.markText ?? "").trim() + "”" + (chapter ? "（" + chapter + "）" : "") + (time !== "" ? " · " + time : ""));
		}
	}
	if (thoughts.length > 0) {
		lines.push("", "## 想法 " + thoughts.length + " 条");
		for (const entry of thoughts) {
			const review = entry.review;
			if (!review) continue;
			const chapter = review.chapterName ?? "";
			const time = formatDate(review.createTime);
			const abstract = (review.abstract ?? "").trim();
			const abstractText = abstract !== "" && abstract !== review.content ? "\n  > 原文：" + abstract : "";
			lines.push("- " + (review.content ?? "").trim() + abstractText + (chapter ? "（" + chapter + "）" : "") + (time !== "" ? " · " + time : ""));
		}
	}
	if (highlights.length === 0 && thoughts.length === 0) lines.push("（这本书暂无划线与想法）");
	return lines.join("\n");
}
/** One flomo memo body for a book's highlights (truncated at `limit`). */
function buildFlomoMemo(title, highlights, chapters, total, limit) {
	const chapterMap = chapterTitleMap(chapters);
	const lines = ["📖《" + title + "》划线摘录 · 共 " + total + " 条"];
	for (const h of highlights.slice(0, limit)) {
		const chapter = typeof h.chapterUid === "number" ? chapterMap.get(h.chapterUid) : void 0;
		lines.push("- “" + (h.markText ?? "").trim() + "”" + (chapter ? "（" + chapter + "）" : ""));
	}
	if (total > limit) lines.push("…（共 " + total + " 条，仅导出前 " + limit + " 条）");
	return lines.join("\n");
}
/** Safe per-memo size cap (flomo does not document a hard limit; stay conservative). */
const FLOMO_MAX_CHARS = 1800;
/**
* Split a book's highlights into one or more flomo memo bodies so that
* ALL highlights are exported — long lists are chunked by character count,
* never truncated. A single over-long highlight becomes its own memo.
*/
function buildFlomoMemos(title, highlights, chapters, maxChars = FLOMO_MAX_CHARS) {
	const chapterMap = chapterTitleMap(chapters);
	const header = "📖《" + title + "》划线摘录 · 共 " + highlights.length + " 条";
	const memos = [];
	let current = header;
	for (const h of highlights) {
		const chapter = typeof h.chapterUid === "number" ? chapterMap.get(h.chapterUid) : void 0;
		const line = "- “" + (h.markText ?? "").trim() + "”" + (chapter ? "（" + chapter + "）" : "");
		if (current.length + 1 + line.length > maxChars && current !== header) {
			memos.push(current);
			current = header + "（续）";
		}
		current += "\n" + line;
	}
	memos.push(current);
	return memos;
}
//#endregion
//#region src/llm.ts
/** Request timeout for one chat completion. */
const REQUEST_TIMEOUT_MS = 6e4;
/** Is the LLM configured (key + base url + model present)? */
function llmConfigured(config) {
	return config.apiKey.trim() !== "" && config.baseUrl.trim() !== "" && config.model.trim() !== "";
}
/**
* One chat completion. Resolves the assistant text; rejects with a readable
* error on transport or API failures.
*/
async function chatComplete(config, system, user) {
	if (!llmConfigured(config)) throw new Error("LLM 未配置：请在设置面板「AI」区填写 API Key / Base URL / 模型。");
	const base = config.baseUrl.trim().replace(/\/+$/, "");
	const url = base.endsWith("/chat/completions") ? base : base + "/chat/completions";
	let response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Authorization": "Bearer " + config.apiKey.trim(),
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: config.model.trim(),
				messages: [{
					role: "system",
					content: system
				}, {
					role: "user",
					content: user
				}],
				temperature: .4,
				max_tokens: 4e3,
				stream: false
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
	} catch (error) {
		throw new Error("LLM 请求失败（网络错误）: " + String(error instanceof Error ? error.message : error));
	}
	let payload;
	try {
		payload = await response.json();
	} catch {
		throw new Error("LLM 返回了无法解析的响应（HTTP " + response.status + "）");
	}
	if (!response.ok) {
		const record = typeof payload === "object" && payload !== null ? payload : {};
		const message = typeof record.message === "string" ? record.message : typeof record.error === "object" && record.error !== null ? String(record.error.message ?? JSON.stringify(record.error)) : "HTTP " + response.status;
		throw new Error("LLM 请求失败: " + message);
	}
	const choices = (typeof payload === "object" && payload !== null ? payload : {}).choices;
	if (!Array.isArray(choices) || choices.length === 0) throw new Error("LLM 响应缺少 choices");
	const first = choices[0];
	const message = typeof first.message === "object" && first.message !== null ? first.message : {};
	return typeof message.content === "string" ? message.content : "";
}
/**
* Fill {title} / {author} / {highlights} / {thoughts} placeholders in a
* prompt template.
*/
function renderPrompt(template, vars) {
	return template.replaceAll("{title}", vars.title).replaceAll("{author}", vars.author).replaceAll("{highlights}", vars.highlights).replaceAll("{thoughts}", vars.thoughts);
}
//#endregion
//#region src/export.ts
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
/** Render full export markdown: highlights + thoughts with chapter/time. */
function buildExportMarkdown(title, author, highlights, thoughts, chapters) {
	const chapterMap = chapterTitleMap(chapters);
	const lines = ["# 《" + title + "》" + (author ? " · " + author : "")];
	if (highlights.length > 0) {
		lines.push("", "## 划线 " + highlights.length + " 条");
		for (const h of highlights) {
			const chapter = typeof h.chapterUid === "number" ? chapterMap.get(h.chapterUid) : void 0;
			const time = formatDate(h.createTime);
			lines.push("- “" + (h.markText ?? "").trim() + "”" + (chapter ? "（" + chapter + "）" : "") + (time !== "" ? " · " + time : ""));
		}
	}
	if (thoughts.length > 0) {
		lines.push("", "## 想法 " + thoughts.length + " 条");
		for (const entry of thoughts) {
			const review = entry.review;
			if (!review) continue;
			const chapter = review.chapterName ?? "";
			const time = formatDate(review.createTime);
			const abstract = (review.abstract ?? "").trim();
			const abstractText = abstract !== "" && abstract !== review.content ? "\n  > 原文：" + abstract : "";
			lines.push("- " + (review.content ?? "").trim() + abstractText + (chapter ? "（" + chapter + "）" : "") + (time !== "" ? " · " + time : ""));
		}
	}
	if (highlights.length === 0 && thoughts.length === 0) lines.push("（这本书暂无划线与想法）");
	return lines.join("\n") + "\n";
}
/** Run export text through the configured LLM prompt. */
async function processWithPrompt(llm, promptTemplate, vars) {
	return chatComplete(llm, "你是读书笔记整理助手，请严格按用户的 prompt 要求输出。", renderPrompt(promptTemplate, vars));
}
/** Write content to <dir>/<title>.md; creates the directory. */
async function exportToLocal(dir, title, content) {
	const targetDir = dir.trim();
	if (targetDir === "") throw new Error("本地导出需要填写目标目录（不设默认值）。");
	const safe = title.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "未命名";
	await mkdir(targetDir, { recursive: true });
	const file = path.join(targetDir, safe + ".md");
	await writeFile(file, content, "utf8");
	return file;
}
/** Notion REST base URL. */
const NOTION_API = "https://api.notion.com";
/** API version header (covers every endpoint used here). */
const NOTION_VERSION = "2022-06-28";
/** Notion allows at most 100 blocks per create/append call. */
const NOTION_BLOCKS_PER_CALL = 100;
/** Normalize a Notion page URL / id to the 32-char page id. */
function normalizeNotionPageId(input) {
	const value = input.trim();
	if (value === "") throw new Error("请填写 Notion 目标页面 URL 或 ID。");
	const hex = value.match(/[0-9a-f]{32}/i);
	if (hex) return hex[0].toLowerCase();
	const compact = value.replace(/-/g, "");
	if (/^[0-9a-f]{32}$/i.test(compact)) return compact.toLowerCase();
	throw new Error("无法识别 Notion 页面 ID：请粘贴页面链接或 32 位页面 ID。");
}
/** Split markdown text into Notion paragraph blocks. */
function toNotionBlocks(content) {
	const lines = content.split("\n").map((l) => l.trimEnd());
	const blocks = [];
	for (const line of lines) {
		if (line === "") continue;
		blocks.push({
			object: "block",
			type: "paragraph",
			paragraph: { rich_text: [{
				type: "text",
				text: { content: line.slice(0, 2e3) }
			}] }
		});
	}
	return blocks;
}
/** One Notion API call with normalized errors. */
async function notionCall(token, method, apiPath, body) {
	let response;
	try {
		response = await fetch(NOTION_API + apiPath, {
			method,
			headers: {
				"Authorization": "Bearer " + token.trim(),
				"Notion-Version": NOTION_VERSION,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		});
	} catch (error) {
		throw new Error("Notion 请求失败（网络错误）: " + String(error instanceof Error ? error.message : error));
	}
	let payload;
	try {
		payload = await response.json();
	} catch {
		throw new Error("Notion 返回了无法解析的响应（HTTP " + response.status + "）");
	}
	if (!response.ok) {
		const record = typeof payload === "object" && payload !== null ? payload : {};
		const message = typeof record.message === "string" ? record.message : "HTTP " + response.status;
		throw new Error("Notion API 错误: " + message);
	}
	return typeof payload === "object" && payload !== null ? payload : {};
}
/**
* Create a child page under the target parent page with the export content,
* appending extra blocks in batches if needed.
*/
async function exportToNotion(token, parentId, title, content) {
	if (token.trim() === "") throw new Error("Notion 未配置：请先在设置面板「Notion」区填写 Integration Token。");
	const pageId = normalizeNotionPageId(parentId);
	const blocks = toNotionBlocks(content);
	const children = blocks.slice(0, NOTION_BLOCKS_PER_CALL);
	const created = await notionCall(token, "POST", "/v1/pages", {
		parent: { page_id: pageId },
		properties: { title: { title: [{ text: { content: title.slice(0, 200) } }] } },
		children
	});
	const newPageId = typeof created.id === "string" ? created.id : "";
	for (let offset = NOTION_BLOCKS_PER_CALL; offset < blocks.length; offset += NOTION_BLOCKS_PER_CALL) {
		const batch = blocks.slice(offset, offset + NOTION_BLOCKS_PER_CALL);
		await notionCall(token, "PATCH", "/v1/blocks/" + newPageId + "/children", { children: batch });
	}
	return newPageId;
}
/** Send text to flomo, chunking by size (never truncates). */
async function exportToFlomo(flomoUrl, title, content, tag) {
	const memos = chunkText(content, FLOMO_MAX_CHARS, title);
	let sent = 0;
	let failed = 0;
	for (const memo of memos) if ((await postMemo(flomoUrl, buildTaggedContent(memo, tag))).ok) sent += 1;
	else failed += 1;
	const message = sent > 0 ? "已导出到 flomo（#" + tag + "）：" + sent + " 条 MEMO 发送成功" + (failed > 0 ? "，" + failed + " 条失败" : "") + "。" : "flomo 发送失败：全部 " + memos.length + " 条 MEMO 发送失败";
	return {
		sent,
		memoCount: memos.length,
		failed,
		message
	};
}
/** Split arbitrary text into size-capped chunks with a small header. */
function chunkText(text, maxChars, title) {
	const header = "📖《" + title + "》";
	const memos = [];
	let current = header;
	const lines = text.split("\n");
	for (const line of lines) {
		if (current.length + 1 + line.length > maxChars && current !== header) {
			memos.push(current);
			current = header + "（续）";
		}
		current += "\n" + line;
	}
	memos.push(current);
	return memos;
}
//#endregion
//#region src/tools.ts
/** One text content block (the only render shape these tools emit). */
function text(value) {
	return [{
		type: "text",
		text: value
	}];
}
/** Readable error for API failures. */
function apiError(err) {
	if (err instanceof WereadApiError) return err.message;
	return String(err instanceof Error ? err.message : err);
}
/** Build the api client from the store's current key (throws when unconfigured). */
async function requireApi(ctx) {
	return new WereadApi((await ctx.store.load()).apiKey);
}
/** Masked-ish summary for search book entries. */
function formatSearchBook(entry) {
	const info = entry.bookInfo ?? {};
	const rating = formatRating(entry.newRating);
	const reading = typeof entry.readingCount === "number" && entry.readingCount > 0 ? "在读 " + formatCount(entry.readingCount) : "";
	const link = deepLink(info.bookId, info.deepLink);
	return "- 《" + (info.title ?? "未知书名") + "》· " + (info.author ?? "未知作者") + (rating !== "" ? " · 评分 " + rating : "") + (reading !== "" ? " · " + reading : "") + " · bookId=" + (info.bookId ?? "?") + (link !== "" ? "\n  " + link : "");
}
/** 12000 → 1.2万, 1234567 → 123万. */
function formatCount(n) {
	if (n >= 1e8) return (n / 1e8).toFixed(1) + "亿";
	if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
	return String(n);
}
/** Status tool: configuration + cache + export targets. */
function wereadStatusTool(ctx) {
	return defineTool$1({
		name: "weread_status",
		description: "查看 weread-export 插件状态：微信读书 API Key 配置、默认 flomo 标签、导出条数（0=全部）、默认导出目标（flomo/本地/Notion）、Notion 与 LLM（prompt 处理）配置状态、最近同步、缓存规模。不会泄露任何 Key。",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					configured: { type: "boolean" },
					apiKeyMasked: { type: "string" },
					defaultFlomoTag: { type: "string" },
					exportLimit: { type: "number" },
					exportDest: { type: "string" },
					localExportDir: { type: "string" },
					notionConfigured: { type: "boolean" },
					notionTargetPageId: { type: "string" },
					usePrompt: { type: "boolean" },
					llmConfigured: { type: "boolean" },
					llmBaseUrl: { type: "string" },
					llmModel: { type: "string" },
					lastSyncAt: { type: "string" },
					flomoConfigured: { type: "boolean" },
					configPath: { type: "string" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute() {
			const view = await ctx.store.view();
			const cache = await readCache();
			const flomoOk = await flomoConfigured();
			const destLabel = view.exportDest === "local" ? "本地文件" : view.exportDest === "notion" ? "Notion" : "flomo";
			return {
				ok: true,
				message: [
					view.configured ? "已配置：API Key " + view.apiKeyMasked + "（在 https://weread.qq.com/r/weread-skills 创建）" : "未配置：请先调用 weread_config 填入 API Key（https://weread.qq.com/r/weread-skills 登录后「创建 Key」）。",
					"默认导出目标：" + destLabel + (view.exportDest === "local" ? view.localExportDir !== "" ? "（" + view.localExportDir + "）" : "（未设路径，导出时需指定）" : "") + (view.exportDest === "notion" ? view.notionConfigured && view.notionTargetPageId !== "" ? "（目标页 " + view.notionTargetPageId + "）" : "（Notion 未配置完整）" : ""),
					"默认 flomo 标签：#" + view.defaultFlomoTag + (flomoOk ? "（flomo 已配置）" : "（flomo 未配置，flomo 导出不可用）"),
					"导出条数：" + (view.exportLimit === 0 ? "全部导出（超长自动拆多条 MEMO）" : "最多 " + view.exportLimit + " 条"),
					"prompt 处理：" + (view.usePrompt ? "已开启（LLM " + (view.llmConfigured ? view.llmModel + " @ " + view.llmBaseUrl : "未配置") + "）" : "关闭"),
					"Notion：" + (view.notionConfigured ? "已配置 token" + (view.notionTargetPageId !== "" ? " + 目标页" : "（未填目标页）") : "未配置"),
					"最近同步：" + (view.lastSyncAt !== "" ? view.lastSyncAt : "从未同步（可 weread_sync）"),
					"缓存：书架 " + cache.shelfBooks.length + " 本 · 有笔记的书 " + cache.notebooks.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0).length + " 本",
					"配置路径：" + view.configPath
				].join("\n"),
				configured: view.configured,
				apiKeyMasked: view.apiKeyMasked,
				defaultFlomoTag: view.defaultFlomoTag,
				exportLimit: view.exportLimit,
				exportDest: view.exportDest,
				localExportDir: view.localExportDir,
				notionConfigured: view.notionConfigured,
				notionTargetPageId: view.notionTargetPageId,
				usePrompt: view.usePrompt,
				llmConfigured: view.llmConfigured,
				llmBaseUrl: view.llmBaseUrl,
				llmModel: view.llmModel,
				lastSyncAt: view.lastSyncAt,
				flomoConfigured: flomoOk,
				configPath: view.configPath
			};
		}
	});
}
/** Config tool: set/clear the API key, default flomo tag, and export limit. */
function wereadConfigTool(ctx) {
	return defineTool$1({
		name: "weread_config",
		description: "配置或清除 weread-export 的凭据与导出偏好：apiKey 为微信读书 Skills API Key（wrk- 开头，https://weread.qq.com/r/weread-skills 创建）；defaultFlomoTag 为 flomo 导出默认标签；exportLimit 为导出条数（0=全部）；exportDest 为默认导出目标（flomo/local/notion）；localExportDir 为本地导出目录；notionToken/notionTargetPageId 为 Notion 导出凭据与目标页；usePrompt/exportPrompt 为 LLM prompt 处理开关与模板；llmBaseUrl/llmApiKey/llmModel 为 LLM 配置（OpenAI 兼容）。test: true 保存后测试微信读书连接。reset: true 清除全部。凭据存 ~/.dsh/weread-export.json（0600）。",
		parameters: {
			apiKey: {
				type: "string",
				description: "微信读书 Skills API Key（wrk- 开头）"
			},
			defaultFlomoTag: {
				type: "string",
				description: "flomo 导出默认标签（不带 #，如 读书笔记）"
			},
			exportLimit: {
				type: "number",
				description: "每次导出的划线条数：0=全部导出，N>0=最多 N 条（默认 20）"
			},
			exportDest: {
				type: "string",
				enum: [
					"flomo",
					"local",
					"notion"
				],
				description: "默认导出目标（weread_export 不传 dest 时使用）"
			},
			localExportDir: {
				type: "string",
				description: "本地导出目录（dest=local 时用，导出时也可临时传 localDir）"
			},
			notionToken: {
				type: "string",
				description: "Notion Integration Token（本插件独立配置，页面需分享给该 Integration）"
			},
			notionTargetPageId: {
				type: "string",
				description: "Notion 目标父页面 URL 或 32 位页面 ID"
			},
			usePrompt: {
				type: "boolean",
				description: "是否用 LLM 按 prompt 整理后再导出"
			},
			exportPrompt: {
				type: "string",
				description: "导出 prompt 模板，占位符 {title}/{author}/{highlights}/{thoughts}"
			},
			llmBaseUrl: {
				type: "string",
				description: "LLM Base URL（OpenAI 兼容，默认 https://api.deepseek.com/v1）"
			},
			llmApiKey: {
				type: "string",
				description: "LLM API Key"
			},
			llmModel: {
				type: "string",
				description: "LLM 模型名（默认 deepseek-chat）"
			},
			test: {
				type: "boolean",
				description: "true 时保存后立即测试微信读书连接"
			},
			reset: {
				type: "boolean",
				description: "设为 true 清除全部凭据"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					configured: { type: "boolean" },
					apiKeyMasked: { type: "string" },
					defaultFlomoTag: { type: "string" },
					exportLimit: { type: "number" },
					exportDest: { type: "string" },
					localExportDir: { type: "string" },
					notionConfigured: { type: "boolean" },
					notionTargetPageId: { type: "string" },
					usePrompt: { type: "boolean" },
					llmConfigured: { type: "boolean" },
					llmBaseUrl: { type: "string" },
					llmModel: { type: "string" },
					lastSyncAt: { type: "string" },
					configPath: { type: "string" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			const view = await ctx.store.patch(args);
			if (!view.configured) return {
				ok: false,
				message: "配置未生效：缺少 API Key。请在 https://weread.qq.com/r/weread-skills 登录后创建 Key 并填入。",
				configured: view.configured,
				apiKeyMasked: view.apiKeyMasked,
				defaultFlomoTag: view.defaultFlomoTag,
				exportLimit: view.exportLimit,
				exportDest: view.exportDest,
				localExportDir: view.localExportDir,
				notionConfigured: view.notionConfigured,
				notionTargetPageId: view.notionTargetPageId,
				usePrompt: view.usePrompt,
				llmConfigured: view.llmConfigured,
				llmBaseUrl: view.llmBaseUrl,
				llmModel: view.llmModel,
				lastSyncAt: view.lastSyncAt,
				configPath: view.configPath
			};
			const parts = [
				"已保存配置：API Key " + view.apiKeyMasked,
				"默认 flomo 标签 #" + view.defaultFlomoTag,
				"导出策略 " + (view.exportLimit === 0 ? "全部导出" : "最多 " + view.exportLimit + " 条"),
				"默认目标 " + view.exportDest
			];
			if (view.usePrompt) parts.push("prompt 处理已开启（" + (view.llmConfigured ? view.llmModel + " @ " + view.llmBaseUrl : "LLM 未配置") + "）");
			if (view.notionConfigured) parts.push("Notion 已配置" + (view.notionTargetPageId !== "" ? "（目标页 " + view.notionTargetPageId + "）" : "（未填目标页）"));
			if (args?.test === true) try {
				await (await requireApi(ctx)).list();
				parts.push("连接测试：成功（网关可用）");
			} catch (error) {
				parts.push("连接测试：失败（" + apiError(error) + "）");
			}
			return {
				ok: true,
				message: parts.join("；") + "。",
				configured: view.configured,
				apiKeyMasked: view.apiKeyMasked,
				defaultFlomoTag: view.defaultFlomoTag,
				exportLimit: view.exportLimit,
				exportDest: view.exportDest,
				localExportDir: view.localExportDir,
				notionConfigured: view.notionConfigured,
				notionTargetPageId: view.notionTargetPageId,
				usePrompt: view.usePrompt,
				llmConfigured: view.llmConfigured,
				llmBaseUrl: view.llmBaseUrl,
				llmModel: view.llmModel,
				lastSyncAt: view.lastSyncAt,
				configPath: view.configPath
			};
		}
	});
}
/** Search tool: book store search. */
function wereadSearchTool(ctx) {
	return defineTool$1({
		name: "weread_search",
		description: "在微信读书书城搜索书籍：按关键词返回书名、作者、评分（0-10）、在读人数、bookId 与跳转链接。scope 搜索类型：10=电子书（默认）、0=全部、16=网文小说、14=有声书/专辑、6=作者、12=全文、13=书单、2=公众号、4=文章。拿到 bookId 后可继续用 weread_book（详情/进度/章节）、weread_notes（划线/想法）。",
		parameters: {
			keyword: {
				type: "string",
				required: true,
				description: "搜索关键词（书名/作者）"
			},
			scope: {
				type: "number",
				description: "搜索类型（默认 10=电子书；0=全部；16=网文；14=听书；6=作者；12=全文）"
			},
			count: {
				type: "number",
				description: "返回条数上限（默认 10）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					count: { type: "number" },
					keyword: { type: "string" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			const keyword = (args?.keyword ?? "").trim();
			if (keyword === "") return {
				ok: false,
				message: "请提供搜索关键词 keyword。"
			};
			const count = typeof args?.count === "number" && args.count > 0 ? Math.min(Math.floor(args.count), 50) : 10;
			const scope = typeof args?.scope === "number" ? args.scope : 10;
			let data;
			try {
				data = await (await requireApi(ctx)).search(keyword, count, scope);
			} catch (error) {
				return {
					ok: false,
					message: "搜索失败：" + apiError(error)
				};
			}
			const entries = (data.results ?? []).flatMap((r) => Array.isArray(r.books) ? r.books : []);
			const lines = entries.length === 0 ? ["（没有找到相关书籍）"] : entries.slice(0, count).map(formatSearchBook);
			return {
				ok: true,
				message: "「" + keyword + "」搜索结果（" + entries.length + " 条）：\n" + lines.join("\n"),
				count: entries.length,
				keyword
			};
		}
	});
}
/** Book tool: metadata + progress + chapter catalog summary. */
function wereadBookTool(ctx) {
	return defineTool$1({
		name: "weread_book",
		description: "查看微信读书单本书详情：作者/出版社/分类/字数/评分/简介 + 阅读进度 + 章节目录概览（章节数、各级章节数）。bookId 来自 weread_search 或 weread_shelf。",
		parameters: { bookId: {
			type: "string",
			required: true,
			description: "书籍 bookId"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					bookId: { type: "string" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			const bookId = (args?.bookId ?? "").trim();
			if (bookId === "") return {
				ok: false,
				message: "请提供 bookId。"
			};
			const api = await requireApi(ctx);
			try {
				const [info, progress, chapters] = await Promise.all([
					api.bookInfo(bookId),
					api.getProgress(bookId),
					api.chapterInfo(bookId).catch(() => void 0)
				]);
				const lines = ["📖 《" + (info.title ?? "未知书名") + "》· " + (info.author ?? "未知作者")];
				const meta = [];
				const rating = formatRating(info.newRating);
				if (rating !== "") meta.push("评分 " + rating + (typeof info.newRatingCount === "number" && info.newRatingCount > 0 ? "（" + formatCount(info.newRatingCount) + " 人）" : ""));
				if (info.category) meta.push(info.category);
				if (info.publisher) meta.push(info.publisher);
				if (typeof info.wordCount === "number" && info.wordCount > 0) meta.push(formatCount(info.wordCount) + " 字");
				if (meta.length > 0) lines.push("信息：" + meta.join(" · "));
				if (info.intro) lines.push("简介：" + info.intro.slice(0, 200) + (info.intro.length > 200 ? "…" : ""));
				const progressValue = progress.book?.progress;
				if (typeof progressValue === "number") {
					const time = formatDate(progress.book?.updateTime);
					lines.push("阅读进度：" + progressValue + "%" + (progressValue >= 100 ? "（已读完）" : "") + (time !== "" ? "（更新于 " + time + "）" : ""));
				}
				const recordTime = progress.book?.recordReadingTime;
				if (typeof recordTime === "number" && recordTime > 0) lines.push("累计阅读：" + formatDuration(recordTime));
				const chapterList = chapters?.chapters;
				if (Array.isArray(chapterList) && chapterList.length > 0) {
					const topLevel = chapterList.filter((c) => (c.level ?? 1) === 1).length;
					lines.push("章节：共 " + chapterList.length + " 章" + (topLevel > 0 && topLevel < chapterList.length ? "（一级章节 " + topLevel + "）" : ""));
					const first = chapterList.slice(0, 5).map((c) => c.title ?? "").filter(Boolean);
					if (first.length > 0) lines.push("  前几章：" + first.join(" / "));
				}
				const link = deepLink(bookId, info.deepLink);
				if (link !== "") lines.push("链接：" + link);
				return {
					ok: true,
					message: lines.join("\n"),
					bookId
				};
			} catch (error) {
				return {
					ok: false,
					message: "查询书籍失败：" + apiError(error),
					bookId
				};
			}
		}
	});
}
/** Shelf tool: live bookshelf (optionally from cache). */
function wereadShelfTool(ctx) {
	return defineTool$1({
		name: "weread_shelf",
		description: "查看微信读书书架：返回书籍列表（书名/作者/进度/最近阅读时间/是否读完）与有声书、公众号条目数。默认实时拉取；useCache: true 时读本地缓存（先 weread_sync）。",
		parameters: {
			useCache: {
				type: "boolean",
				description: "true 时读本地缓存而非实时拉取"
			},
			limit: {
				type: "number",
				description: "最多展示条数（默认 100）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					bookCount: { type: "number" },
					albumsCount: { type: "number" },
					mpCount: { type: "number" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			const api = await requireApi(ctx);
			const limit = typeof args?.limit === "number" && args.limit > 0 ? Math.min(Math.floor(args.limit), 200) : 100;
			try {
				if (args?.useCache === true) {
					const cache = await readCache();
					if (cache.shelfBooks.length === 0 && cache.updatedAt === "") return {
						ok: false,
						message: "本地缓存为空：请先 weread_sync 或去掉 useCache 实时拉取。",
						bookCount: 0,
						albumsCount: 0,
						mpCount: 0
					};
					return renderShelf(cache.shelfBooks, cache.albumsCount, cache.mpCount, cache.notebooks, limit, "缓存（更新于 " + (cache.updatedAt !== "" ? formatDate(Math.floor(new Date(cache.updatedAt).getTime() / 1e3)) : "?") + "）");
				}
				const [shelf, notebooks] = await Promise.all([api.shelf(), api.notebooks(200).catch(() => void 0)]);
				const books = Array.isArray(shelf.books) ? shelf.books : [];
				const albums = Array.isArray(shelf.albums) ? shelf.albums : [];
				const mpCount = shelf.mp !== void 0 && shelf.mp !== null ? 1 : 0;
				const notebookEntries = Array.isArray(notebooks?.books) ? notebooks.books : [];
				return renderShelf(books, albums.length, mpCount, notebookEntries, limit, "实时");
			} catch (error) {
				return {
					ok: false,
					message: "拉取书架失败：" + apiError(error),
					bookCount: 0,
					albumsCount: 0,
					mpCount: 0
				};
			}
		}
	});
}
/** Shared shelf renderer. */
function renderShelf(books, albumsCount, mpCount, notebookEntries, limit, source) {
	const progressByBookId = /* @__PURE__ */ new Map();
	for (const entry of notebookEntries) if (typeof entry.readingProgress === "number" && entry.bookId !== void 0) progressByBookId.set(entry.bookId, entry.readingProgress);
	const lines = books.slice(0, limit).map((book) => shelfLine(book, progressByBookId));
	const extra = books.length > limit ? "\n…（共 " + books.length + " 本，仅展示前 " + limit + " 本）" : "";
	return {
		ok: true,
		message: "书架可见条目共 " + (books.length + albumsCount + mpCount) + "：" + books.length + " 本电子书" + (albumsCount > 0 ? " + " + albumsCount + " 部有声书" : "") + (mpCount > 0 ? " + " + mpCount + " 个文章收藏" : "") + "（" + source + "）：" + (lines.length > 0 ? "\n" + lines.join("\n") + extra : "\n（书架为空）"),
		bookCount: books.length,
		albumsCount,
		mpCount
	};
}
/** Notes tool: notebook overview or per-book highlights + thoughts. */
function wereadNotesTool(ctx) {
	return defineTool$1({
		name: "weread_notes",
		description: "查看微信读书笔记：不给 bookId 时返回「笔记本概览」（所有有笔记的书，含划线/想法/笔记数、阅读进度）；给 bookId 时返回该书全部划线（markText + 章节 + 时间）与想法（点评 + 章节 + 时间），并附跳转链接。",
		parameters: {
			bookId: {
				type: "string",
				description: "书籍 bookId（省略=笔记本概览）"
			},
			count: {
				type: "number",
				description: "概览模式返回条数上限（默认 50）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					bookId: { type: "string" },
					highlightCount: { type: "number" },
					reviewCount: { type: "number" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			const api = await requireApi(ctx);
			const bookId = (args?.bookId ?? "").trim();
			if (bookId === "") try {
				const data = await api.notebooks(typeof args?.count === "number" && args.count > 0 ? Math.min(Math.floor(args.count), 200) : 50);
				const lines = notebookLines(Array.isArray(data.books) ? data.books : []);
				return {
					ok: true,
					message: "笔记本概览（共 " + String(data.totalBookCount ?? "?") + " 本书、" + String(data.totalNoteCount ?? "?") + " 条笔记/想法/划线）：\n" + (lines.length > 0 ? lines.join("\n") : "（暂无笔记）"),
					highlightCount: 0,
					reviewCount: 0
				};
			} catch (error) {
				return {
					ok: false,
					message: "拉取笔记本概览失败：" + apiError(error)
				};
			}
			try {
				const [bookmarks, reviews, info] = await Promise.all([
					api.bookmarklist(bookId),
					api.reviewListMine(bookId, 50).catch(() => void 0),
					api.bookInfo(bookId).catch(() => void 0)
				]);
				const highlights = Array.isArray(bookmarks.updated) ? bookmarks.updated : [];
				const thoughts = Array.isArray(reviews?.reviews) ? reviews.reviews : [];
				const markdown = buildNotesMarkdown(info?.title ?? "未知书名", info?.author ?? "", highlights, thoughts, bookmarks.chapters);
				const link = deepLink(bookId, info?.deepLink);
				return {
					ok: true,
					message: markdown + (link !== "" ? "\n\n链接：" + link : ""),
					bookId,
					highlightCount: highlights.length,
					reviewCount: thoughts.length
				};
			} catch (error) {
				return {
					ok: false,
					message: "拉取笔记失败：" + apiError(error),
					bookId
				};
			}
		}
	});
}
/** Readdata tool: reading statistics. */
function wereadReaddataTool(ctx) {
	return defineTool$1({
		name: "weread_readdata",
		description: "查看微信读书阅读统计：模式支持 weekly/monthly/annually/overall（默认 monthly，可 baseTime 指定统计周期内的 Unix 秒时间戳）。返回总阅读时长、阅读天数、日均时长、阅读/听书时长、排名、偏好分类与读得最久的书。",
		parameters: {
			mode: {
				type: "string",
				description: "统计模式：weekly / monthly / annually / overall（默认 monthly）"
			},
			baseTime: {
				type: "number",
				description: "目标周期内的 Unix 时间戳（秒），overall 用 0"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					mode: { type: "string" },
					totalReadTime: { type: "number" },
					readDays: { type: "number" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			const mode = typeof args?.mode === "string" && [
				"weekly",
				"monthly",
				"annually",
				"overall"
			].includes(args.mode) ? args.mode : "monthly";
			try {
				const data = await (await requireApi(ctx)).readdata(mode, args?.baseTime);
				const lines = ["📊 阅读统计（" + modeLabel(mode) + "）"];
				const total = data.totalReadTime ?? 0;
				lines.push("- 总阅读时长：" + formatDuration(total));
				if (typeof data.readDays === "number") lines.push("- 阅读天数：" + data.readDays + " 天");
				if (typeof data.dayAverageReadTime === "number" && data.dayAverageReadTime > 0) lines.push("- 日均阅读：" + formatDuration(data.dayAverageReadTime) + "（按自然日）");
				if (typeof data.readRate === "number" && data.readRate > 0) lines.push("- 文字阅读占比：" + data.readRate + "%" + (typeof data.wrListenTime === "number" && data.wrListenTime > 0 ? "（听书 " + formatDuration(data.wrListenTime) + "）" : ""));
				const compare = formatCompare(data.compare);
				if (compare !== "") lines.push("- 较上期日均：" + compare);
				const rankText = rankTextOf(data.rank);
				if (rankText !== "") lines.push("- " + rankText);
				const stats = formatReadStat(data.readStat);
				if (stats !== "") lines.push("- " + stats);
				const longest = formatLongest(data.readLongest);
				if (longest !== "") lines.push("- 读得最久的书：" + longest);
				const categories = formatCategories(data.preferCategory);
				if (categories !== "") lines.push("- 偏好分类：" + categories);
				const authors = formatAuthors(data.preferAuthor);
				if (authors !== "") lines.push("- 偏好作者：" + authors);
				if (typeof data.preferTimeWord === "string" && data.preferTimeWord !== "") lines.push("- 偏好时段：" + data.preferTimeWord);
				return {
					ok: true,
					message: lines.join("\n"),
					mode,
					totalReadTime: total,
					readDays: data.readDays ?? 0
				};
			} catch (error) {
				return {
					ok: false,
					message: "拉取阅读统计失败：" + apiError(error),
					mode
				};
			}
		}
	});
}
/** Statistic mode label. */
function modeLabel(mode) {
	switch (mode) {
		case "weekly": return "本周";
		case "monthly": return "本月";
		case "annually": return "今年";
		case "overall": return "累计";
		default: return mode;
	}
}
/** compare (ratio vs last period): 0.2 → +20%. */
function formatCompare(compare) {
	if (typeof compare !== "number" || !Number.isFinite(compare)) return "";
	const percent = Math.round(compare * 100);
	return (percent >= 0 ? "+" : "") + percent + "%";
}
/** rank is an object { text, scheme } in the current gateway format. */
function rankTextOf(rank) {
	if (typeof rank !== "object" || rank === null) return "";
	const record = rank;
	return typeof record.text === "string" ? record.text : "";
}
/** readStat[]: { stat, counts } e.g. 读过/读完/笔记 with文案 like '12本'. */
function formatReadStat(list) {
	if (!Array.isArray(list)) return "";
	const parts = [];
	for (const entry of list.slice(0, 6)) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry;
		const stat = typeof record.stat === "string" ? record.stat : "";
		const counts = typeof record.counts === "string" ? record.counts : "";
		if (stat !== "" && counts !== "") parts.push(stat + " " + counts);
	}
	return parts.join(" · ");
}
/** readLongest[]: { book: {title}, albumInfo: {name}, readTime(秒) }. */
function formatLongest(list) {
	if (!Array.isArray(list)) return "";
	const parts = [];
	for (const entry of list.slice(0, 3)) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry;
		const book = typeof record.book === "object" && record.book !== null ? record.book : null;
		const album = typeof record.albumInfo === "object" && record.albumInfo !== null ? record.albumInfo : null;
		const title = (book !== null && typeof book.title === "string" ? book.title : "") || (album !== null && typeof album.name === "string" ? album.name : "");
		if (title === "") continue;
		const time = typeof record.readTime === "number" && record.readTime > 0 ? "（" + formatDuration(record.readTime) + "）" : "";
		parts.push("《" + title + "》" + time);
	}
	return parts.join("、");
}
/** preferCategory[]: { categoryTitle, readingTime(秒) }. */
function formatCategories(list) {
	if (!Array.isArray(list)) return "";
	const parts = [];
	for (const entry of list.slice(0, 4)) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry;
		const title = typeof record.categoryTitle === "string" ? record.categoryTitle : "";
		if (title === "") continue;
		const time = typeof record.readingTime === "number" && record.readingTime > 0 ? "（" + formatDuration(record.readingTime) + "）" : "";
		parts.push(title + time);
	}
	return parts.join("、");
}
/** preferAuthor[]: { name, count(本), readTime(格式化字符串) }. */
function formatAuthors(list) {
	if (!Array.isArray(list)) return "";
	const parts = [];
	for (const entry of list.slice(0, 3)) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry;
		const name = typeof record.name === "string" ? record.name : "";
		if (name === "") continue;
		const count = typeof record.count === "number" && record.count > 0 ? "（" + record.count + " 本）" : "";
		parts.push(name + count);
	}
	return parts.join("、");
}
/** Sync tool: pull shelf + notebooks into the local cache. */
function wereadSyncTool(ctx) {
	return defineTool$1({
		name: "weread_sync",
		description: "同步微信读书到本地缓存（~/.dsh/weread-export-cache.json）：拉取书架与笔记本概览（有笔记的书），更新最近同步时间。之后 weread_shelf useCache / 设置面板可读缓存。",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					shelfBooks: { type: "number" },
					notebooks: { type: "number" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute() {
			try {
				const result = await doSync(await requireApi(ctx));
				await ctx.store.patch({ lastSyncAt: (/* @__PURE__ */ new Date()).toISOString() });
				return {
					ok: result.ok,
					message: result.message,
					shelfBooks: result.cache.shelfBooks.length,
					notebooks: result.cache.notebooks.length
				};
			} catch (error) {
				return {
					ok: false,
					message: "同步失败：" + apiError(error),
					shelfBooks: 0,
					notebooks: 0
				};
			}
		}
	});
}
/**
* Core export pipeline: pull highlights (+ thoughts), optionally process
* through the LLM prompt once, then deliver to one or more destinations
* ('all' = every configured target: flomo + local + notion).
*/
async function runExport(ctx, req) {
	const bookId = (req.bookId ?? "").trim();
	if (bookId === "") return {
		ok: false,
		message: "请提供 bookId。",
		dest: "flomo"
	};
	const creds = await ctx.store.load();
	const requested = req.dest === "flomo" || req.dest === "local" || req.dest === "notion" || req.dest === "all" ? req.dest : creds.exportDest;
	try {
		const api = await requireApi(ctx);
		const [bookmarks, info, reviews] = await Promise.all([
			api.bookmarklist(bookId),
			api.bookInfo(bookId).catch(() => void 0),
			api.reviewListMine(bookId, 50).catch(() => void 0)
		]);
		const highlights = Array.isArray(bookmarks.updated) ? bookmarks.updated : [];
		const thoughts = Array.isArray(reviews?.reviews) ? reviews.reviews : [];
		const title = info?.title ?? "未知书名";
		const author = info?.author ?? "";
		if (highlights.length === 0 && thoughts.length === 0) return {
			ok: false,
			message: "《" + title + "》暂无划线与想法，未导出。",
			dest: requested,
			bookId
		};
		const limit = typeof req.limit === "number" && Number.isFinite(req.limit) ? Math.max(0, Math.floor(req.limit)) : creds.exportLimit;
		const sliceHighlights = limit === 0 || limit >= highlights.length ? highlights : highlights.slice(0, limit);
		const scope = sliceHighlights.length === highlights.length ? "全部 " + highlights.length + " 条" : sliceHighlights.length + " 条（共 " + highlights.length + " 条）";
		let content = buildExportMarkdown(title, author, sliceHighlights, thoughts, bookmarks.chapters);
		if (typeof req.usePrompt === "boolean" ? req.usePrompt : creds.usePrompt) {
			const llm = {
				baseUrl: creds.llmBaseUrl,
				apiKey: creds.llmApiKey,
				model: creds.llmModel
			};
			if (!llmConfigured(llm)) return {
				ok: false,
				message: "已启用 prompt 处理但 LLM 未配置：请在设置面板「AI」区填写 API Key / Base URL / 模型，或关闭 prompt 开关。",
				dest: requested,
				bookId
			};
			const template = (req.prompt ?? "").trim() !== "" ? req.prompt : creds.exportPrompt;
			const highlightsText = sliceHighlights.map((h) => "- “" + (h.markText ?? "").trim() + "”").join("\n");
			const thoughtsText = thoughts.map((t) => "- " + (t.review?.content ?? "").trim()).join("\n");
			try {
				content = await processWithPrompt(llm, template, {
					title,
					author,
					highlights: highlightsText,
					thoughts: thoughtsText
				});
			} catch (error) {
				return {
					ok: false,
					message: "LLM 处理失败：" + apiError(error),
					dest: requested,
					bookId
				};
			}
		}
		const dests = requested === "all" ? [
			"flomo",
			"local",
			"notion"
		] : [requested];
		const lines = [];
		let allOk = true;
		let sent = 0;
		let memoCount = 0;
		let file;
		let pageId;
		for (const dest of dests) {
			let r;
			try {
				r = await deliverTo(creds, req, dest, title, content, sliceHighlights.length, scope, bookId);
			} catch (error) {
				r = {
					ok: false,
					message: dest + " 导出失败：" + apiError(error),
					dest,
					bookId
				};
			}
			lines.push(r.message);
			if (!r.ok) allOk = false;
			sent += r.sent ?? 0;
			memoCount += r.memoCount ?? 0;
			if (r.file !== void 0) file = r.file;
			if (r.pageId !== void 0) pageId = r.pageId;
		}
		return {
			ok: allOk,
			message: lines.join("\n"),
			dest: requested,
			sent: sent > 0 ? sent : void 0,
			memoCount: memoCount > 0 ? memoCount : void 0,
			file,
			pageId,
			bookId
		};
	} catch (error) {
		return {
			ok: false,
			message: "导出失败：" + apiError(error),
			dest: requested,
			bookId
		};
	}
}
/** Deliver prepared content to one destination. */
async function deliverTo(creds, req, dest, title, content, exported, scope, bookId) {
	if (dest === "local") {
		const dir = (req.localDir ?? "").trim() !== "" ? req.localDir : creds.localExportDir;
		if (dir === "") return {
			ok: false,
			message: "本地导出需要提供目录：请填 localDir 参数（或面板导出时填写导出路径）。",
			dest,
			bookId
		};
		const file = await exportToLocal(dir, title, content);
		return {
			ok: true,
			message: "已导出 " + scope + " 划线到本地：" + file,
			dest,
			sent: exported,
			file,
			bookId
		};
	}
	if (dest === "notion") {
		if (creds.notionToken.trim() === "") return {
			ok: false,
			message: "Notion 未配置（跳过）：请在设置面板「Notion」区填写 Integration Token（notion.so/my-integrations 创建，页面需分享给该 Integration）。",
			dest,
			bookId
		};
		if (creds.notionTargetPageId.trim() === "") return {
			ok: false,
			message: "Notion 目标页面未配置（跳过）：请在设置面板「Notion」区填写目标页面 URL 或 ID。",
			dest,
			bookId
		};
		const pageId = await exportToNotion(creds.notionToken, creds.notionTargetPageId, title, content);
		return {
			ok: true,
			message: "已导出 " + scope + " 划线到 Notion 页面：https://www.notion.so/" + pageId,
			dest,
			sent: exported,
			pageId,
			bookId
		};
	}
	const flomoUrl = await resolveFlomoUrl();
	if (flomoUrl === null) return {
		ok: false,
		message: "flomo 未配置（跳过）：请先在 Web 设置页「Flomo」面板或本插件「flomo 导出」区配置 API URL / API Key（flomo 设置页 https://flomoapp.com/mine?source=incoming_webhook 获取）。",
		dest,
		bookId
	};
	const tag = (req.tag ?? "").trim() || creds.defaultFlomoTag;
	const result = await exportToFlomo(flomoUrl, title, content, tag);
	return {
		ok: result.failed === 0,
		message: result.sent > 0 ? "已导出 " + scope + " 划线到 flomo（#" + tag + "）：" + result.message : result.message,
		dest,
		sent: result.failed === 0 ? exported : 0,
		memoCount: result.memoCount,
		bookId
	};
}
/** Multi-target export tool: flomo / local file / Notion + optional prompt. */
function wereadExportTool(ctx) {
	return defineTool$1({
		name: "weread_export",
		description: "把微信读书某本书的划线/想法导出：dest=flomo（默认，复用「Flomo」面板凭据，超长自动拆多条 MEMO）、dest=local（导出到本地 Markdown 文件，需提供 localDir 目录）、dest=notion（用本插件配置的 Notion Token 与目标页面创建子页面）、dest=all（一次导出到全部已配置目标，未配置的目标会跳过并说明）。可按配置 exportLimit 控制条数（0=全部）。若配置 usePrompt（或传 prompt），会先按 prompt 用 LLM 整理内容一次，再分发到各目标（AI 配置见设置面板）。tag 仅 flomo 用。",
		parameters: {
			bookId: {
				type: "string",
				required: true,
				description: "书籍 bookId（来自 weread_shelf / weread_search）"
			},
			dest: {
				type: "string",
				enum: [
					"flomo",
					"local",
					"notion",
					"all"
				],
				description: "导出目标（默认配置 exportDest）：flomo/local/notion 单个，或 all=全部已配置目标一起导出"
			},
			localDir: {
				type: "string",
				description: "dest=local 时必填：本地导出目录（绝对路径）"
			},
			tag: {
				type: "string",
				description: "flomo 标签（不带 #，可空格分隔多个）"
			},
			prompt: {
				type: "string",
				description: "临时覆盖导出 prompt（需配合 usePrompt: true 或配置开启）"
			},
			usePrompt: {
				type: "boolean",
				description: "本次是否用 LLM 按 prompt 处理后再导出（不填用配置 usePrompt）"
			},
			limit: {
				type: "number",
				description: "临时覆盖导出条数：0=全部，N>0=最多 N 条（不填用配置 exportLimit）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					dest: { type: "string" },
					sent: { type: "number" },
					file: { type: "string" },
					pageId: { type: "string" },
					memoCount: { type: "number" },
					bookId: { type: "string" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			return runExport(ctx, args ?? {});
		}
	});
}
/** Flomo tool: convenience wrapper around weread_export with dest=flomo. */
function wereadFlomoTool(ctx) {
	return defineTool$1({
		name: "weread_flomo",
		description: "把微信读书某本书的划线导出到 flomo（浮墨笔记）：发送带 #标签 的 MEMO（书名 + 划线列表）。默认按插件配置的导出条数（exportLimit，见 weread_status / 设置面板；0=全部导出，超长自动拆成多条 MEMO 发送）。limit 参数可临时覆盖（0=全部）。标签可用 tag 参数自定义（不填用插件默认标签）。若配置了 usePrompt，导出前会用 LLM 按 prompt 整理（AI 配置见设置面板）。复用 ~/.dsh/dsh-flomo.json 的 flomo 凭据，无需重复配置。",
		parameters: {
			bookId: {
				type: "string",
				required: true,
				description: "书籍 bookId（来自 weread_shelf / weread_search）"
			},
			tag: {
				type: "string",
				description: "flomo 标签（不带 #，可用空格分隔多个，如 读书笔记 微信读书）"
			},
			limit: {
				type: "number",
				description: "临时覆盖导出条数：0=全部导出，N>0=最多 N 条（不填用配置 exportLimit）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					message: {
						type: "string",
						required: true
					},
					sent: { type: "number" },
					memoCount: { type: "number" },
					bookId: { type: "string" }
				}
			},
			render: (_args, value) => text(String(value.message ?? ""))
		},
		async execute(args) {
			return runExport(ctx, {
				...args ?? {},
				dest: "flomo"
			});
		}
	});
}
/** Build every weread tool. */
function buildTools(ctx) {
	return [
		wereadStatusTool(ctx),
		wereadConfigTool(ctx),
		wereadSearchTool(ctx),
		wereadBookTool(ctx),
		wereadShelfTool(ctx),
		wereadNotesTool(ctx),
		wereadReaddataTool(ctx),
		wereadSyncTool(ctx),
		wereadExportTool(ctx),
		wereadFlomoTool(ctx)
	];
}
//#endregion
//#region src/routes.ts
/** Route paths. */
const WEREAD_API = {
	config: "/api/weread-export/config",
	status: "/api/weread-export/status",
	test: "/api/weread-export/test",
	sync: "/api/weread-export/sync",
	export: "/api/weread-export/export",
	flomo: "/api/weread-export/flomo",
	books: "/api/weread-export/books",
	pickDir: "/api/weread-export/pick-dir"
};
/** Cap on JSON request bodies. */
const MAX_JSON_BODY_BYTES = 256 * 1024;
/** Strict loopback fence for all routes. */
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** One JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}
/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > MAX_JSON_BODY_BYTES) return void 0;
		chunks.push(buffer);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return;
	}
}
/** Build the api client from the store's current key. */
async function apiFor(store) {
	return new WereadApi((await store.load()).apiKey);
}
/**
* Build every /api/weread-export route (exact paths).
* @param deps - store (the API client is built lazily per request).
* @returns the route list.
*/
function makeRoutes(deps) {
	const { store, directoryPicker } = deps;
	const guard = (req, res, method) => {
		if (!isLoopbackRequest(req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return false;
		}
		if (req.method !== method) {
			writeJson(res, 405, { error: `method not allowed: ${req.method}` });
			return false;
		}
		return true;
	};
	return [
		{
			kind: "exact",
			path: WEREAD_API.config,
			handler: async (req, res) => {
				const method = req.method ?? "GET";
				if (method === "GET") {
					if (!guard(req, res, "GET")) return;
					writeJson(res, 200, await store.view());
					return;
				}
				if (method === "POST") {
					if (!guard(req, res, "POST")) return;
					const body = await readJsonBody(req);
					if (body === void 0) {
						writeJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					if (body.flomoWebhookUrl !== void 0 || body.flomoApiKey !== void 0 || body.flomoReset === true) {
						const next = { ...await readFlomoCredentials() };
						if (body.flomoReset === true) {
							next.webhookUrl = "";
							next.apiKey = "";
						} else {
							if (typeof body.flomoWebhookUrl === "string") next.webhookUrl = body.flomoWebhookUrl.trim();
							if (typeof body.flomoApiKey === "string") next.apiKey = body.flomoApiKey.trim();
						}
						await writeFlomoCredentials(next);
						const rest = { ...body };
						delete rest.flomoWebhookUrl;
						delete rest.flomoApiKey;
						delete rest.flomoReset;
						await store.patch(rest);
					} else await store.patch(body);
					writeJson(res, 200, await store.view());
					return;
				}
				writeJson(res, 405, { error: `method not allowed: ${method}` });
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.status,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				const view = await store.view();
				const cache = await readCache();
				const flomo = await flomoStatus();
				const noteBooks = cache.notebooks.filter((b) => (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0) > 0).length;
				writeJson(res, 200, {
					...view,
					flomoConfigured: flomo.configured,
					flomoSource: flomo.source,
					flomoMasked: flomo.masked,
					flomoConfigPath: flomo.configPath,
					cachedShelfBooks: cache.shelfBooks.length,
					cachedNoteBooks: noteBooks,
					cacheUpdatedAt: cache.updatedAt
				});
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.test,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				if (!(await store.view()).configured) {
					writeJson(res, 400, { error: "未配置微信读书 API Key：请先在面板填写 Key。" });
					return;
				}
				try {
					await (await apiFor(store)).list();
					writeJson(res, 200, {
						ok: true,
						message: "连接成功：微信读书 Skills 网关可用。"
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						message: "连接失败：" + String(error instanceof Error ? error.message : error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.sync,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				if (!(await store.view()).configured) {
					writeJson(res, 400, { error: "未配置微信读书 API Key：请先在面板填写 Key。" });
					return;
				}
				try {
					const result = await doSync(await apiFor(store));
					await store.patch({ lastSyncAt: (/* @__PURE__ */ new Date()).toISOString() });
					writeJson(res, 200, result);
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						message: "同步失败：" + String(error instanceof Error ? error.message : error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.pickDir,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					const capability = directoryPicker?.capability();
					if (capability === void 0) {
						writeJson(res, 200, {
							ok: false,
							unsupported: true,
							message: "当前环境没有目录选择服务，请手动输入路径。"
						});
						return;
					}
					if (capability.kind === "native") {
						const picked = await capability.pick(AbortSignal.timeout(300 * 1e3));
						if (picked === null) {
							writeJson(res, 200, {
								ok: false,
								cancelled: true,
								message: "已取消选择。"
							});
							return;
						}
						writeJson(res, 200, {
							ok: true,
							path: picked
						});
						return;
					}
					writeJson(res, 200, {
						ok: false,
						unsupported: true,
						message: "当前为远程浏览模式，不支持系统文件夹对话框，请手动输入路径。"
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						message: "选择文件夹失败：" + String(error instanceof Error ? error.message : error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.books,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				const cache = await readCache();
				const byId = /* @__PURE__ */ new Map();
				for (const book of cache.shelfBooks) if (book.bookId !== void 0 && book.bookId !== "") byId.set(book.bookId, {
					bookId: book.bookId,
					title: book.title ?? "未知书名",
					author: book.author ?? ""
				});
				for (const entry of cache.notebooks) if (entry.bookId !== void 0 && entry.bookId !== "" && !byId.has(entry.bookId)) byId.set(entry.bookId, {
					bookId: entry.bookId,
					title: entry.book?.title ?? "未知书名",
					author: entry.book?.author ?? ""
				});
				const books = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, "zh"));
				writeJson(res, 200, {
					books,
					count: books.length
				});
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.export,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				if (!(await store.view()).configured) {
					writeJson(res, 400, { error: "未配置微信读书 API Key。" });
					return;
				}
				const body = await readJsonBody(req) ?? {};
				const req2 = {
					bookId: typeof body.bookId === "string" ? body.bookId : void 0,
					dest: body.dest === "local" || body.dest === "notion" || body.dest === "all" ? body.dest : void 0,
					localDir: typeof body.localDir === "string" ? body.localDir : void 0,
					tag: typeof body.tag === "string" ? body.tag : void 0,
					prompt: typeof body.prompt === "string" ? body.prompt : void 0,
					usePrompt: typeof body.usePrompt === "boolean" ? body.usePrompt : void 0,
					limit: typeof body.limit === "number" && Number.isFinite(body.limit) ? body.limit : void 0
				};
				if ((req2.bookId ?? "").trim() === "") {
					writeJson(res, 400, { error: "缺少 bookId。" });
					return;
				}
				writeJson(res, 200, await runExport({ store }, req2));
			}
		},
		{
			kind: "exact",
			path: WEREAD_API.flomo,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				if (!(await store.view()).configured) {
					writeJson(res, 400, { error: "未配置微信读书 API Key。" });
					return;
				}
				const body = await readJsonBody(req) ?? {};
				const req2 = {
					bookId: typeof body.bookId === "string" ? body.bookId : void 0,
					dest: "flomo",
					tag: typeof body.tag === "string" ? body.tag : void 0,
					limit: typeof body.limit === "number" && Number.isFinite(body.limit) ? body.limit : void 0
				};
				if ((req2.bookId ?? "").trim() === "") {
					writeJson(res, 400, { error: "缺少 bookId。" });
					return;
				}
				writeJson(res, 200, await runExport({ store }, req2));
			}
		}
	];
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name. */
const name = "weread";
/** Services required before the weread surfaces can mount. */
const inject = [
	"tools",
	"systemPrompt",
	"webServer"
];
/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 160;
/** Model-facing announcement: plugin presence, capabilities, and limits. */
const WEREAD_GUIDANCE = "本机已安装 weread-export 插件（微信读书集成）：配置一次官方 Skills API Key（wrk- 开头，在 https://weread.qq.com/r/weread-skills 用微信读书账号登录后「创建 Key」获取）后，可用 weread_shelf 查看书架、weread_notes 导出划线/想法/书签（不给 bookId 时返回笔记本概览）、weread_search 搜索书城、weread_book 查看书籍详情/进度/章节、weread_readdata 查看阅读统计（weekly/monthly/annually/overall）、weread_sync 同步本地缓存。导出：weread_export 支持三个目标——flomo（默认，超长自动拆多条 MEMO）、local（本地 Markdown 文件，需 localDir）、notion（本插件独立配置 Token 与目标页）；weread_flomo 是 flomo 快捷方式。可按配置 exportLimit 控制条数（0=全部），并可用 usePrompt/exportPrompt 让 LLM 按自定义 prompt 整理后再导出（AI 配置在设置面板，OpenAI 兼容，可自定义 Base URL/Key/模型）。凭据存 ~/.dsh/weread-export.json（权限 0600），同步快照存 ~/.dsh/weread-export-cache.json；weread_status 查看状态与导出配置（不回显完整 Key）。也可在 Web 设置页「微信读书」面板中配置 Key、导出目标（flomo/本地/Notion）、导出条数、prompt 与 AI 配置、测试连接、同步与快捷导出。用户提到「微信读书 / weread / 读书笔记 / 导出划线 / 阅读统计」时即指本插件，请据此协作。";
/**
* Mount the weread tools, routes, and announcement.
* @param ctx - host plugin context carrying tools/systemPrompt/webServer.
* @param config - plugin config from the composition row.
*/
function apply(ctx, config) {
	const announceToAgent = config?.announceToAgent !== false;
	const enabled = config?.enabled !== false;
	const store = new WereadStore();
	const toolContext = { store };
	let disposeTools;
	let disposeRoutes;
	let disposeSection;
	const sync = () => {
		if (disposeTools !== void 0) {
			disposeTools();
			disposeTools = void 0;
		}
		if (disposeRoutes !== void 0) {
			disposeRoutes();
			disposeRoutes = void 0;
		}
		if (disposeSection !== void 0) {
			disposeSection();
			disposeSection = void 0;
		}
		if (!enabled) return;
		disposeTools = ctx.effect(() => {
			const disposers = buildTools(toolContext).map((tool) => ctx.tools.register(tool));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "weread-export: tools");
		disposeRoutes = ctx.effect(() => {
			let picker;
			try {
				picker = ctx.directoryPicker;
			} catch {
				picker = void 0;
			}
			const disposers = makeRoutes({
				store,
				directoryPicker: picker
			}).map((route) => ctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "weread-export: routes");
		if (announceToAgent) disposeSection = ctx.systemPrompt.section({
			name: "plugin:weread-export",
			order: SECTION_ORDER,
			text: WEREAD_GUIDANCE
		});
	};
	sync();
}
//#endregion
export { DEFAULT_EXPORT_PROMPT, FLOMO_CONFIG_FILE, FLOMO_MAX_CHARS, NOTION_API, NOTION_VERSION, SKILL_VERSION, WEREAD_API, WEREAD_GATEWAY, WEREAD_GUIDANCE, WereadApi, WereadApiError, WereadStore, apply, buildExportMarkdown, buildFlomoMemo, buildFlomoMemos, buildNotesMarkdown, buildTaggedContent, buildTools, cachePath, chatComplete, chunkText, configPath, dateLabel, deepLink, defineTool, doSync, emptyCache, exportToFlomo, exportToLocal, exportToNotion, flomoConfigured, flomoStatus, formatDate, formatDuration, formatRating, inject, llmConfigured, makeRoutes, mask, name, normalizeNotionPageId, notebookLines, postMemo, processWithPrompt, readCache, readFlomoCredentials, renderPrompt, resolveFlomoUrl, runExport, shelfLine, toNotionBlocks, wereadBookTool, wereadConfigTool, wereadExportTool, wereadFlomoTool, wereadNotesTool, wereadReaddataTool, wereadSearchTool, wereadShelfTool, wereadStatusTool, wereadSyncTool, writeCache, writeFlomoCredentials };
