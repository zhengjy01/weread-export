window.__ModuleLoader__.load({
	id: "weread-export",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/** Error carrying the route's JSON error message. */
		var WereadApiError = class extends Error {
			constructor(message) {
				super(message);
				this.name = "WereadApiError";
			}
		};
		/** Parse a JSON response or throw a WereadApiError. */
		async function readJson(response) {
			let body;
			try {
				body = await response.json();
			} catch {
				throw new WereadApiError(`HTTP ${response.status}: invalid JSON response`);
			}
			if (!response.ok) throw new WereadApiError(typeof body === "object" && body !== null && typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
			return body;
		}
		/** Plain fetch helper with an error wrapper. */
		async function request(path, init) {
			let response;
			try {
				response = await fetch(path, init);
			} catch (error) {
				throw new WereadApiError("网络请求失败: " + String(error instanceof Error ? error.message : error));
			}
			return readJson(response);
		}
		/** The weread panel API. */
		var WereadApi = class {
			async getConfig() {
				return request("/api/weread-export/config");
			}
			async setConfig(patch) {
				return request("/api/weread-export/config", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(patch)
				});
			}
			async getStatus() {
				return request("/api/weread-export/status");
			}
			async test() {
				return request("/api/weread-export/test", { method: "POST" });
			}
			async sync() {
				return request("/api/weread-export/sync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
			}
			async books() {
				return (await request("/api/weread-export/books")).books ?? [];
			}
			async exportFlomo(bookId, tag, limit = 20) {
				return request("/api/weread-export/flomo", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						bookId,
						tag,
						limit
					})
				});
			}
			/** Multi-target export: flomo / local / notion with optional prompt. */
			async exportData(body) {
				return request("/api/weread-export/export", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body)
				});
			}
		};
		//#endregion
		//#region src/client/WereadSettingsPanel.tsx
		/**
		* WeRead settings panel — rendered inside the web settings page
		* (settings.section entry). Connection setup (Skills API key), export
		* preferences (destination flomo/local/Notion, per-export limit, local dir,
		* Notion token + target page, LLM prompt processing with a user-editable
		* template), manual sync, and a quick multi-target export. Plain React,
		* inline styles only.
		*/
		/** Module-level API client (stateless; the component closes over it). */
		const api = new WereadApi();
		/** One shared style sheet (kept tiny and theme-agnostic). */
		const s = {
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				maxWidth: "680px",
				padding: "14px 16px",
				borderRadius: "10px",
				border: "1px solid rgba(128,128,128,0.3)",
				fontSize: "13px",
				color: "inherit"
			},
			title: {
				fontWeight: 600,
				fontSize: "13px",
				margin: 0
			},
			/** One visually separated group card. */
			group: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				marginTop: "6px",
				padding: "12px 14px",
				borderRadius: "10px",
				border: "1px solid rgba(128,128,128,0.22)",
				background: "rgba(128,128,128,0.05)",
				minWidth: 0
			},
			groupTitle: {
				fontWeight: 600,
				fontSize: "12px",
				opacity: .95,
				margin: 0,
				paddingBottom: "6px",
				borderBottom: "1px solid rgba(128,128,128,0.18)"
			},
			status: {
				fontSize: "12px",
				opacity: .85,
				whiteSpace: "pre-wrap"
			},
			statusWarn: {
				fontSize: "12px",
				opacity: .9,
				color: "#c9763a"
			},
			row: {
				display: "flex",
				gap: "6px",
				alignItems: "center",
				minWidth: 0,
				flexWrap: "wrap"
			},
			col: {
				display: "flex",
				flexDirection: "column",
				gap: "4px",
				minWidth: 0
			},
			label: {
				fontSize: "12px",
				opacity: .8,
				whiteSpace: "nowrap"
			},
			input: {
				flex: 1,
				minWidth: 0,
				boxSizing: "border-box",
				padding: "5px 8px",
				borderRadius: "6px",
				border: "1px solid rgba(128,128,128,0.35)",
				background: "rgba(128,128,128,0.08)",
				color: "inherit",
				fontSize: "12px"
			},
			textarea: {
				width: "100%",
				minHeight: "96px",
				boxSizing: "border-box",
				padding: "6px 8px",
				borderRadius: "6px",
				border: "1px solid rgba(128,128,128,0.35)",
				background: "rgba(128,128,128,0.08)",
				color: "inherit",
				fontSize: "12px",
				fontFamily: "inherit",
				lineHeight: 1.5,
				resize: "vertical"
			},
			select: {
				flex: 1,
				minWidth: 0,
				maxWidth: "100%",
				overflow: "hidden",
				textOverflow: "ellipsis",
				padding: "4px 6px",
				borderRadius: "6px",
				border: "1px solid rgba(128,128,128,0.35)",
				background: "rgba(128,128,128,0.08)",
				color: "inherit",
				fontSize: "12px"
			},
			flex: { flex: 1 },
			button: {
				padding: "4px 10px",
				borderRadius: "6px",
				cursor: "pointer",
				border: "1px solid rgba(128,128,128,0.4)",
				background: "rgba(128,128,128,0.14)",
				color: "inherit",
				fontSize: "12px",
				whiteSpace: "nowrap"
			},
			msg: {
				fontSize: "12px",
				whiteSpace: "pre-wrap",
				wordBreak: "break-all",
				opacity: .9
			},
			hint: {
				fontSize: "11px",
				opacity: .75,
				lineHeight: 1.6
			}
		};
		/** Status line for the current config view. */
		function statusText(view) {
			if (view === null) return "加载中…";
			if (!view.configured) return "未配置 — 打开 https://weread.qq.com/r/weread-skills，用微信读书账号登录后点击「创建 Key」并复制（wrk- 开头），粘贴到上方输入框。";
			const destLabel = view.exportDest === "local" ? "本地文件" : view.exportDest === "notion" ? "Notion" : "flomo";
			return "已配置 · Key " + view.apiKeyMasked + "\n默认导出目标 " + destLabel + " · 导出条数 " + (view.exportLimit === 0 ? "全部" : view.exportLimit + " 条") + " · 默认标签 #" + view.defaultFlomoTag + "\nprompt 处理 " + (view.usePrompt ? "开（" + (view.llmConfigured ? view.llmModel + " @ " + view.llmBaseUrl : "LLM 未配置") + "）" : "关") + " · Notion " + (view.notionConfigured ? "已配置" + (view.notionTargetPageId !== "" ? " + 目标页" : "（未填目标页）") : "未配置") + " · flomo " + (view.flomoConfigured ? "已配置" : "未配置") + " · 缓存书架 " + view.cachedShelfBooks + " 本 / 有笔记 " + view.cachedNoteBooks + " 本" + (view.lastSyncAt !== "" ? " · 最近同步 " + view.lastSyncAt : "");
		}
		/** The WeRead settings panel component. */
		function WereadSettingsPanel() {
			const [view, setView] = (0, react.useState)(null);
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [defaultFlomoTag, setDefaultFlomoTag] = (0, react.useState)("");
			const [limitChoice, setLimitChoice] = (0, react.useState)("20");
			const [customLimit, setCustomLimit] = (0, react.useState)("");
			const [exportDest, setExportDest] = (0, react.useState)("flomo");
			const [localExportDir, setLocalExportDir] = (0, react.useState)("");
			const [notionToken, setNotionToken] = (0, react.useState)("");
			const [notionTargetPageId, setNotionTargetPageId] = (0, react.useState)("");
			const [usePrompt, setUsePrompt] = (0, react.useState)(false);
			const [llmBaseUrl, setLlmBaseUrl] = (0, react.useState)("");
			const [llmApiKey, setLlmApiKey] = (0, react.useState)("");
			const [llmModel, setLlmModel] = (0, react.useState)("");
			const [exportPrompt, setExportPrompt] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)("");
			const [books, setBooks] = (0, react.useState)([]);
			const [bookId, setBookId] = (0, react.useState)("");
			const [destNow, setDestNow] = (0, react.useState)("");
			const [localDirNow, setLocalDirNow] = (0, react.useState)("");
			const [flomoTagNow, setFlomoTagNow] = (0, react.useState)("");
			const [usePromptNow, setUsePromptNow] = (0, react.useState)(null);
			/** Map the persisted exportLimit to the choice selector. */
			const limitFromView = (value) => {
				if (value === 0) return "0";
				if ([
					20,
					50,
					100
				].includes(value)) return String(value);
				return "custom";
			};
			const refresh = (0, react.useCallback)(async () => {
				try {
					const next = await api.getStatus();
					setView(next);
					setDefaultFlomoTag((prev) => prev === "" ? next.defaultFlomoTag : prev);
					setFlomoTagNow((prev) => prev === "" ? next.defaultFlomoTag : prev);
					setLimitChoice(limitFromView(next.exportLimit));
					if (![
						0,
						20,
						50,
						100
					].includes(next.exportLimit)) setCustomLimit(String(next.exportLimit));
					setExportDest(next.exportDest);
					setLocalExportDir(next.localExportDir);
					setNotionTargetPageId(next.notionTargetPageId);
					setUsePrompt(next.usePrompt);
					setLlmBaseUrl(next.llmBaseUrl);
					setLlmModel(next.llmModel);
					if (destNow === "") setDestNow(next.exportDest);
				} catch (error) {
					setMessage("状态读取失败: " + String(error instanceof Error ? error.message : error));
				}
			}, [destNow]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const reloadBooks = (0, react.useCallback)(async () => {
				try {
					const list = await api.books();
					setBooks(list);
					if (list.length > 0) setBookId((prev) => prev !== "" && list.some((b) => b.bookId === prev) ? prev : list[0]?.bookId ?? "");
				} catch {
					setBooks([]);
				}
			}, []);
			(0, react.useEffect)(() => {
				reloadBooks();
			}, [reloadBooks]);
			/** Resolve the chosen export limit to a number (0 = all). */
			const resolveExportLimit = () => {
				if (limitChoice === "custom") {
					const parsed = Number(customLimit);
					return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
				}
				return Number(limitChoice) || 0;
			};
			const saveConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const patch = {};
					if (apiKey.trim() !== "") patch.apiKey = apiKey.trim();
					if (defaultFlomoTag.trim() !== "") patch.defaultFlomoTag = defaultFlomoTag.trim();
					patch.exportLimit = resolveExportLimit();
					patch.exportDest = exportDest;
					if (localExportDir.trim() !== "") patch.localExportDir = localExportDir.trim();
					if (notionToken.trim() !== "") patch.notionToken = notionToken.trim();
					if (notionTargetPageId.trim() !== "") patch.notionTargetPageId = notionTargetPageId.trim();
					patch.usePrompt = usePrompt;
					if (llmBaseUrl.trim() !== "") patch.llmBaseUrl = llmBaseUrl.trim();
					if (llmApiKey.trim() !== "") patch.llmApiKey = llmApiKey.trim();
					if (llmModel.trim() !== "") patch.llmModel = llmModel.trim();
					if (exportPrompt.trim() !== "") patch.exportPrompt = exportPrompt;
					const next = await api.setConfig(patch);
					setView({
						...next,
						flomoConfigured: view?.flomoConfigured ?? false,
						cachedShelfBooks: view?.cachedShelfBooks ?? 0,
						cachedNoteBooks: view?.cachedNoteBooks ?? 0,
						cacheUpdatedAt: view?.cacheUpdatedAt ?? ""
					});
					setMessage(next.configured ? "配置已保存。" : "配置未保存完整：缺少 API Key。");
					setApiKey("");
					setNotionToken("");
					setLlmApiKey("");
				} catch (error) {
					setMessage("保存失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			const clearConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const next = await api.setConfig({ reset: true });
					setView({
						...next,
						flomoConfigured: view?.flomoConfigured ?? false,
						cachedShelfBooks: view?.cachedShelfBooks ?? 0,
						cachedNoteBooks: view?.cachedNoteBooks ?? 0,
						cacheUpdatedAt: view?.cacheUpdatedAt ?? ""
					});
					setMessage("已清除配置。");
				} catch (error) {
					setMessage("清除失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			const runTest = async () => {
				setBusy(true);
				setMessage("测试中…");
				try {
					const result = await api.test();
					setMessage(result.ok ? result.message : "测试失败: " + result.message);
				} catch (error) {
					setMessage("测试失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			const runSync = async () => {
				setBusy(true);
				setMessage("同步中…");
				try {
					const result = await api.sync();
					setMessage(result.ok ? result.message : "同步失败: " + result.message);
					await refresh();
					await reloadBooks();
				} catch (error) {
					setMessage("同步失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			const runExportNow = async () => {
				if (bookId === "") {
					setMessage("请先同步以加载书籍列表。");
					return;
				}
				const dest = destNow || view?.exportDest || "flomo";
				if (dest === "local" && localDirNow.trim() === "") {
					setMessage("本地导出需要填写导出路径（每次必填）。");
					return;
				}
				setBusy(true);
				setMessage("导出中…");
				try {
					const body = {
						bookId,
						dest
					};
					if (dest === "local") body.localDir = localDirNow.trim();
					if (dest === "flomo" && flomoTagNow.trim() !== "") body.tag = flomoTagNow.trim();
					if (usePromptNow !== null) body.usePrompt = usePromptNow;
					const result = await api.exportData(body);
					setMessage(result.ok ? result.message : "导出失败: " + result.message);
				} catch (error) {
					setMessage("导出失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: s.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: s.title,
						children: "微信读书"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: view?.configured === false ? s.statusWarn : s.status,
						children: statusText(view)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.groupTitle,
								children: "① 连接与导出偏好"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: s.input,
									placeholder: "Skills API Key（wrk- 开头）",
									value: apiKey,
									onChange: (e) => setApiKey(e.target.value)
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: s.label,
										children: "默认导出标签"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: {
											...s.input,
											width: "130px"
										},
										placeholder: "如 读书笔记",
										value: defaultFlomoTag,
										onChange: (e) => setDefaultFlomoTag(e.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: s.label,
										children: "导出条数"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										style: {
											...s.select,
											flex: 0,
											minWidth: "104px"
										},
										value: limitChoice,
										onChange: (e) => setLimitChoice(e.target.value),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "0",
												children: "全部导出"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "20",
												children: "20 条（默认）"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "50",
												children: "50 条"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "100",
												children: "100 条"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "custom",
												children: "自定义…"
											})
										]
									}),
									limitChoice === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: {
											...s.input,
											width: "64px"
										},
										placeholder: "条数",
										value: customLimit,
										onChange: (e) => setCustomLimit(e.target.value)
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: s.label,
										children: "默认目标"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										style: {
											...s.select,
											flex: 0,
											minWidth: "110px"
										},
										value: exportDest,
										onChange: (e) => setExportDest(e.target.value),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "flomo",
												children: "flomo"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "local",
												children: "本地文件"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "notion",
												children: "Notion"
											})
										]
									}),
									exportDest === "local" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: s.input,
										placeholder: "本地导出目录（绝对路径，可留空导出时填）",
										value: localExportDir,
										onChange: (e) => setLocalExportDir(e.target.value)
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void saveConfig(),
										disabled: busy,
										children: "保存配置"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void runTest(),
										disabled: busy || !view?.configured,
										children: "测试连接"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void clearConfig(),
										disabled: busy,
										children: "清除"
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.groupTitle,
								children: "② Notion 导出"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: s.input,
									type: "password",
									placeholder: "Notion Integration Token（notion.so/my-integrations 创建）",
									value: notionToken,
									onChange: (e) => setNotionToken(e.target.value)
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: s.input,
									placeholder: "目标父页面 URL 或 32 位 ID（页面需分享给该 Integration）",
									value: notionTargetPageId,
									onChange: (e) => setNotionTargetPageId(e.target.value)
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.groupTitle,
								children: "③ AI · prompt 处理（导出前用 LLM 按模板整理）"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: {
											...s.label,
											display: "flex",
											alignItems: "center",
											gap: "4px",
											cursor: "pointer"
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: usePrompt,
											onChange: (e) => setUsePrompt(e.target.checked)
										}), "启用"]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: s.input,
										placeholder: "Base URL（默认 https://api.deepseek.com/v1）",
										value: llmBaseUrl,
										onChange: (e) => setLlmBaseUrl(e.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: {
											...s.input,
											width: "130px"
										},
										placeholder: "模型",
										value: llmModel,
										onChange: (e) => setLlmModel(e.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: s.input,
										type: "password",
										placeholder: "LLM API Key（自定义）",
										value: llmApiKey,
										onChange: (e) => setLlmApiKey(e.target.value)
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.col,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									style: s.textarea,
									placeholder: "导出 prompt 模板，可用 {title} {author} {highlights} {thoughts} 占位符",
									value: exportPrompt,
									onChange: (e) => setExportPrompt(e.target.value)
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.groupTitle,
								children: "④ 快捷导出"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: s.label,
										children: "选择书籍"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										style: s.select,
										value: bookId,
										onChange: (e) => setBookId(e.target.value),
										disabled: books.length === 0,
										children: books.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: "（缓存无书籍，先同步）"
										}) : books.map((b) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
											value: b.bookId,
											children: [
												"《",
												b.title,
												"》",
												b.author !== "" ? " · " + b.author : ""
											]
										}, b.bookId))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void runSync(),
										disabled: busy || !view?.configured,
										children: "同步书架/笔记"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: s.label,
										children: "本次目标"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										style: {
											...s.select,
											flex: 0,
											minWidth: "110px"
										},
										value: destNow,
										onChange: (e) => setDestNow(e.target.value),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "flomo",
												children: "flomo"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "local",
												children: "本地文件"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "notion",
												children: "Notion"
											})
										]
									}),
									destNow === "local" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: s.input,
										placeholder: "导出路径（必填）",
										value: localDirNow,
										onChange: (e) => setLocalDirNow(e.target.value)
									}),
									destNow === "flomo" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: {
											...s.input,
											width: "150px"
										},
										placeholder: "本次标签（#）",
										value: flomoTagNow,
										onChange: (e) => setFlomoTagNow(e.target.value)
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: {
											...s.label,
											display: "flex",
											alignItems: "center",
											gap: "4px",
											cursor: "pointer"
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: usePromptNow === null ? view?.usePrompt ?? false : usePromptNow,
											onChange: (e) => setUsePromptNow(e.target.checked)
										}), "本次用 prompt 处理（默认跟随配置）"]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										style: s.button,
										onClick: () => void runExportNow(),
										disabled: busy || !view?.configured,
										children: ["导出到 ", destNow === "local" ? "本地" : destNow === "notion" ? "Notion" : "flomo"]
									})
								]
							})
						]
					}),
					message !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.msg,
						children: message
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【API Key】打开 https://weread.qq.com/r/weread-skills → 微信读书账号登录 → 「创建 Key」→ 复制（wrk- 开头）。Key 绑定你的账号身份，请勿泄露。存于 ~/.dsh/weread-export.json（权限 0600）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【导出目标】flomo = 发到浮墨（复用「Flomo」面板凭据，超长自动拆多条 MEMO）；本地 = 导出 Markdown 文件到指定目录（每次导出需填路径）；Notion = 用本插件自己的 Integration Token 在目标父页面下创建子页面写入（目标页需分享给该 Integration）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.hint,
						children: [
							"【AI prompt】启用后导出前会调用 LLM（OpenAI 兼容，默认 DeepSeek）按模板整理划线内容再导出。模板支持 ",
							"{title}",
							" ",
							"{author}",
							" ",
							"{highlights}",
							" ",
							"{thoughts}",
							" 占位符，可随意编辑；本次导出也可临时开关。"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【导出条数】「全部导出」= 全部划线都导出（flomo 超长自动拆多条）；「20/50/100/自定义」= 最多导出的条数。 同步后可用 weread_shelf / weread_notes / weread_readdata / weread_search / weread_book / weread_export 等工具。"
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services. */
		const inject = ["slots"];
		/**
		* Register the WeRead settings page.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "weread",
					order: 316,
					label: () => "微信读书"
				}, WereadSettingsPanel));
			} catch (error) {
				console.warn("[weread-export] settings panel registration failed:", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map