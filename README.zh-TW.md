[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Русский](README.ru.md)

<div align="center">

<img src="https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/.github/assets/ErisPulseLogo.png" width="180" alt="AIBuilder" />

# AIBuilder

**自然語言生成可用的 ErisPulse 模組**

<p>
  <a href="https://github.com/ErisPulse/ErisPulse/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  <img src="https://raw.githubusercontent.com/ErisPulse/.github/main/assets/badges/ecosystem.svg" alt="ErisPulse">
</p>

</div>

---

## 简介

用自然语言描述需求，AI 查阅 ErisPulse 官方文档后生成完整的模块/适配器源码，打包为 ZIP 下载。生成过程中可以在浏览器里直接试运行：页面通过 WebAssembly 跑起一个真实的 ErisPulse 实例，AI 会自己运行刚写的代码、根据报错修改，直到跑通。

本仓库是从[官网](https://www.erisdev.com)抽离出的独立应用，部署在 `builder.erisdev.com`。

### 工作流程

1. **规划**：AI 只查文档、和你确认需求与方案，不写文件。
2. **生成**：发送「开始生成」后，AI 写出全部源码，然后调用 `run_module` 把代码部署进浏览器内的实例运行，有报错就改，直到通过。
3. **试运行**：打开「实例控制台」可以注入模拟聊天消息，查看运行日志和模块发出的消息。

### 特性

- 文档检索走官方 MCP Server（mcp.erisdev.com），不在本地建索引
- 自带 OpenAI 兼容 API 配置，密钥只存浏览器本地
- 多会话管理，支持导入/导出 JSON；生成的文件带撤销/重做
- 界面有亮/暗/OLED 三套主题，适配移动端
- 界面文案支持 zh-CN / en / zh-TW / ja / ru

### 浏览器实例的限制

WebAssembly 是单线程环境，以下能力在实例里跑不了：

- SQL / ORM / 事务（aiosqlite 依赖原生线程）；`storage` 的 KV 读写是内存实现，可用
- 原生线程、文件监视热重载
- 监听端口，所以 Dashboard 跑不起来，实例控制台代替它的位置

其余能力（模块生命周期、命令、事件处理、`event.reply`、config 读写）都是真实的框架行为。AI 写代码时知道这些边界，会主动规避。

## 本地预览

纯静态页面，任意 HTTP 服务器即可（ES Modules 不能用 `file://` 直接打开）：

```bash
python -m http.server 8000
# 或
npx serve -p 8000
```

打开 `http://localhost:8000`。

## 使用

1. 第一次打开会弹出配置向导，填 API 地址、Key 和模型名，可以点「测试连接」验证；之后在左下角「配置」里也能改
2. 描述需求，在规划阶段和 AI 确认方案
3. 发送「开始生成」，AI 写代码并自动试运行
4. 完成后下载 ZIP；也可以在实例控制台里手动注入消息试试模块的反应

首次启动实例需要下载运行时和依赖（约 20-40MB），之后走浏览器缓存。

> 密钥默认保存在本地（localStorage），可在设置里关闭「记住密钥」。

## 文档来源

构建器的知识库通过 ErisPulse MCP Server（`mcp.erisdev.com`）实时检索：

- `search_docs(query, top_k?, lang?)` — BM25 关键词检索
- `read_document(doc_path, lang?)` — 读取单篇文档
- `list_documents(lang?)` — 列出所有文档
- `list_languages()` — 列出支持的语言
- `list_source_files()` / `read_source_file(file_path)` — 查阅 SDK 源码

同 IP 限速 50 次/分钟，客户端内置速率控制。配置见 [`assets/js/mcp.js`](assets/js/mcp.js) 与 [`assets/js/config.js`](assets/js/config.js)。

## 技术栈

原生 JavaScript (ES6 Modules)，无构建步骤。[Pyodide](https://pyodide.org/)（浏览器内 Python）、[Marked.js](https://marked.js.org/)、[Prism.js](https://prismjs.com/)、[JSZip](https://stuk.github.io/jszip/)，图标为内联 SVG。

## 项目结构

```
AIBuilder/
├── index.html              # 页面入口
├── CNAME                   # builder.erisdev.com
├── assets/
│   ├── css/
│   │   ├── base.css        # 主题变量（亮/暗/OLED）
│   │   └── builder.css     # 组件样式与移动端适配
│   └── js/
│       ├── app.js          # 入口初始化
│       ├── builder.js      # 对话、工具调用、会话、ZIP 等核心逻辑
│       ├── sandbox.js      # 实例管理器（状态机、超时保护）
│       ├── sandbox-worker.js # Pyodide Worker（框架引导、MockAdapter、热重载）
│       ├── icons.js        # 内联 SVG 图标
│       ├── mcp.js          # MCP 客户端
│       ├── config.js       # 站点配置与默认设置
│       ├── i18n.js         # 多语言文案
│       ├── state.js        # 设置持久化
│       └── notify.js       # 提示工具
└── README.md
```

## 相关

- 官网：<https://www.erisdev.com>
- 主仓库：<https://github.com/ErisPulse/ErisPulse>
- 文档：<https://www.erisdev.com/docs>

## 许可证

MIT
