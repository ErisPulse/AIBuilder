<div align="center">

# ErisPulse Builder

AI 模块构建器 · [builder.erisdev.com](https://builder.erisdev.com)

</div>

---

## 简介

ErisPulse **AI 模块构建器**：用自然语言描述需求，AI 会查阅 ErisPulse 官方文档（内置 BM25 文档检索），分两阶段（规划 → 生成）产出完整的 ErisPulse 模块源码，并打包为 ZIP 下载。

本仓库是从 [官网](https://www.erisdev.com) 抽离出的**独立应用**，部署在 `builder.erisdev.com`。官网侧已移除 builder，并自动跳转到本站。

### 工作流程

1. **规划阶段**：AI 仅持有查阅工具（`search_docs` / `read_document`），与你讨论需求、检索文档、形成方案，不写任何文件。
2. **生成阶段**：你说「开始生成」后，AI 切换到生成系统提示词，获得写入工具（`write_file` / `get_manifest` / `finalize`），据此产出完整模块代码。

### 特性

- 🔍 **文档检索（RAG via MCP）**：通过 ErisPulse 官方 MCP Server（mcp.erisdev.com）实时检索文档与源码，无需本地索引
- 🤖 **自带 API**：填入你自己的 OpenAI 兼容 API（`api_url` + `api_key` + `model`），密钥仅存本地
- 💬 **会话管理**：多会话、导入 / 导出（JSON）
- 📦 **文件生成**：AI 生成多文件模块，一键下载 ZIP
- 🌐 **多语言**：随 ErisPulse 文档支持 zh-CN / en / zh-TW / ja / ru

## 本地预览

无需构建步骤，任意静态服务器即可（因为使用 ES Modules，必须用 HTTP 服务器，不能直接 `file://` 打开）：

```bash
# Python
python -m http.server 8000

# 或 Node
npx serve -p 8000
```

打开 `http://localhost:8000`。

## 使用

1. 打开站点，点击右上角「配置模型」填写你的 OpenAI 兼容 API：
   - API URL（如 `https://api.openai.com/v1`）
   - API Key
   - 模型名（如 `gpt-4o`）
2. 在输入框描述你想要的模块（如「做一个每天定时发送一句鸡汤的模块」）
3. 与 AI 在规划阶段确认方案后，发送「开始生成」
4. 生成完成后点击「下载 ZIP」

> ⚠️ 密钥默认保存在本地（localStorage），可在设置里关闭「记住密钥」。

## 文档来源

构建器的知识库通过 **ErisPulse MCP Server**（`mcp.erisdev.com`）实时检索，不在客户端本地缓存/索引文档。MCP 提供：

- `search_docs(query, top_k?, lang?)` — BM25 关键词检索
- `read_document(doc_path, lang?)` — 读取单篇文档
- `list_documents(lang?)` — 列出所有文档
- `list_languages()` — 列出支持的语言
- `list_source_files()` — 列出所有源码文件
- `read_source_file(file_path)` — 读取源码文件内容

> 同 IP 限速 50 次/分钟，客户端内置速率控制。

配置见 [`assets/js/mcp.js`](assets/js/mcp.js) 与 [`assets/js/config.js`](assets/js/config.js)。

## 技术栈

- 原生 JavaScript (ES6 Modules)
- [Marked.js](https://marked.js.org/) · Markdown 渲染
- [Prism.js](https://prismjs.com/) · 代码高亮
- [JSZip](https://stuk.github.io/jszip/) · ZIP 打包（运行时动态加载）
- [Font Awesome](https://fontawesome.com/) · 图标

## 项目结构

```
AIBuilder/
├── index.html              # 应用入口（全屏 builder）
├── CNAME                   # builder.erisdev.com
├── assets/
│   ├── css/
│   │   ├── base.css        # 基础样式 / 主题变量
│   │   └── builder.css     # builder 专属样式
│   └── js/
│       ├── app.js          # 入口初始化
│       ├── builder.js      # 核心逻辑（RAG via MCP、两阶段对话、工具、ZIP）
│       ├── mcp.js          # MCP 客户端（mcp.erisdev.com 文档检索 + 限速）
│       ├── config.js       # MCP 端点 / 默认设置
│       ├── i18n.js         # 多语言文案
│       ├── state.js        # 设置持久化
│       └── notify.js       # 提示工具
└── README.md
```

## 部署

### GitHub Pages（推荐）

本仓库配置为 GitHub Pages 根目录部署：推送到 `main` 分支即自动发布。`CNAME` 已设置为 `builder.erisdev.com`，在 DNS 提供商将 `builder.erisdev.com` CNAME 到 `erispulse.github.io` 即可。

### Cloudflare Pages

连接本仓库，构建命令留空，输出目录为 `/`（根目录）。

## 相关

- 官网：<https://www.erisdev.com>
- 主仓库：<https://github.com/ErisPulse/ErisPulse>
- 文档：<https://www.erisdev.com/docs>

## 许可证

MIT
