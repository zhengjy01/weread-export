# weixinread-flomo

微信读书（WeChat Reading）集成插件 for DeepSeek Harness：使用官方 WeRead Skills Agent Gateway（`i.weread.qq.com/api/agent/gateway`）读取书架、划线/想法/书签、书籍信息、阅读统计，并把划线一键导出到 flomo（标签可自定义）。包含 Agent 工具与 Web 设置面板。

> 本插件使用**官方 API Key**（`wrk-` 开头），不是 Cookie 抓取方案，稳定且无风控风险。

## 安装

```bash
# 本地开发
dsh plugin --profile web add link:/path/to/weixinread-flomo
# 或发布后从 GitHub / npm 安装
dsh plugin --profile web add github:zhengjy01/weixinread-flomo
```

重启 DSH GUI 后生效。

## 配置

1. 打开 <https://weread.qq.com/r/weread-skills>，用微信读书账号登录。
2. 点击「创建 Key」→ 复制（`wrk-` 开头）。
3. 把 Key 填到 Web 设置页「微信读书」面板，或在对话中调用 `weread_config`。
4. （可选）在「Flomo」面板配置 flomo API URL / API Key，即可用 `weread_flomo` 导出划线。

Key 存于 `~/.dsh/weixinread-flomo.json`（权限 0600），同步快照存于 `~/.dsh/weixinread-flomo-cache.json`。

## 工具

| 工具 | 说明 |
| --- | --- |
| `weread_status` | 查看配置/缓存/flomo 联动状态（不回显完整 Key） |
| `weread_config` | 配置或清除 API Key、默认 flomo 标签；`test: true` 测试连接 |
| `weread_search` | 书城搜索（书名/作者/评分/在读人数/bookId/链接） |
| `weread_book` | 书籍详情 + 阅读进度 + 章节目录概览 |
| `weread_shelf` | 书架（实时或缓存）：书名/进度/最近阅读时间/是否读完 |
| `weread_notes` | 不给 bookId = 笔记本概览；给 bookId = 该书划线 + 想法 |
| `weread_readdata` | 阅读统计（weekly/monthly/annually/overall） |
| `weread_sync` | 拉取书架 + 笔记本概览到本地缓存 |
| `weread_flomo` | 把某本书划线导出到 flomo，#标签可自定义（默认取配置值） |

## 常见问题

- **升级提示（upgrade_info）**：微信读书偶尔要求客户端升级 skill 版本，插件会直接提示升级信息，等待插件更新即可。
- **接口字段**：网关回包经过官方字段裁剪，本插件按官方文档解析；若某字段缺失会优雅降级展示。
- **flomo 未配置**：`weread_flomo` 会提示先配置 flomo（复用 dsh-flomo 的凭据文件）。

## License

MIT
