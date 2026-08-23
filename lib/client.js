window.__ModuleLoader__.load({
	id: "weixinread-flomo",
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
				return request("/api/weixinread-flomo/config");
			}
			async setConfig(patch) {
				return request("/api/weixinread-flomo/config", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(patch)
				});
			}
			async getStatus() {
				return request("/api/weixinread-flomo/status");
			}
			async test() {
				return request("/api/weixinread-flomo/test", { method: "POST" });
			}
			async sync() {
				return request("/api/weixinread-flomo/sync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
			}
			async books() {
				return (await request("/api/weixinread-flomo/books")).books ?? [];
			}
			async exportFlomo(bookId, tag, limit = 20) {
				return request("/api/weixinread-flomo/flomo", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						bookId,
						tag,
						limit
					})
				});
			}
		};
		//#endregion
		//#region src/client/WereadSettingsPanel.tsx
		/**
		* WeRead settings panel — rendered inside the web settings page
		* (settings.section entry). Connection setup (Skills API key, default flomo
		* tag), a test button, manual sync, and a quick highlight→flomo export with
		* a customizable tag. Plain React, inline styles only.
		*/
		/** Module-level API client (stateless; the component closes over it). */
		const api = new WereadApi();
		/** One shared style sheet (kept tiny and theme-agnostic). */
		const s = {
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				maxWidth: "620px",
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
			status: {
				fontSize: "12px",
				opacity: .85
			},
			statusWarn: {
				fontSize: "12px",
				opacity: .9,
				color: "#c9763a"
			},
			row: {
				display: "flex",
				gap: "6px",
				alignItems: "center"
			},
			label: {
				fontSize: "12px",
				opacity: .8,
				whiteSpace: "nowrap"
			},
			input: {
				width: "100%",
				boxSizing: "border-box",
				padding: "5px 8px",
				borderRadius: "6px",
				border: "1px solid rgba(128,128,128,0.35)",
				background: "rgba(128,128,128,0.08)",
				color: "inherit",
				fontSize: "12px"
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
			return "已配置 · Key " + view.apiKeyMasked + " · 默认 flomo 标签 #" + view.defaultFlomoTag + " · 导出策略 " + (view.exportLimit === 0 ? "全部" : view.exportLimit + " 条") + " · flomo " + (view.flomoConfigured ? "已配置" : "未配置") + " · 缓存书架 " + view.cachedShelfBooks + " 本 / 有笔记 " + view.cachedNoteBooks + " 本" + (view.lastSyncAt !== "" ? " · 最近同步 " + view.lastSyncAt : "");
		}
		/** The WeRead settings panel component. */
		function WereadSettingsPanel() {
			const [view, setView] = (0, react.useState)(null);
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [defaultFlomoTag, setDefaultFlomoTag] = (0, react.useState)("");
			const [limitChoice, setLimitChoice] = (0, react.useState)("20");
			const [customLimit, setCustomLimit] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)("");
			const [books, setBooks] = (0, react.useState)([]);
			const [bookId, setBookId] = (0, react.useState)("");
			const [flomoTag, setFlomoTag] = (0, react.useState)("");
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
					setFlomoTag((prev) => prev === "" ? next.defaultFlomoTag : prev);
					setLimitChoice(limitFromView(next.exportLimit));
					if (![
						0,
						20,
						50,
						100
					].includes(next.exportLimit)) setCustomLimit(String(next.exportLimit));
				} catch (error) {
					setMessage("状态读取失败: " + String(error instanceof Error ? error.message : error));
				}
			}, []);
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
			const runExport = async () => {
				if (bookId === "") {
					setMessage("请先同步以加载书籍列表。");
					return;
				}
				setBusy(true);
				setMessage("导出中…");
				try {
					const result = await api.exportFlomo(bookId, flomoTag.trim());
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
									width: "150px"
								},
								placeholder: "如 读书笔记（存配置）",
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
									minWidth: "110px"
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
									width: "70px"
								},
								placeholder: "条数",
								value: customLimit,
								onChange: (e) => setCustomLimit(e.target.value)
							}),
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
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.row,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							style: s.button,
							onClick: () => void runSync(),
							disabled: busy || !view?.configured,
							children: "同步书架/笔记"
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: s.label,
							children: "选择书籍"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
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
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: s.row,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: s.label,
								children: "本次导出标签"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								style: {
									...s.input,
									width: "180px"
								},
								placeholder: "不填则用默认导出标签",
								value: flomoTag,
								onChange: (e) => setFlomoTag(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: s.flex }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								style: s.button,
								onClick: () => void runExport(),
								disabled: busy || !view?.configured || !view?.flomoConfigured,
								children: "导出划线到 flomo"
							})
						]
					}),
					message !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.msg,
						children: message
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【API Key】打开 https://weread.qq.com/r/weread-skills → 微信读书账号登录 → 「创建 Key」→ 复制（wrk- 开头）。Key 绑定你的账号身份，可读取你的读书数据，请勿泄露。存于 ~/.dsh/weixinread-flomo.json（权限 0600）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【导出条数】「全部导出」= 把这本书的所有划线都发到 flomo，内容超长会自动拆成多条 MEMO（每条约 1800 字符）； 「20/50/100 条」= 每本书最多导出的划线条数；「自定义」= 填你自己的数字。该项存进插件配置，weread_flomo 工具与面板导出都遵循（工具也可用 limit 参数临时覆盖）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【flomo 标签】flomo 没有「目录」，标签就是写进 MEMO 的 #标签（如 #读书笔记），用于分类归档。 「默认导出标签」存进本插件配置，是 weread_flomo 工具或面板导出时没指定标签的兜底； 「本次导出标签」只影响当前这一次导出（选书 → 填标签 → 点导出），留空则用默认标签。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: s.hint,
						children: "【其他】同步快照存 ~/.dsh/weixinread-flomo-cache.json；flomo 导出复用「Flomo」面板的凭据。 同步后可用 weread_shelf / weread_notes / weread_readdata / weread_search / weread_book 等工具。"
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
				console.warn("[weixinread-flomo] settings panel registration failed:", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map