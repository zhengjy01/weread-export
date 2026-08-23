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
			/** Open the host OS folder chooser; resolves the picked absolute path. */
			async pickDir() {
				return request("/api/weread-export/pick-dir", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
			}
			/** Send a test memo to flomo to verify the shared credential. */
			async testFlomo() {
				return request("/api/weread-export/test-flomo", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
			}
			/** Verify the Notion token and target page accessibility. */
			async testNotion() {
				return request("/api/weread-export/test-notion", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
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
		* (settings.section entry).
		*
		* Layout: each export target configures its own parameters in its own card
		* (flomo: tag + URL/key; Notion: token + target page; local: directory),
		* and the quick-export card only picks a destination (flomo / Notion /
		* local / all) — no "default vs this-run" duplication. Plain React, inline
		* styles only.
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
			if (!view.configured) return "未配置 — 打开 https://weread.qq.com/r/weread-skills，用微信读书账号登录后点击「创建 Key」并复制（wrk- 开头），粘贴到「① 连接」卡片。";
			return "已配置 · Key " + view.apiKeyMasked + " · 导出条数 " + (view.exportLimit === 0 ? "全部" : view.exportLimit + " 条") + "\nflomo " + (view.flomoConfigured ? "已配置（" + view.flomoSource + " " + view.flomoMasked + "）" : "未配置") + " · Notion " + (view.notionConfigured ? "已配置" + (view.notionTargetPageId !== "" ? " + 目标页" : "（未填目标页）") : "未配置") + " · 本地 " + (view.localExportDir !== "" ? "已配置" : "未配置") + " · prompt " + (view.usePrompt ? "开（" + (view.llmConfigured ? view.llmModel : "LLM 未配置") + "）" : "关") + " · 缓存书架 " + view.cachedShelfBooks + " 本 / 有笔记 " + view.cachedNoteBooks + " 本";
		}
		/** The WeRead settings panel component. */
		function WereadSettingsPanel() {
			const [view, setView] = (0, react.useState)(null);
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [limitChoice, setLimitChoice] = (0, react.useState)("20");
			const [customLimit, setCustomLimit] = (0, react.useState)("");
			const [defaultFlomoTag, setDefaultFlomoTag] = (0, react.useState)("");
			const [flomoWebhookUrl, setFlomoWebhookUrl] = (0, react.useState)("");
			const [flomoApiKey, setFlomoApiKey] = (0, react.useState)("");
			const [notionToken, setNotionToken] = (0, react.useState)("");
			const [notionTargetPageId, setNotionTargetPageId] = (0, react.useState)("");
			const [localExportDir, setLocalExportDir] = (0, react.useState)("");
			const [usePrompt, setUsePrompt] = (0, react.useState)(false);
			const [llmBaseUrl, setLlmBaseUrl] = (0, react.useState)("");
			const [llmApiKey, setLlmApiKey] = (0, react.useState)("");
			const [llmModel, setLlmModel] = (0, react.useState)("");
			const [exportPrompt, setExportPrompt] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)("");
			const [books, setBooks] = (0, react.useState)([]);
			const [bookId, setBookId] = (0, react.useState)("");
			const [destNow, setDestNow] = (0, react.useState)("flomo");
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
					setLimitChoice(limitFromView(next.exportLimit));
					if (![
						0,
						20,
						50,
						100
					].includes(next.exportLimit)) setCustomLimit(String(next.exportLimit));
					setNotionTargetPageId(next.notionTargetPageId);
					setLocalExportDir(next.localExportDir);
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
			const afterSave = async (okMessage) => {
				setView(await api.getStatus());
				setMessage(okMessage);
				setApiKey("");
				setFlomoWebhookUrl("");
				setFlomoApiKey("");
				setNotionToken("");
				setLlmApiKey("");
			};
			/** ① connection: API key + export limit. */
			const saveMainConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const patch = {};
					if (apiKey.trim() !== "") patch.apiKey = apiKey.trim();
					patch.exportLimit = resolveExportLimit();
					const next = await api.setConfig(patch);
					setMessage(next.configured ? "配置已保存。" : "配置未保存完整：缺少 API Key。");
					await afterSave("");
				} catch (error) {
					setMessage("保存失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			/** ② flomo: tag + URL / key. */
			const saveFlomoConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const patch = {};
					if (defaultFlomoTag.trim() !== "") patch.defaultFlomoTag = defaultFlomoTag.trim();
					if (flomoWebhookUrl.trim() !== "") patch.flomoWebhookUrl = flomoWebhookUrl.trim();
					if (flomoApiKey.trim() !== "") patch.flomoApiKey = flomoApiKey.trim();
					await api.setConfig(patch);
					await afterSave("flomo 配置已保存。");
				} catch (error) {
					setMessage("保存失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			/** ③ notion: token + target page. */
			const saveNotionConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const patch = {};
					if (notionToken.trim() !== "") patch.notionToken = notionToken.trim();
					if (notionTargetPageId.trim() !== "") patch.notionTargetPageId = notionTargetPageId.trim();
					await api.setConfig(patch);
					await afterSave("Notion 配置已保存。");
				} catch (error) {
					setMessage("保存失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			/** ④ local: export directory. */
			const saveLocalConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const patch = {};
					if (localExportDir.trim() !== "") patch.localExportDir = localExportDir.trim();
					await api.setConfig(patch);
					await afterSave("本地导出目录已保存。");
				} catch (error) {
					setMessage("保存失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			/** ⑤ AI: prompt toggle + LLM config + template. */
			const saveAIConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					const patch = { usePrompt };
					if (llmBaseUrl.trim() !== "") patch.llmBaseUrl = llmBaseUrl.trim();
					if (llmApiKey.trim() !== "") patch.llmApiKey = llmApiKey.trim();
					if (llmModel.trim() !== "") patch.llmModel = llmModel.trim();
					if (exportPrompt.trim() !== "") patch.exportPrompt = exportPrompt;
					await api.setConfig(patch);
					await afterSave("AI 配置已保存。");
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
					await api.setConfig({ reset: true });
					await afterSave("已清除全部配置。");
				} catch (error) {
					setMessage("清除失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			const clearFlomoConfig = async () => {
				setBusy(true);
				setMessage("");
				try {
					await api.setConfig({ flomoReset: true });
					await afterSave("已清除 flomo 配置。");
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
			/** Test flomo: saves any unsaved fields first, then sends a test memo. */
			const testFlomoConfig = async () => {
				setBusy(true);
				setMessage("测试中…（会向 flomo 发送一条测试 MEMO）");
				try {
					if (defaultFlomoTag.trim() !== "" || flomoWebhookUrl.trim() !== "" || flomoApiKey.trim() !== "") {
						const patch = {};
						if (defaultFlomoTag.trim() !== "") patch.defaultFlomoTag = defaultFlomoTag.trim();
						if (flomoWebhookUrl.trim() !== "") patch.flomoWebhookUrl = flomoWebhookUrl.trim();
						if (flomoApiKey.trim() !== "") patch.flomoApiKey = flomoApiKey.trim();
						await api.setConfig(patch);
						setFlomoWebhookUrl("");
						setFlomoApiKey("");
						setView(await api.getStatus());
					}
					const result = await api.testFlomo();
					setMessage(result.ok ? "✅ " + result.message : "测试失败: " + result.message);
				} catch (error) {
					setMessage("测试失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			/** Test Notion: saves any unsaved fields first, then verifies token + page. */
			const testNotionConfig = async () => {
				setBusy(true);
				setMessage("测试中…");
				try {
					if (notionToken.trim() !== "" || notionTargetPageId.trim() !== "") {
						const patch = {};
						if (notionToken.trim() !== "") patch.notionToken = notionToken.trim();
						if (notionTargetPageId.trim() !== "") patch.notionTargetPageId = notionTargetPageId.trim();
						await api.setConfig(patch);
						setNotionToken("");
						setView(await api.getStatus());
					}
					const result = await api.testNotion();
					setMessage(result.ok ? "✅ " + result.message : "测试失败: " + result.message);
				} catch (error) {
					setMessage("测试失败: " + String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			/** Open the host OS folder chooser and apply the picked path. */
			const pickFolder = async (apply) => {
				setBusy(true);
				setMessage("");
				try {
					const result = await api.pickDir();
					if (result.ok && result.path !== void 0) {
						apply(result.path);
						setMessage("已选择文件夹：" + result.path);
					} else if (result.cancelled === true) setMessage("已取消选择。");
					else setMessage(result.message ?? "无法弹出文件夹选择（当前环境不支持），请手动输入路径。");
				} catch (error) {
					setMessage("选择文件夹失败: " + String(error instanceof Error ? error.message : error));
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
				const dest = destNow || "flomo";
				if (dest === "local" && (view?.localExportDir ?? "") === "") {
					setMessage("本地导出需要先在「④ 本地导出」配置导出目录。");
					return;
				}
				if (dest === "all" && (view?.localExportDir ?? "") === "") setMessage("全选导出包含本地目标，但「④ 本地导出」未配置目录；本地部分将跳过（其余目标照常导出）。");
				setBusy(true);
				setMessage("导出中…");
				try {
					const body = {
						bookId,
						dest
					};
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
								children: "① 连接"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: s.input,
									placeholder: "微信读书 Skills API Key（wrk- 开头）",
									value: apiKey,
									onChange: (e) => setApiKey(e.target.value)
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
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
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void saveMainConfig(),
										disabled: busy,
										children: "保存"
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
										children: "清除全部"
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
								children: "② flomo 导出"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: view?.flomoConfigured === false ? s.statusWarn : s.status,
								children: view === null ? "加载中…" : view.flomoConfigured ? "已配置：" + view.flomoSource + " " + view.flomoMasked + "（与「Flomo」面板共享凭据）" : "未配置 — 在 flomo 设置页（flomoapp.com/mine?source=incoming_webhook）获取 API URL。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: s.label,
									children: "标签"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: {
										...s.input,
										width: "160px"
									},
									placeholder: "如 读书笔记（#）",
									value: defaultFlomoTag,
									onChange: (e) => setDefaultFlomoTag(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: s.input,
									type: "password",
									placeholder: "flomo API URL（https://flomoapp.com/iwh/xxxx）",
									value: flomoWebhookUrl,
									onChange: (e) => setFlomoWebhookUrl(e.target.value)
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: s.input,
										type: "password",
										placeholder: "或 flomo API Key（新版，与 URL 二选一）",
										value: flomoApiKey,
										onChange: (e) => setFlomoApiKey(e.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void saveFlomoConfig(),
										disabled: busy,
										children: "保存 flomo"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void testFlomoConfig(),
										disabled: busy || !view?.flomoConfigured,
										children: "测试 flomo"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void clearFlomoConfig(),
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
								children: "③ Notion 导出"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: view?.notionConfigured === false ? s.statusWarn : s.status,
								children: view === null ? "加载中…" : view.notionConfigured ? "已配置" + (view.notionTargetPageId !== "" ? " · 目标页已填" : "（未填目标页）") : "未配置 — 在 notion.so/my-integrations 创建 Integration 并复制 Token。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: s.input,
									type: "password",
									placeholder: "Notion Integration Token",
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
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void saveNotionConfig(),
										disabled: busy,
										children: "保存 Notion"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void testNotionConfig(),
										disabled: busy || !view?.notionConfigured,
										children: "测试 Notion"
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
								children: "④ 本地导出"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: view?.localExportDir === "" ? s.statusWarn : s.status,
								children: view === null ? "加载中…" : view.localExportDir !== "" ? "已配置：" + view.localExportDir : "未配置 — 选择或填写一个导出目录，导出为 Markdown 文件。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: s.input,
										placeholder: "导出目录（绝对路径）",
										value: localExportDir,
										onChange: (e) => setLocalExportDir(e.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void pickFolder((p) => setLocalExportDir(p)),
										disabled: busy,
										children: "选择文件夹…"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										style: s.button,
										onClick: () => void saveLocalConfig(),
										disabled: busy,
										children: "保存本地"
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
								children: "⑤ AI · prompt 处理（导出前用 LLM 按模板整理）"
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
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: s.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									style: s.button,
									onClick: () => void saveAIConfig(),
									disabled: busy,
									children: "保存 AI"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: s.groupTitle,
								children: "⑥ 快捷导出"
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
										children: "导出到"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										style: {
											...s.select,
											flex: 0,
											minWidth: "130px"
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
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "all",
												children: "全选（flomo+本地+Notion）"
											})
										]
									}),
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
										}), "本次用 prompt"]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										style: s.button,
										onClick: () => void runExportNow(),
										disabled: busy || !view?.configured,
										children: ["导出到 ", destNow === "all" ? "全部" : destNow === "local" ? "本地" : destNow === "notion" ? "Notion" : "flomo"]
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
						children: "【各目标独立配置】②flomo：标签 + API URL/Key（与「Flomo」面板共享凭据）；③Notion：Integration Token + 目标页（页面需分享给该 Integration）；④本地：导出目录（导出为 Markdown 文件）。每个卡片「保存/测试」独立操作。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【导出】「⑥ 快捷导出」只选目标：flomo / 本地 / Notion / 全选（一次导出到所有已配置目标，未配置的跳过并说明）；prompt 处理可选，导出前按 ⑤ 模板整理一次再分发。"
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