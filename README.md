[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Русский](README.ru.md)

<div align="center">

<img src="https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/.github/assets/ErisPulseLogo.png" width="180" alt="AIBuilder" />

# AIBuilder

**Turn natural language into a ready-to-use ErisPulse module**

<p>
  <a href="https://github.com/ErisPulse/ErisPulse/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  <img src="https://raw.githubusercontent.com/ErisPulse/.github/main/assets/badges/ecosystem.svg" alt="ErisPulse">
</p>

</div>

---

## Overview

Describe what you need in natural language; the AI reads the official ErisPulse docs, generates a complete module/adapter, and packages it as a ZIP. While generating, you can run it right in the browser: the page spins up a real ErisPulse instance via WebAssembly, the AI runs its own code, fixes errors it hits, and iterates until it works.

This repo is the standalone app extracted from the [website](https://www.erisdev.com), deployed at `builder.erisdev.com`.

### Workflow

1. **Plan** — the AI only reads docs and confirms requirements with you; nothing is written yet.
2. **Generate** — after you send "start generating", the AI writes all source files, then calls `run_module` to deploy the code into the in-browser instance, fixing errors until it passes.
3. **Try it** — open the "Instance console" to inject simulated chat messages and watch logs and outgoing messages.

### Features

- Doc retrieval via the official MCP Server (mcp.erisdev.com); no local index
- Built-in OpenAI-compatible API config; keys stay in your browser
- Multi-session management with JSON import/export; generated files support undo/redo
- Light / dark / OLED themes, mobile-friendly
- UI in zh-CN / en / zh-TW / ja / ru

### Browser instance limits

WebAssembly is single-threaded, so a few things can't run in the instance:

- SQL / ORM / transactions (aiosqlite needs native threads); `storage` KV reads/writes use an in-memory implementation and work fine
- Native threads and file-watcher hot reload
- Listening ports — so no Dashboard; the instance console stands in for it

Everything else (module lifecycle, commands, event handling, `event.reply`, config reads/writes) is real framework behavior. The AI knows these boundaries and works around them.

## Local preview

Pure static page — serve it with any HTTP server (ES Modules won't open via `file://`):

```bash
python -m http.server 8000
# or
npx serve -p 8000
```

Open `http://localhost:8000`.

## Usage

1. On first open, a setup wizard asks for the API endpoint, key and model name — "Test connection" verifies them; you can change these later in "Config" at the bottom-left
2. Describe your needs and confirm the plan with the AI
3. Send "start generating" — the AI writes the code and auto-runs it
4. Download the ZIP when done, or inject messages in the instance console to test the module's reactions

The first instance start downloads the runtime and dependencies (~20-40MB); afterwards it's cached.

> Keys are stored locally (localStorage) by default; "Remember key" can be disabled in settings.

## Docs source

The builder's knowledge base queries the ErisPulse MCP Server (`mcp.erisdev.com`) live:

- `search_docs(query, top_k?, lang?)` — BM25 keyword search
- `read_document(doc_path, lang?)` — read a single doc
- `list_documents(lang?)` — list all docs
- `list_languages()` — list supported languages
- `list_source_files()` / `read_source_file(file_path)` — browse SDK source

Rate limit is 50 req/min per IP with built-in client-side throttling. See [`assets/js/mcp.js`](assets/js/mcp.js) and [`assets/js/config.js`](assets/js/config.js).

## Tech stack

Vanilla JavaScript (ES6 Modules), no build step. [Pyodide](https://pyodide.org/) (Python in the browser), [Marked.js](https://marked.js.org/), [Prism.js](https://prismjs.com/), [JSZip](https://stuk.github.io/jszip/), inline-SVG icons.
