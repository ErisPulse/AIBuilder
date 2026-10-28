/**
 * AI 模块构建器
 *
 * 两阶段（规划 → 生成）流程：
 *  - 规划阶段：仅提供查阅工具（search_docs / read_document / list_documents），
 *    与用户讨论需求、查阅文档、形成方案，不写入任何文件。
 *  - 当用户发送「开始」等指令时，切换到生成阶段：更换系统提示词，注入写入工具
 *    （write_file / get_manifest / finalize），AI 据此生成完整模块源码。
 *
 * 核心组件：
 *  - MCP                      —— 通过 mcp.erisdev.com 检索官方文档（search_docs / read_document / ...）
 *  - chatOnce                 —— OpenAI 兼容 Chat Completions 调用（URL 原样使用）
 *  - PLAN_TOOLS / GENERATE_TOOLS / buildSystemPrompt —— 两阶段工具与提示词
 *  - executeTool / runGeneration —— 工具执行与多轮对话主循环
 *  - setupBuilder / autoLoadDocs —— UI 绑定与 MCP 预热
 */

import { CONFIG } from "./config.js";
import { I18n } from "./i18n.js";
import { state, saveUserSettings } from "./state.js";
import { showMessage, escapeHtml } from "./notify.js";
import { MCP } from "./mcp.js";
import { ICONS, icon, BOT_FACE_SVG } from "./icons.js";
import { Sandbox } from "./sandbox.js";

/* ============================================================
 * 1. 配置访问辅助
 * ============================================================ */

function settings() {
  if (!state.userSettings.builder) {
    state.userSettings.builder = { ...CONFIG.DEFAULT_USER_SETTINGS.builder };
  }
  return state.userSettings.builder;
}

function persist() {
  // 关闭「记住密钥」时：清除持久化中的密钥，但内存中保留
  const b = state.userSettings.builder;
  if (!b.persistKey && b.api_key) {
    const mem = b.api_key;
    b.api_key = "";
    saveUserSettings();
    b.api_key = mem;
  } else {
    saveUserSettings();
  }
}

/* ============================================================
 * 2. LLM 客户端（OpenAI Chat Completions 兼容，自动识别端点）
 *    （原 BM25 / chunkDocument / KnowledgeBase 已移除，文档检索改由 MCP 完成）
 * ============================================================ */

/**
 * 自动规范化 API URL：只要不含 /chat/completions 就补上它。
 * - 已含 /chat/completions → 原样使用
 * - 其它（仅域名、/v1、自定义前缀等）→ 去掉尾斜杠后补 /chat/completions
 *   例：https://api.deepseek.com/  → https://api.deepseek.com/chat/completions
 *       https://api.openai.com/v1 → https://api.openai.com/v1/chat/completions
 */
function normalizeApiUrl(url) {
  let u = String(url || "")
    .trim()
    .replace(/\/$/, "");
  if (!u) return u;
  if (/\/chat\/completions$/i.test(u)) return u;
  return u + "/chat/completions";
}

/**
 * 流式请求一轮对话（SSE 解析 delta.content 与 delta.tool_calls）。
 * @param {Array} messages 消息列表
 * @param {Array} tools 工具 Schema 列表
 * @param {{signal?:AbortSignal, onDelta?:(t:string)=>void}} [opts]
 * 若服务端不返回 SSE（忽略 stream 参数），自动回退为整包解析。
 */
async function chatStream(messages, tools, opts) {
  const b = settings();
  if (!b.api_url) throw new Error(I18n.t("builder.error.noApiUrl"));
  if (!b.api_key) throw new Error(I18n.t("builder.error.noApiKey"));
  if (!b.model) throw new Error(I18n.t("builder.error.noModel"));

  // 自动识别端点：完整 URL / /v1 / 仅域名均可
  const url = normalizeApiUrl(b.api_url);
  const body = {
    model: b.model,
    messages: messages,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const headers = { "Content-Type": "application/json" };
  if (b.api_key) headers["Authorization"] = "Bearer " + b.api_key;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts && opts.signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    throw new Error(I18n.t("builder.error.network") + " (" + e.message + ")");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail =
        (errBody.error && errBody.error.message) || JSON.stringify(errBody);
    } catch (_) {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      I18n.t("builder.error.apiError") +
        " (HTTP " +
        res.status +
        "): " +
        detail,
    );
  }

  const onDelta = opts && typeof opts.onDelta === "function" ? opts.onDelta : null;

  // 服务端未返回 SSE：回退整包解析
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.body || !ct.includes("text/event-stream")) {
    const data = await res.json();
    const choice = data.choices && data.choices[0];
    if (!choice) {
      throw new Error(I18n.t("builder.error.apiError") + ": empty choices");
    }
    const msg = choice.message || {};
    if (msg.content && onDelta) onDelta(msg.content);
    return {
      role: "assistant",
      content: msg.content || "",
      tool_calls: msg.tool_calls || undefined,
    };
  }

  // SSE 流式解析
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = []; // index -> {id, type, function:{name, arguments}}

  const processPayload = (jsonStr) => {
    if (!jsonStr || jsonStr === "[DONE]") return;
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (_) {
      return;
    }
    const choice = data.choices && data.choices[0];
    if (!choice) return;
    const delta = choice.delta || {};
    if (delta.content) {
      content += delta.content;
      if (onDelta) onDelta(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx =
          typeof tc.index === "number" ? tc.index : toolCalls.length;
        if (!toolCalls[idx]) {
          toolCalls[idx] = {
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          };
        }
        if (tc.id) toolCalls[idx].id = tc.id;
        if (tc.function) {
          if (tc.function.name)
            toolCalls[idx].function.name += tc.function.name;
          if (tc.function.arguments)
            toolCalls[idx].function.arguments += tc.function.arguments;
        }
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || line.startsWith(":")) continue;
        if (line.startsWith("data:")) processPayload(line.slice(5).trim());
      }
    }
    const rest = buffer.trim();
    if (rest.startsWith("data:")) processPayload(rest.slice(5).trim());
  } catch (e) {
    if (e && e.name === "AbortError") {
      // 中断时携带已累积的部分内容，供上层决定是否保留
      e.partial = {
        content,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      };
      throw e;
    }
    throw new Error(I18n.t("builder.error.network") + " (" + e.message + ")");
  }

  return {
    role: "assistant",
    content,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  };
}

/* ============================================================
 * 6. 两阶段：工具定义 + 系统提示词
 * ============================================================ */

function langName() {
  const map = {
    "zh-CN": "简体中文",
    en: "English",
    "zh-TW": "繁體中文",
    ja: "日本語",
    ru: "Русский",
  };
  return map[I18n.getLang()] || I18n.getLang();
}

/** 当前界面语言的“开始生成”触发词（供系统提示词使用） */
function startKeyword() {
  const kw = I18n.t("builder.startCommand");
  return kw || "start";
}

function docIndexSection() {
  // 文档检索由 MCP 服务端负责，客户端无需预加载索引
  return "【文档检索】\n可通过 search_docs / read_document / list_documents 检索 ErisPulse 官方文档（由 MCP 服务端实时检索）。";
}

const CODE_CONVENTIONS = `【代码规范】
- from ErisPulse import sdk 获取全局 SDK 实例
- from ErisPulse.Core.Bases import BaseModule 作为模块基类
- from ErisPulse.Core.Bases import BaseAdapter 作为适配器基类（适配器专用）
- 命令使用 @command(["名称"], aliases=[], help="说明") 装饰器（仅模块）
- 事件使用 @message.on_message() / @message.on_private_message() 等
- 在 on_load 中注册命令/事件处理器；直接嵌套 async def（闭包，SDK 会正确绑定）
- 配置：config = sdk.config.getConfig("模块名")
- 存储：sdk.storage
- 日志：sdk.logger.get_child("模块名")
- Dashboard：try: sdk.Dashboard.register_view(...) except: pass
- 路由：sdk.router.register_http_route(...)
- 加载策略：from ErisPulse.loaders import ModuleLoadStrategy
- 回复：await event.reply("文本") 或 await event.reply("文本", method="Markdown")

【模块与适配器】
- 模块（module）：面向“业务逻辑”，注册命令/事件处理器、提供功能。入口点为 [project.entry-points."erispulse.module"]
- 适配器（adapter）：面向“平台对接”，继承 BaseAdapter，连接外部平台（如 OneBot/TG/Discord）并转换事件为 OneBot12 标准格式。入口点为 [project.entry-points."erispulse.adapter"]，键名通常为平台名（如 "telegram"）
- 适配器需实现 call_api / 平台事件转换、会话类型映射、可选的 Event 平台扩展方法注册（参考文档「适配器：注册平台扩展方法」）
- 根据用户需求判断是模块还是适配器；两者也可同时开发（同一包可同时声明 module 和 adapter 入口点）`;

/**
 * 规划阶段系统提示词：仅查阅，与用户讨论方案
 */
function buildPlanSystemPrompt() {
  return `你是「小eris」——ErisPulse 框架的官方看板娘，同时也是模块/适配器代码生成专家。

ErisPulse 是基于 Python 的高性能异步机器人开发框架。当前任务：根据用户描述的需求，查阅 ErisPulse 官方文档，与用户一起规划要生成的「模块」或「适配器」。

【当前阶段：规划】
你**没有写入文件的权限**。专注于理解需求和查阅文档，给出清晰的实现方案。

【你的工具】（仅查阅与提问）
- search_docs(query, top_k)：关键词检索官方文档（${langName()} 版本，由 MCP 实时检索）。一次可覆盖多个关键词，例如一次搜索"命令注册 事件监听 配置 存储"。
- read_document(doc_path)：读取某篇文档完整内容。
- list_documents()：列出所有文档标题与路径。
- ask_question(questions)：向用户提问。questions 是数组，每项含 question（问题）、options（选项）和可选的 multi（true 时为多选）。注意 options 必须是纯字符串数组（如 ["选项A","选项B"]），不要传对象。可一次问多个相关问题。系统会自动为每个问题追加「自定义答案」。澄清需求时优先用它，不要把多个问题堆在一段文字里。
- web_fetch(url, method?, headers?, body?)：联网获取网页内容或调用 HTTP API（浏览器直连，受 CORS 限制，失败会返回说明）。查询外部资料、调用开放 API 时使用；ErisPulse 文档仍优先用 search_docs。

【职责】
1. 收到用户需求后，先判断是「模块」（业务逻辑）还是「适配器」（平台对接），不确定时用 ask_question 询问。
2. 调用 search_docs 检索相关 SDK API，确认正确用法。适配器务必检索 "适配器 BaseAdapter" "会话类型" "平台扩展方法" 等关键词。
3. 填写模块/适配器元信息时，如果用户没有特别说明，作者为 erisQvQ 邮箱为 erisQvQ@erisdev.com
4. 需要澄清时，用 ask_question 一次性提出相关问题（每个问题附带选项；需多选时设 multi:true）。
5. 信息齐全后给出清晰的实现方案概述：要生成哪些文件、每个文件的职责、是模块还是适配器（或二者）。

${CODE_CONVENTIONS}

【严格要求】
- 不要编造不存在的 API；不确定时先 search_docs 确认。
- 每轮只输出 tool_call；如需说明用不超过 20 字的简短 Markdown。
- 禁止角色扮演文本，禁止 emoji。
- 规划完成、用户满意后，提示用户发送「${startKeyword()}」进入生成阶段（用${langName()}提示）。
- 用户界面当前语言为${langName()}，请**始终使用该语言**回复用户。
- 若用户使用其他语言发送消息，请以用户所用的语言为准。

${docIndexSection()}`;
}

/**
 * 生成阶段系统提示词：拥有写入工具，生成完整源码
 */
function buildGenerateSystemPrompt() {
  return `你是「小eris」——ErisPulse 框架的官方看板娘，同时也是模块/适配器代码生成专家。

【当前阶段：生成】
用户已确认「${startKeyword()}」。根据之前规划的需求与方案，生成一个完整可用的 ErisPulse 模块/适配器代码。

你可以调用以下工具来查阅 ErisPulse 官方文档（${langName()} 版本）：
- search_docs(query, top_k)：关键词检索官方文档（由 MCP 实时检索），返回最相关的片段。优先用它定位内容。
- read_document(doc_path)：读取某篇文档的完整内容。当你已从检索结果或索引中确定要看哪篇文档时使用。
- list_documents()：列出所有可用文档的标题与路径。
- web_fetch(url, method?, headers?, body?)：联网获取网页内容或调用 HTTP API（浏览器直连，受 CORS 限制，失败会返回说明）。ErisPulse 文档仍优先用 search_docs。
- write_file(path, content)：写入一个生成的文件（覆盖已存在）。适合创建新文件或大幅重写。
- patch_file(path, old_text, new_text, replace_all)：在已有文件中模糊替换片段。适合小幅修改（改名、加一行、调整参数）。采用模糊匹配（忽略多余空白差异），old_text 须能唯一定位。
- read_file(path)：读取一个已生成文件的当前完整内容。修改前建议先读取确认。
- delete_file(path)：删除一个已生成文件。
- get_manifest()：查看当前已生成的文件清单。
- finalize()：标记生成完成。

【实例试运行（浏览器内真实 ErisPulse 实例）】
- run_module(events?)：把已生成文件部署到实例并运行（自动重载旧代码），events 为可选的 OneBot12 事件数组（字符串 = 私聊文本）。返回运行日志、错误与实例发出的消息。
- exec_python(code)：在实例内执行任意 Python（顶层 await 可用），返回输出与结果 repr。用于调试与检查状态。
- install_packages(packages)：为实例追加安装纯 Python 依赖（micropip）。

实例运行规则：
1. 所有文件写完后，必须调用 run_module 运行一次；若报错（ImportError/语法错误/处理器异常等），用 patch_file 修复后再次运行，直到通过。
2. 运行通过后再 finalize。修复迭代最多 3 轮，仍有错误时如实告知用户剩余问题。
3. 实例中平台名为 "ep_mock"（MockAdapter），不联网；模块发出的消息会被捕获并回传给你。
4. pyproject.toml 声明的依赖若非 ErisPulse 自带，先用 install_packages 安装再运行。

【严格要求 - 必须遵守】
1. 收到用户需求后，第一轮必须立即调用 search_docs 检索相关 SDK API。一次 search_docs 可以覆盖多个关键词，例如一次搜索"命令注册 事件监听 配置 存储"，不要为每个关键词单独调用
2. 第二轮根据检索结果决定下一步：信息足够则开始 write_file，不够则 read_document 补充
3. 信息足够后立即生成所有必要文件（见下方“文件要求”）
4. 需要小幅修改已生成文件时优先用 patch_file（更省 token），仅大幅重写或新建文件才用 write_file
5. 所有文件写完后用 finalize 标记完成
6. 每轮只输出 tool_call。如果某个步骤需要额外说明（如修正之前的文件、跳过某个功能等），可以用不超过20字的简短 Markdown 说明。简单检索/阅读/生成不需要说话
7. 绝对禁止输出角色扮演文本，不要输出 emoji

【文件要求】
模块（module）默认结构：
- pyproject.toml：完整的项目配置，包含 [project.entry-points."erispulse.module"] 入口点
- __init__.py：导出 Main 类
- Core.py：继承 BaseModule，包含 __init__、get_load_strategy、on_load、on_unload
- config.py：配置加载，读取 [模块名] 配置段
- README.md：安装说明、配置说明、使用说明

适配器（adapter）默认结构：
- pyproject.toml：包含 [project.entry-points."erispulse.adapter"] 入口点，键名为平台名
- __init__.py：导出 Main 类
- Core.py：继承 BaseAdapter，实现平台连接、事件转换、call_api、会话类型映射
- README.md：说明支持的平台、配置项、会话类型映射

如果用户需求同时涉及模块与适配器，在同一包中同时声明两个入口点。

${CODE_CONVENTIONS}

【严格禁止】
- 不要编造不存在的 API、参数或方法
- 不确定的 API 必须用 search_docs 先查文档确认
- 用户界面当前语言为${langName()}，请**始终使用该语言**回复用户。
- 若用户使用其他语言发送消息，请以用户所用的语言为准。

${docIndexSection()}`;
}

function buildSystemPrompt() {
  const base = phase === "generate"
    ? buildGenerateSystemPrompt()
    : buildPlanSystemPrompt();
  // 注入用户知识库
  return base + knowledgeBaseSection();
}

// 工具 schema：按阶段分组
const READ_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "search_docs",
      description: "在 ErisPulse 官方文档中检索相关片段（由 MCP 服务端实时检索）",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "检索关键词（可一次包含多个，用空格分隔）",
          },
          top_k: { type: "integer", description: "返回条目数，默认 5" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_document",
      description: "读取某篇文档的完整内容",
      parameters: {
        type: "object",
        properties: {
          doc_path: { type: "string", description: "文档 path" },
        },
        required: ["doc_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "列出所有可用的官方文档",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "联网请求：从互联网获取 URL 内容或调用 HTTP API（浏览器直连）。适合查询资料、读取网页、调用开放 API。注意：受浏览器 CORS 限制，无 CORS 头的站点会失败；ErisPulse 文档请优先用 search_docs",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "完整的 http/https URL" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
            description: "HTTP 方法，默认 GET",
          },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "可选，请求头键值对",
          },
          body: {
            type: "string",
            description: "可选，请求体（POST/PUT 等使用）",
          },
        },
        required: ["url"],
      },
    },
  },
];

const WRITE_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "写入一个生成文件（覆盖已存在）。适合创建新文件或大幅重写整份文件",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件路径，如 Core.py / config.py",
          },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description:
        "模糊替换：在已生成文件中查找 old_text 并替换为 new_text。适合小幅修改（如改个名、加一行、调整参数）。采用模糊匹配（忽略首尾空白与多余空格差异），old_text 在文件中须能唯一定位",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要修改的文件路径（必须已存在）",
          },
          old_text: {
            type: "string",
            description:
              "要被替换的原文片段（足够具体以唯一定位，至少 10 字符）",
          },
          new_text: {
            type: "string",
            description: "替换后的新文本",
          },
          replace_all: {
            type: "boolean",
            description:
              "可选，默认 false。true 时替换所有匹配位置（用于批量重命名等）",
          },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "读取一个已生成文件的当前完整内容。修改文件前建议先读取确认现状",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件路径",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "删除一个已生成的文件",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "要删除的文件路径" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manifest",
      description: "查看当前已生成的所有文件列表",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize",
      description: "标记本次生成完成，所有文件已就绪",
      parameters: { type: "object", properties: {} },
    },
  },
];

const ASK_QUESTION_SCHEMA = {
  type: "function",
  function: {
    name: "ask_question",
    description:
      "向用户提问，可一次包含多个问题。每个问题附带若干选项，系统会自动为每个问题追加「自定义答案」。用户回答全部问题后统一提交。",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "问题列表",
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "可选，问题标识，用于结果对照",
              },
              question: {
                type: "string",
                description: "问题内容",
              },
              multi: {
                type: "boolean",
                description:
                  "可选，是否允许多选。默认 false（单选）。多选时用户可勾选多个选项，结果以「、」分隔返回",
              },
              options: {
                type: "array",
                items: { type: "string" },
                description:
                  '选项列表，每项必须是纯字符串文本（如 ["选项A","选项B"]），禁止传 {label:...} 等对象。不要包含「自定义」，系统会自动追加',
              },
            },
            required: ["question", "options"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

const CONFIRM_START_SCHEMA = {
  type: "function",
  function: {
    name: "confirm_start",
    description:
      "当资料/方案准备完毕，向用户确认是否开始生成。用户确认后会自动切换到生成阶段。",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "可选，给用户的提示语",
        },
      },
    },
  },
};

// 实例操作工具（生成阶段可用）：在浏览器内的真实 ErisPulse 实例中运行/调试
const INSTANCE_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "run_module",
      description:
        "把当前已生成的全部文件部署到浏览器内的真实 ErisPulse 实例并运行（自动重载旧代码）。可选注入 OneBot12 测试事件驱动模块。返回运行日志、错误与实例发出的消息。生成文件后强烈建议运行一次验证；发现报错应修复文件后再次运行。",
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            description:
              "可选，注入的 OneBot12 事件数组。每项可用简写形式（字符串 = 私聊文本），或完整事件对象（如 {\"platform\":\"ep_mock\",\"type\":\"message\",\"detail_type\":\"private\",\"message\":[{\"type\":\"text\",\"data\":{\"text\":\"你好\"}}]}）。省缺时自动注入一条私聊消息「你好」。",
            items: {},
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exec_python",
      description:
        "在已启动的 ErisPulse 实例内执行任意 Python 代码（支持顶层 await，可直接 import 生成的模块或 from ErisPulse import sdk）。返回 stdout 输出与最后表达式的 repr。用于调试、检查运行时状态。",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "要执行的 Python 代码" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_packages",
      description:
        "为实例安装额外的纯 Python 依赖（通过 micropip，从 PyPI 安装）。仅支持纯 Python 包或 Pyodide 内置包（如 matplotlib、Pillow、httpx）；含 C 扩展且非内置的包无法安装。",
      parameters: {
        type: "object",
        properties: {
          packages: {
            type: "array",
            items: { type: "string" },
            description: "包名列表，如 [\"matplotlib\"]",
          },
        },
        required: ["packages"],
      },
    },
  },
];

function isMcpEnabled() {
  const servers = settings().mcpServers || [];
  return servers.some((s) => s.enabled !== false);
}
function getPlanTools() {
  const tools = [ASK_QUESTION_SCHEMA, CONFIRM_START_SCHEMA];
  if (isMcpEnabled()) return READ_TOOL_SCHEMAS.concat(tools);
  return tools;
}
function getGenerateTools() {
  const tools = WRITE_TOOL_SCHEMAS.concat(INSTANCE_TOOL_SCHEMAS);
  if (isMcpEnabled()) return READ_TOOL_SCHEMAS.concat(tools);
  return tools;
}
// 保留旧常量名以兼容外部引用
const PLAN_TOOLS = READ_TOOL_SCHEMAS.concat([
  ASK_QUESTION_SCHEMA,
  CONFIRM_START_SCHEMA,
]);
const GENERATE_TOOLS = READ_TOOL_SCHEMAS.concat(
  WRITE_TOOL_SCHEMAS,
  INSTANCE_TOOL_SCHEMAS,
);

/* ============================================================
 * 7. 已生成文件状态 + 阶段状态
 * ============================================================ */

let generatedFiles = {};
let finalized = false;
let phase = "plan"; // 'plan' | 'generate'
let conversation = [];
let activeMessagesEl = null; // 当前对话区引用，供 switchPhase 插入系统提示
let docsHintShown = false;
let sendMode = "enter"; // 'enter' | 'ctrlEnter'
let pendingUploads = []; // {name, content, size} 待随下一条消息发送的上传文件

// 允许上传的文本文件扩展名（白名单）
const UPLOAD_TEXT_EXTS = [
  "md",
  "markdown",
  "txt",
  "text",
  "log",
  "rst",
  "csv",
  "tsv",
  "json",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "cfg",
  "py",
  "js",
  "ts",
  "html",
  "css",
  "xml",
  "sql",
];
const UPLOAD_MAX_BYTES = 256 * 1024; // 单文件上限 256KB

function resetGenerated() {
  generatedFiles = {};
  finalized = false;
}

function resetAll() {
  resetGenerated();
  conversation = [];
  phase = "plan";
  updatePhaseToggle();
  persistCurrentSession();
}

/* ============================================================
 * 8. 工具执行器
 * ============================================================ */

/**
 * 转义正则元字符，并把连续空白转为 \s+，从而实现“忽略多余空白差异”的模糊匹配。
 */
function buildFuzzyPattern(text) {
  const escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(/\s+/g, "\\s+");
}

/**
 * 在 content 中查找所有模糊匹配位置（忽略多余空白），返回数组（按位置升序）
 */
function fuzzyFindAll(content, oldText) {
  if (!String(oldText).trim()) return [];
  try {
    const re = new RegExp(buildFuzzyPattern(oldText), "g");
    const results = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      results.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++; // 防御零宽匹配死循环
    }
    return results;
  } catch (e) {
    return [];
  }
}

/**
 * 将选项归一化为纯文本。部分模型不遵守 Schema，会把选项传成对象
 * （如 {label, description}），直接 String() 会得到 "[object Object]"。
 */
function normalizeOptionText(o) {
  if (o == null) return "";
  if (typeof o === "string") return o.trim();
  if (typeof o === "object") {
    for (const k of ["label", "text", "value", "option", "title", "name"]) {
      if (typeof o[k] === "string" && o[k].trim()) return o[k].trim();
    }
    const strVals = Object.values(o).filter((v) => typeof v === "string");
    if (strVals.length > 0) return strVals.join("：").trim();
    try {
      return JSON.stringify(o);
    } catch (e) {
      return "";
    }
  }
  return String(o).trim();
}

const WEB_FETCH_TIMEOUT_MS = 30000;
const WEB_FETCH_MAX_CHARS = 8000;

/**
 * 联网能力守卫：设置开关 + 首次确认（可记住选择）
 */
async function ensureWebFetchAllowed() {
  const b = settings();
  if (b.webTool === false) return { ok: false, disabled: true };
  if (b.webToolConsent === true) return { ok: true };
  const result = await showConfirmModal(I18n.t("builder.webFetch.confirm"), {
    checkboxLabel: I18n.t("builder.webFetch.remember"),
  });
  if (!result.ok) return { ok: false };
  if (result.checked) {
    b.webToolConsent = true;
    persist();
  }
  return { ok: true };
}

/**
 * web_fetch 工具实现：浏览器直连 fetch，不做代理。
 * 失败（CORS/超时/非 2xx）时返回说明文本，供 AI 自行调整策略。
 */
async function doWebFetch(args) {
  const allowed = await ensureWebFetchAllowed();
  if (!allowed.ok) {
    return allowed.disabled
      ? I18n.t("builder.webFetch.disabled")
      : I18n.t("builder.webFetch.denied");
  }

  const url = String((args && args.url) || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return "错误：url 必须以 http:// 或 https:// 开头";
  }
  const method = String((args && args.method) || "GET").toUpperCase();
  const headers = { Accept: "application/json, text/html;q=0.9, */*;q=0.8" };
  if (args && args.headers && typeof args.headers === "object") {
    for (const [k, v] of Object.entries(args.headers)) {
      if (typeof v === "string") headers[k] = v;
    }
  }
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : String((args && args.body) ?? "");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEB_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    const timedOut = e && e.name === "AbortError";
    return (
      "请求失败：" +
      (timedOut
        ? "超时（" + WEB_FETCH_TIMEOUT_MS / 1000 + " 秒）"
        : I18n.t("builder.webFetch.cors")) +
      " (" +
      ((e && e.message) || "unknown") +
      ")。" +
      I18n.t("builder.webFetch.fallback")
    );
  }
  clearTimeout(timer);

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  let text = await res.text().catch(() => "");
  if (ct.includes("json")) {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {}
  }
  let out =
    "HTTP " +
    res.status +
    " " +
    (res.statusText || "") +
    (ct ? "\nContent-Type: " + ct : "") +
    "\n\n";
  if (text.length > WEB_FETCH_MAX_CHARS) {
    out +=
      text.slice(0, WEB_FETCH_MAX_CHARS) +
      "\n…（内容过长已截断，原文共 " +
      text.length +
      " 字符）";
  } else {
    out += text;
  }
  return out;
}

async function executeTool(name, args, ctx) {
  switch (name) {
    case "web_fetch": {
      return await doWebFetch(args);
    }
    case "search_docs": {
      const topK = Math.max(1, Math.min(20, args.top_k || 5));
      return await MCP.callTool("search_docs", {
        query: args.query || "",
        top_k: topK,
        lang: I18n.getLang(),
      });
    }
    case "read_document": {
      return await MCP.callTool("read_document", {
        doc_path: args.doc_path || "",
        lang: I18n.getLang(),
      });
    }
    case "list_documents": {
      return await MCP.callTool("list_documents", { lang: I18n.getLang() });
    }
    case "write_file": {
      const path = String(args.path || "").trim();
      if (!path) return "错误：缺少 path";
      if (typeof args.content !== "string") return "错误：content 必须为字符串";
      pushFileSnapshot();
      generatedFiles[path] = args.content;
      return `已写入 ${path}（${args.content.length} 字符）`;
    }
    case "patch_file": {
      const path = String(args.path || "").trim();
      if (!path) return "错误：缺少 path";
      const oldText = String(args.old_text || "");
      const newText = String(args.new_text || "");
      const replaceAll = !!args.replace_all;
      if (!generatedFiles.hasOwnProperty(path))
        return `错误：文件 ${path} 不存在。请先 write_file 创建或用 get_manifest 查看已有文件。`;
      if (oldText.trim().length < 4)
        return "错误：old_text 太短（至少需要 4 个非空白字符）以保证唯一定位。";
      const content = generatedFiles[path];
      const matches = fuzzyFindAll(content, oldText);
      if (matches.length === 0)
        return `错误：在 ${path} 中未找到匹配片段。请用 read_file 查看当前内容后再试。`;
      if (!replaceAll && matches.length > 1)
        return `错误：在 ${path} 中找到 ${matches.length} 处匹配，无法唯一定位。请提供更具体的 old_text，或设置 replace_all=true 进行全部替换。`;
      // 从后往前替换，避免索引偏移
      const toReplace = replaceAll ? matches : matches.slice(0, 1);
      let updated = content;
      for (let i = toReplace.length - 1; i >= 0; i--) {
        const m = toReplace[i];
        updated = updated.slice(0, m.start) + newText + updated.slice(m.end);
      }
      pushFileSnapshot();
      generatedFiles[path] = updated;
      return `已修改 ${path}：替换 ${toReplace.length} 处，现 ${updated.length} 字符。`;
    }
    case "read_file": {
      const path = String(args.path || "").trim();
      if (!path) return "错误：缺少 path";
      if (!generatedFiles.hasOwnProperty(path))
        return `错误：文件 ${path} 不存在。`;
      return generatedFiles[path];
    }
    case "delete_file": {
      const path = String(args.path || "").trim();
      if (!path) return "错误：缺少 path";
      if (!generatedFiles.hasOwnProperty(path))
        return `错误：文件 ${path} 不存在。`;
      pushFileSnapshot();
      delete generatedFiles[path];
      return `已删除 ${path}。`;
    }
    case "get_manifest": {
      const names = Object.keys(generatedFiles);
      if (names.length === 0) return "当前没有已生成文件。";
      return names
        .map((p) => `- ${p} (${generatedFiles[p].length} 字符)`)
        .join("\n");
    }
    case "finalize": {
      finalized = true;
      return "已标记完成。";
    }
    case "run_module": {
      if (Object.keys(generatedFiles).length === 0) {
        return I18n.t("builder.instance.needFiles");
      }
      try {
        const report = await Sandbox.runTest({ ...generatedFiles }, args.events);
        return formatInstanceReport(report);
      } catch (e) {
        return (
          I18n.t("builder.instance.bootFail") + ": " + (e.message || e)
        );
      }
    }
    case "exec_python": {
      try {
        const r = await Sandbox.exec(String(args.code || ""));
        const out = (r.logs || []).map((l) => l.text).join("\n").trim();
        let res =
          "=== stdout ===\n" +
          (out || I18n.t("builder.instance.report.none")) +
          "\n=== result ===\n" +
          (r.result || "(no return value)");
        if (res.length > 4000) res = res.slice(0, 4000) + "\n…（过长已截断）";
        return res;
      } catch (e) {
        return "执行出错: " + (e.message || e);
      }
    }
    case "install_packages": {
      const pkgs = Array.isArray(args.packages)
        ? args.packages.map(String).filter(Boolean)
        : [];
      if (pkgs.length === 0) return "错误：缺少 packages";
      try {
        await Sandbox.install(pkgs);
        return "已安装: " + pkgs.join(", ");
      } catch (e) {
        return "安装失败: " + (e.message || e);
      }
    }
    case "ask_question": {
      const qs = Array.isArray(args.questions) ? args.questions : [];
      if (qs.length === 0) return "（未提供问题）";
      const normalized = qs.map((q, i) => ({
        key:
          normalizeOptionText(q && q.key) ||
          normalizeOptionText(q && q.question) ||
          "Q" + (i + 1),
        question: normalizeOptionText(q && q.question),
        multi: !!(q && q.multi),
        options: Array.isArray(q && q.options)
          ? q.options.map(normalizeOptionText).filter((o) => o)
          : [],
      }));
      if (!ctx || typeof ctx.askQuestions !== "function") {
        return "（当前无法交互提问，请在回复中直接说明）";
      }
      const answers = await ctx.askQuestions(normalized);
      return (
        "用户回答：\n" +
        normalized
          .map((q) => "【" + q.key + "】 " + (answers[q.key] || "(未回答)"))
          .join("\n")
      );
    }
    case "confirm_start": {
      const msg =
        String(args.message || "").trim() || I18n.t("builder.confirmStartMsg");
      const ok = await showConfirmModal(msg);
      if (ok) {
        switchPhase("generate", true);
        return "用户已确认开始，已切换到生成阶段。";
      }
      return "用户选择暂不开始，请继续完善方案。";
    }
    default:
      return "未知工具: " + name;
  }
}

/* ============================================================
 * 9. 阶段切换检测 + 多轮对话主循环
 * ============================================================ */

function isStartCommand(text) {
  const t = String(text || "").trim();
  if (t.length > 80) return false;
  // 命令式触发词（所有支持语言）
  if (
    /^(开始|開始|开始生成|開始生成|开始吧|開始吧|生成吧|start|begin|generate|go|proceed|gen|はじめる|スタート|開始する|начать|начало|старт|начинай|начнём|погнали|поехали|давай)[!！.。?？]*$/i.test(t)
  )
    return true;
  // 短消息中包含触发意图
  if (
    t.length <= 30 &&
    /(开始|開始|start|begin|go|generate|proceed|lets? go|начать|начало|старт|начинай|начнём|погнали|поехали|давай|はじめる|開始する)/i.test(t)
  )
    return true;
  return false;
}

let activeAbort = null; // 当前生成的 AbortController（供「停止」按钮调用）

function stopGeneration() {
  if (activeAbort) activeAbort.abort();
}

/**
 * 执行一轮 AI 生成（根据当前 phase 选择工具与系统提示词）
 * @param {string} requirement 用户输入的可见文本
 * @param {function} onProgress 进度回调
 * @param {object} ctx 上下文（包含 askQuestions 等）
 * @param {Array<{name:string,content:string}>} [attachments] 附带的文件内容（不污染可见输入）
 */
async function runGeneration(requirement, onProgress, ctx, attachments) {
  const tools = phase === "generate" ? getGenerateTools() : getPlanTools();
  const sysMsg = { role: "system", content: buildSystemPrompt() };

  // 拼接用户消息：可见文本 + 附带文件（作为上下文，不展示在输入框）
  const messageContent = buildMessageWithAttachments(requirement, attachments);
  const userMsg = { role: "user", content: messageContent };

  const messages = [sysMsg, ...conversation, userMsg];
  // 用户消息先入 conversation（保持时间顺序）
  conversation.push(userMsg);

  const MAX_ROUNDS = 30;
  const abort = new AbortController();
  activeAbort = abort;
  const streamOpts = {
    signal: abort.signal,
    onDelta: (t) => onProgress({ type: "delta", text: t }),
  };

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (abort.signal.aborted) break;

      onProgress({ type: "stream_start" });
      let assistantMsg;
      try {
        assistantMsg = await chatStream(messages, tools, streamOpts);
      } catch (e) {
        if (e && e.name === "AbortError") {
          // 中断：保留已流式输出的部分内容（无工具调用时才可安全入上下文）
          const partial = e.partial || {};
          if (
            partial.content &&
            partial.content.trim() &&
            !partial.tool_calls
          ) {
            const pmsg = { role: "assistant", content: partial.content };
            messages.push(pmsg);
            conversation.push(pmsg);
          }
          onProgress({ type: "stream_end", aborted: true });
          onProgress({ type: "aborted" });
          return { files: { ...generatedFiles }, finalized, aborted: true };
        }
        throw e;
      }
      onProgress({ type: "stream_end" });

      messages.push(assistantMsg);
      conversation.push(assistantMsg);

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        break;
      }

      for (const call of assistantMsg.tool_calls) {
        const fn = call.function && call.function.name;
        let args = {};
        try {
          args = call.function.arguments
            ? JSON.parse(call.function.arguments)
            : {};
        } catch (e) {
          args = {};
        }

        onProgress({ type: "tool", tool: fn, args });

        let result;
        try {
          result = await executeTool(fn, args, ctx);
        } catch (e) {
          result = "工具执行出错: " + e.message;
        }

        onProgress({ type: "tool_result", tool: fn, result });

        const toolMsg = {
          role: "tool",
          tool_call_id: call.id || "",
          name: fn,
          content: String(result),
        };
        messages.push(toolMsg);
        conversation.push(toolMsg);
      }

      if (finalized) break;
    }
  } finally {
    activeAbort = null;
  }

  return { files: { ...generatedFiles }, finalized };
}

/* ============================================================
 * 10. ZIP 打包
 * ============================================================ */

let jszipLoaded = false;

async function ensureJSZip() {
  if (jszipLoaded && window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load JSZip"));
    document.head.appendChild(s);
  });
  jszipLoaded = !!window.JSZip;
  return window.JSZip;
}

function extractModuleName(content) {
  if (!content) return "ErisPulseModule";
  const m = content.match(/name\s*=\s*"([^"]+)"/);
  if (m && m[1]) return m[1].trim();
  return "ErisPulseModule";
}

async function downloadZip() {
  const names = Object.keys(generatedFiles);
  if (names.length === 0) {
    showMessage(I18n.t("builder.noFiles"), "warning");
    return;
  }
  const pyproject = generatedFiles["pyproject.toml"] || "";
  const moduleName = extractModuleName(pyproject);
  try {
    const JSZip = await ensureJSZip();
    const zip = new JSZip();
    const folder = zip.folder(moduleName);
    for (const [path, content] of Object.entries(generatedFiles)) {
      folder.file(path, content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = moduleName + ".zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    showMessage(I18n.t("builder.error.zip") + ": " + e.message, "error");
  }
}

/* ============================================================
 * 11. UI 渲染辅助
 * ============================================================ */

function $(id) {
  return document.getElementById(id);
}

function renderMarkdown(text) {
  if (window.marked && typeof window.marked.parse === "function") {
    return window.marked.parse(text || "");
  }
  return escapeHtml(text || "");
}

// 统一从 icons.js 取内联 SVG（QvQChat 风格线性描边图标）
const ICON_PAPERCLIP = icon("paperclip");
const ICON_SQUARE = icon("square", "builder-svg-icon builder-svg-check");
const ICON_CHECK_SQUARE = icon(
  "checkSquare",
  "builder-svg-icon builder-svg-check",
);
const ICON_X = icon("x");
const ICON_CHEVRON_RIGHT = icon(
  "chevronRight",
  "builder-svg-icon builder-svg-chevron",
);
const ICON_CHEVRON_DOWN = icon(
  "chevronDown",
  "builder-svg-icon builder-svg-chevron",
);

/**
 * 将消息内容容器中的 <pre><code class="language-x"> 增强为
 * QvQChat 风格的代码块（语言标签栏 + 复制按钮），并应用 Prism 高亮。
 */
function enhanceMarkdownContainer(container) {
  if (!container) return;
  const blocks = container.querySelectorAll("pre > code");
  blocks.forEach((code) => {
    const pre = code.parentElement;
    if (pre.parentElement && pre.parentElement.classList.contains("builder-md-pre")) return;
    const lang =
      (code.className.match(/language-([\w-]+)/) || [])[1] || "text";
    const wrap = document.createElement("div");
    wrap.className = "builder-md-pre";
    const bar = document.createElement("div");
    bar.className = "builder-md-lang";
    const langLabel = document.createElement("span");
    langLabel.textContent = lang;
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "builder-md-copy";
    copyBtn.innerHTML = icon("copy") + "<span>" + escapeHtml(I18n.t("builder.copy")) + "</span>";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyTextToClipboard(code.textContent || "");
      const span = copyBtn.querySelector("span");
      if (span) {
        const old = span.textContent;
        span.textContent = I18n.t("builder.copied");
        setTimeout(() => (span.textContent = old), 1200);
      }
    });
    bar.appendChild(langLabel);
    bar.appendChild(copyBtn);
    // 原位替换：pre → wrap(pre)
    pre.replaceWith(wrap);
    wrap.appendChild(bar);
    wrap.appendChild(pre);
    // Prism 高亮
    if (typeof Prism !== "undefined" && lang !== "text") {
      try {
        Prism.highlightElement(code);
      } catch (_) {}
    }
  });
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    ta.remove();
  }
}

// 用户消息中“附带文件”区的起始标记，供历史重现时解析出可见文本
const ATTACHMENT_HEADER =
  "[以下是用户附带上传的文件内容，供你参考，不要在回复中原样重复：]";

/**
 * 解析存储在 conversation 中的 user 消息，拆分出「可见文本」与「附带文件名」。
 * 合并存储时以 ATTACHMENT_HEADER 为分隔；之前部分为用户输入，之后的
 * “----- 附带文件：{name} ----”用于提取文件名。
 */
function parseStoredUserContent(content) {
  content = String(content || "");
  const idx = content.indexOf(ATTACHMENT_HEADER);
  if (idx === -1) return { text: content, fileNames: [] };
  const text = content.slice(0, idx).replace(/\s+$/, "").trim();
  const fileNames = [];
  const re = /-----\s*附带文件：(.+?)\s*----/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const n = m[1].trim();
    if (n) fileNames.push(n);
  }
  return { text, fileNames };
}

/**
 * 构造合并后的用户消息内容（可见文本 + 附带文件块）。
 * 历史重现时用 parseStoredUserContent 拆回去，因此格式必须与之一致。
 */
function buildMessageWithAttachments(requirement, attachments) {
  const text = String(requirement || "");
  if (!Array.isArray(attachments) || attachments.length === 0) return text;
  const fileBlocks = attachments
    .map(
      (f) =>
        `----- 附带文件：${f.name} ----\n${f.content}\n----- 文件结束 ----`,
    )
    .join("\n\n");
  return `${text}\n\n${ATTACHMENT_HEADER}\n\n${fileBlocks}`;
}

function scrollToBottom(messagesEl) {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(messagesEl, role, text, attachments) {
  const wrap = document.createElement("div");
  wrap.className =
    "builder-msg " + (role === "user" ? "builder-msg-user" : "builder-msg-bot");

  const content = document.createElement("div");
  content.className = "builder-msg-content";

  if (role === "user") {
    // 统一处理「可见文本 + 附带文件」：
    //   1) 实时发送时传入 attachments 数组
    //   2) 历史重现时传入合并后的字符串（含 ATTACHMENT_HEADER）
    let displayText = String(text || "");
    let fileNames = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      fileNames = attachments.map((f) => f.name);
    } else {
      const parsed = parseStoredUserContent(displayText);
      displayText = parsed.text;
      fileNames = parsed.fileNames;
    }
    if (fileNames.length > 0) {
      const trimmed = displayText.trim();
      if (trimmed) {
        const textEl = document.createElement("div");
        textEl.className = "builder-msg-user-text";
        textEl.textContent = trimmed;
        content.appendChild(textEl);
      }
      // 附件列表（SVG 图标，不使用 emoji）
      const list = document.createElement("div");
      list.className = "builder-msg-user-attach";
      for (const name of fileNames) {
        const item = document.createElement("div");
        item.className = "builder-msg-attachment";
        item.innerHTML =
          ICON_PAPERCLIP +
          '<span class="builder-msg-attachment-name">' +
          escapeHtml(name) +
          "</span>";
        list.appendChild(item);
      }
      content.appendChild(list);
    } else {
      content.textContent = displayText;
    }
    wrap.appendChild(content);
    wrap.appendChild(buildMessageActs(() => displayText));
  } else {
    // 机器人消息：头像 + 正文（Markdown，无底色）+ 复制
    const avatar = document.createElement("div");
    avatar.className = "builder-msg-avatar";
    avatar.innerHTML =
      '<img src="' + CONFIG.ASSETS.erisAvatar + '" alt="" />';
    const body = document.createElement("div");
    body.className = "builder-msg-body";
    content.classList.add("builder-md");
    content.innerHTML = renderMarkdown(text);
    enhanceMarkdownContainer(content);
    const raw = String(text || "");
    body.appendChild(content);
    body.appendChild(buildMessageActs(() => raw));
    wrap.appendChild(avatar);
    wrap.appendChild(body);
  }

  messagesEl.appendChild(wrap);
  scrollToBottom(messagesEl);
  return content;
}

/** 消息操作行（复制按钮，悬停浮现） */
function buildMessageActs(rawTextGetter) {
  const acts = document.createElement("div");
  acts.className = "builder-msg-acts";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = I18n.t("builder.copy");
  btn.innerHTML = icon("copy");
  btn.addEventListener("click", () => {
    copyTextToClipboard(rawTextGetter());
    btn.innerHTML = icon("check");
    setTimeout(() => (btn.innerHTML = icon("copy")), 1200);
  });
  acts.appendChild(btn);
  return acts;
}

function appendSystemMessage(messagesEl, text) {
  const div = document.createElement("div");
  div.className = "builder-system-msg";
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom(messagesEl);
}

/**
 * 渲染多问题表单卡片，返回 Promise<answers>，answers 为 {key: 回答}
 * 支持 multi: true 多选（可勾选多个选项，结果以「、」拼接）
 */
function renderQuestionForm(messagesEl, questions) {
  return new Promise((resolve) => {
    hideTyping(messagesEl);

    const card = document.createElement("div");
    card.className = "builder-question";

    const answers = {};
    const multiAnswers = {}; // key -> Set<option>
    let answeredCount = 0;

    const submitAll = document.createElement("button");
    submitAll.type = "button";
    submitAll.className = "btn btn-primary builder-question-submit-all";
    submitAll.textContent = I18n.t("builder.question.submitAll");
    submitAll.disabled = true;

    const updateSubmit = () => {
      submitAll.disabled = answeredCount < questions.length;
    };

    questions.forEach((q, idx) => {
      const block = document.createElement("div");
      block.className = "builder-question-block";
      if (q.multi) block.classList.add("builder-question-block-multi");

      const label = document.createElement("div");
      label.className = "builder-question-text";
      const multiTag = q.multi
        ? ' <span class="builder-question-multi-tag">' +
          escapeHtml(I18n.t("builder.question.multi")) +
          "</span>"
        : "";
      label.innerHTML = idx + 1 + ". " + renderMarkdown(q.question) + multiTag;
      block.appendChild(label);

      const optWrap = document.createElement("div");
      optWrap.className = "builder-question-options";

      const inputWrap = document.createElement("div");
      inputWrap.className = "builder-question-input-wrap";
      inputWrap.style.display = "none";
      const input = document.createElement("input");
      input.className = "builder-question-input";
      input.type = "text";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "btn btn-primary builder-question-submit";
      ok.textContent = I18n.t("builder.question.ok");
      inputWrap.appendChild(input);
      inputWrap.appendChild(ok);

      const setAnswer = (val) => {
        if (!(q.key in answers)) answeredCount++;
        answers[q.key] = val;
        updateSubmit();
      };

      const clearSelected = () => {
        optWrap
          .querySelectorAll(".builder-question-opt")
          .forEach((b) => b.classList.remove("selected"));
      };

      // —— 多选模式 ——
      if (q.multi) {
        multiAnswers[q.key] = new Set();
        let customValue = null; // 已保存的自定义答案；非 null 表示处于「自定义」模式

        // 自定义答案按钮（先创建，供选项点击时引用）
        const customBtn = document.createElement("button");
        customBtn.type = "button";
        customBtn.className = "builder-question-opt builder-question-custom";
        customBtn.textContent = I18n.t("builder.question.custom");

        // 根据当前状态重新计算 answers[q.key] 与 answeredCount
        const refresh = () => {
          const had = q.key in answers;
          let newVal = null;
          if (customValue) {
            newVal = customValue;
          } else {
            const selected = Array.from(multiAnswers[q.key]);
            if (selected.length > 0) newVal = selected.join("、");
          }
          if (newVal != null) {
            if (!had) answeredCount++;
            answers[q.key] = newVal;
          } else if (had) {
            delete answers[q.key];
            answeredCount--;
          }
          updateSubmit();
        };

        const resetMultiOptions = () => {
          optWrap
            .querySelectorAll(".builder-question-opt-multi")
            .forEach((b) => {
              b.classList.remove("selected");
              b.innerHTML = ICON_SQUARE + escapeHtml(b.dataset.opt || "");
            });
          multiAnswers[q.key].clear();
        };

        const resetCustomVisual = () => {
          customValue = null;
          customBtn.classList.remove("selected");
          customBtn.textContent = I18n.t("builder.question.custom");
          customBtn.style.fontStyle = "";
          inputWrap.style.display = "none";
        };

        q.options.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "builder-question-opt builder-question-opt-multi";
          btn.dataset.opt = opt;
          btn.innerHTML = ICON_SQUARE + escapeHtml(opt);
          btn.addEventListener("click", () => {
            if (multiAnswers[q.key].has(opt)) {
              multiAnswers[q.key].delete(opt);
              btn.classList.remove("selected");
              btn.innerHTML = ICON_SQUARE + escapeHtml(opt);
            } else {
              multiAnswers[q.key].add(opt);
              btn.classList.add("selected");
              btn.innerHTML = ICON_CHECK_SQUARE + escapeHtml(opt);
            }
            // 点击选项时退出自定义模式
            resetCustomVisual();
            refresh();
          });
          optWrap.appendChild(btn);
        });

        customBtn.addEventListener("click", () => {
          // 进入/重入自定义编辑：保留已保存的值，便于继续修改
          resetMultiOptions();
          customBtn.classList.add("selected");
          inputWrap.style.display = "flex";
          input.value = customValue || "";
          input.disabled = false;
          ok.disabled = false;
          input.focus();
          refresh();
        });
        // 阻止点击“确定”时输入框先失焦
        ok.addEventListener("mousedown", (e) => e.preventDefault());
        optWrap.appendChild(customBtn);

        ok.addEventListener("click", () => {
          const val = input.value.trim();
          if (!val) {
            input.focus();
            return;
          }
          customValue = val;
          customBtn.textContent =
            val.slice(0, 16) + (val.length > 16 ? "…" : "");
          customBtn.style.fontStyle = "normal";
          input.disabled = true;
          ok.disabled = true;
          refresh();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            ok.click();
          }
        });

        block.appendChild(optWrap);
        block.appendChild(inputWrap);
        card.appendChild(block);
        return;
      }

      // —— 单选模式（原有逻辑） ——
      let customValue = null; // 已保存的自定义答案
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "builder-question-opt";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          clearSelected();
          btn.classList.add("selected");
          inputWrap.style.display = "none";
          customValue = null; // 切回选项，清除自定义
          setAnswer(opt);
        });
        optWrap.appendChild(btn);
      });

      // 自定义答案
      const customBtn = document.createElement("button");
      customBtn.type = "button";
      customBtn.className = "builder-question-opt builder-question-custom";
      customBtn.textContent = I18n.t("builder.question.custom");
      customBtn.addEventListener("click", () => {
        clearSelected();
        customBtn.classList.add("selected");
        inputWrap.style.display = "flex";
        // 恢复上次的自定义值，便于继续修改
        input.value = customValue || "";
        input.disabled = false;
        ok.disabled = false;
        input.focus();
      });
      // 阻止点击“确定”时输入框先失焦
      ok.addEventListener("mousedown", (e) => e.preventDefault());
      optWrap.appendChild(customBtn);

      ok.addEventListener("click", () => {
        const val = input.value.trim();
        if (!val) {
          input.focus();
          return;
        }
        customValue = val;
        setAnswer(val);
        // 视觉反馈：自定义按钮显示已填写
        customBtn.textContent = val.slice(0, 16) + (val.length > 16 ? "…" : "");
        customBtn.style.fontStyle = "normal";
        input.disabled = true;
        ok.disabled = true;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ok.click();
        }
      });
      // 失焦时若有内容自动保存（点“确定”被 preventDefault 不会触发）
      input.addEventListener("blur", () => {
        if (input.disabled) return;
        const val = input.value.trim();
        if (!val) return;
        customValue = val;
        setAnswer(val);
        customBtn.textContent = val.slice(0, 16) + (val.length > 16 ? "…" : "");
        customBtn.style.fontStyle = "normal";
        input.disabled = true;
        ok.disabled = true;
      });

      block.appendChild(optWrap);
      block.appendChild(inputWrap);
      card.appendChild(block);
    });

    submitAll.addEventListener("click", () => {
      card.querySelectorAll("button").forEach((b) => (b.disabled = true));
      card.querySelectorAll("input").forEach((i) => (i.disabled = true));
      resolve(answers);
    });

    card.appendChild(submitAll);
    messagesEl.appendChild(card);
    scrollToBottom(messagesEl);
  });
}

function showTyping(messagesEl) {
  let t = messagesEl.querySelector("#builder-typing-indicator");
  if (t) return;
  t = document.createElement("div");
  t.className = "builder-typing";
  t.id = "builder-typing-indicator";
  t.innerHTML = "<span></span><span></span><span></span>";
  messagesEl.appendChild(t);
  scrollToBottom(messagesEl);
}

function hideTyping(messagesEl) {
  const t = messagesEl.querySelector("#builder-typing-indicator");
  if (t) t.remove();
}

/**
 * 统一确认弹窗（替代浏览器 confirm）
 */
/**
 * 确认弹窗。opts.checkboxLabel 传入时额外渲染一个复选框，
 * 返回值从 boolean 变为 {ok, checked}；不传时保持 boolean 兼容旧调用。
 */
function showConfirmModal(msg, opts) {
  return new Promise((resolve) => {
    const modal = $("builder-confirm-modal");
    const msgEl = $("builder-confirm-msg");
    const okBtn = $("builder-confirm-ok");
    const cancelBtn = $("builder-confirm-cancel");
    const useCheckbox = !!(opts && opts.checkboxLabel);
    if (!modal) {
      resolve(useCheckbox ? { ok: false, checked: false } : false);
      return;
    }
    if (msgEl) msgEl.textContent = msg;

    let chk = null;
    const oldChk = modal.querySelector(".builder-confirm-check");
    if (oldChk) oldChk.remove();
    if (useCheckbox) {
      const chkWrap = document.createElement("label");
      chkWrap.className = "builder-confirm-check";
      chk = document.createElement("input");
      chk.type = "checkbox";
      const span = document.createElement("span");
      span.textContent = opts.checkboxLabel;
      chkWrap.appendChild(chk);
      chkWrap.appendChild(span);
      const actions = modal.querySelector(".builder-confirm-actions");
      if (actions && actions.parentNode === modal) {
        modal.insertBefore(chkWrap, actions);
      } else {
        modal.appendChild(chkWrap);
      }
    }
    modal.style.display = "flex";

    const close = (result) => {
      modal.style.display = "none";
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      resolve(
        useCheckbox
          ? { ok: result, checked: !!(chk && chk.checked) }
          : result,
      );
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = (e) => {
      if (e.target === modal) close(false);
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
  });
}

function appendProgress(messagesEl, kind, html) {
  const wrap = document.createElement("div");
  wrap.className = "builder-progress";
  const item = document.createElement("div");
  item.className = "builder-progress-item " + kind;
  item.innerHTML = html;
  wrap.appendChild(item);
  messagesEl.appendChild(wrap);
  scrollToBottom(messagesEl);
  return wrap;
}

/**
 * 让某个 progress 条目可展开：折叠态只显示标题+摘要，展开后能看到
 * AI 请求的参数与完整返回。适用于检索、读文档、提问、读文件等工具。
 * @param {HTMLElement} wrap - appendProgress 返回的包裹元素
 * @param {object} args - AI 请求时传入的参数对象
 * @param {string} fullResult - 工具执行返回的全文
 */
function makeProgressExpandable(wrap, args, fullResult) {
  if (!wrap) return;
  if (wrap.dataset.expandable) return;
  const result = String(fullResult || "");
  const hasArgs =
    args &&
    typeof args === "object" &&
    !(
      Object.keys(args).length === 1 &&
      args.path &&
      args.content !== undefined
    );
  // 没有值得展开的内容时放弃
  if (result.trim().length <= 50 && !hasArgs) return;
  wrap.dataset.expandable = "1";
  wrap.classList.add("builder-progress-expandable");

  const item = wrap.querySelector(".builder-progress-item");
  if (!item) return;

  // 折叠箭头（右侧）
  const chevron = document.createElement("span");
  chevron.className = "builder-progress-chevron";
  chevron.innerHTML = ICON_CHEVRON_RIGHT;
  item.appendChild(chevron);

  // 构建详情内容 HTML
  let detailHtml = "";

  // 请求参数区
  if (hasArgs) {
    detailHtml += `<div class="builder-progress-detail-section">
      <div class="builder-progress-detail-title">${escapeHtml(I18n.t("builder.progress.request"))}</div>
      <div class="builder-progress-detail-content">${formatRequestDetail(args)}</div>
    </div>`;
  }

  // 返回结果区
  if (result.trim().length > 0) {
    detailHtml += `<div class="builder-progress-detail-section">
      <div class="builder-progress-detail-title">${escapeHtml(I18n.t("builder.progress.result"))}</div>`;
    // 结果用 <pre> 保持格式，但使用轻色背景
    detailHtml += `<pre class="builder-progress-detail-pre">${escapeHtml(result)}</pre>`;
    detailHtml += `</div>`;
  }

  // 详情区（默认隐藏）
  const detail = document.createElement("div");
  detail.className = "builder-progress-detail";
  detail.innerHTML = detailHtml;
  detail.style.display = "none";
  wrap.appendChild(detail);

  // 点击切换折叠
  item.addEventListener("click", () => {
    const open = detail.style.display !== "none";
    detail.style.display = open ? "none" : "block";
    chevron.innerHTML = open ? ICON_CHEVRON_RIGHT : ICON_CHEVRON_DOWN;
    wrap.classList.toggle("expanded", !open);
  });
}

/**
 * 将工具参数格式化为可读的 HTML（键值对列表）。
 * 对过长的值（如代码片段）进行截断。
 */
function formatRequestDetail(args) {
  if (!args || typeof args !== "object") return escapeHtml(String(args || ""));
  const lines = [];
  for (const [key, val] of Object.entries(args)) {
    const label = escapeHtml(key);
    let display;
    if (Array.isArray(val)) {
      // 数组：每个元素一行
      const items = val
        .map((v, i) => {
          if (typeof v === "object" && v !== null) {
            // 如 ask_question 的 questions 数组
            const parts = [];
            if (v.key) parts.push(`key: ${escapeHtml(String(v.key))}`);
            if (v.question) parts.push(`${escapeHtml(String(v.question))}`);
            if (Array.isArray(v.options) && v.options.length > 0)
              parts.push(
                `[${v.options
                  .map((o) => escapeHtml(normalizeOptionText(o)))
                  .join(", ")}]`,
              );
            if (v.multi)
              parts.push(
                "[" + escapeHtml(I18n.t("builder.question.multi")) + "]",
              );
            return parts.length > 0 ? i + 1 + ". " + parts.join("  ") : "";
          }
          return escapeHtml(String(v));
        })
        .filter((l) => l);
      if (items.length === 0) display = "[]";
      else display = items.join("<br>");
    } else if (typeof val === "object" && val !== null) {
      display = escapeHtml(JSON.stringify(val));
    } else if (typeof val === "boolean") {
      display = val ? "true" : "false";
    } else {
      let str = String(val || "");
      // 过长的值截断
      if (str.length > 300) str = str.slice(0, 300) + "…";
      display = escapeHtml(str);
    }
    lines.push(
      `<div class="builder-progress-detail-row"><span class="builder-progress-detail-key">${label}</span><span class="builder-progress-detail-val">${display}</span></div>`,
    );
  }
  return lines.join("");
}

function iconForTool(tool) {
  const map = {
    search_docs: "search",
    read_document: "book",
    write_file: "filePen",
    patch_file: "magic",
    read_file: "fileLines",
    delete_file: "trash",
    list_documents: "list",
    get_manifest: "folderOpen",
    finalize: "check",
    ask_question: "help",
    web_fetch: "globe",
    run_module: "play",
    exec_python: "terminal",
    install_packages: "box",
  };
  return icon(map[tool] || "wrench");
}

function kindForTool(tool) {
  if (tool === "search_docs") return "search";
  if (tool === "web_fetch") return "search";
  if (tool === "read_document") return "read";
  if (tool === "write_file") return "write";
  if (tool === "patch_file") return "write";
  if (tool === "delete_file") return "write";
  if (tool === "read_file") return "read";
  if (tool === "finalize") return "done";
  return "read";
}

function toolLabel(tool) {
  return I18n.t("builder.tool." + tool) || tool;
}

/** 把沙箱运行报告格式化为回传给 AI 的文本（超长截断） */
function formatInstanceReport(report) {
  const lines = [];
  lines.push(
    (report.ok ? "[OK] " : "[FAIL] ") +
      I18n.t(
        report.ok
          ? "builder.instance.report.ok"
          : "builder.instance.report.fail",
      ) +
      " · " +
      ((report.durationMs || 0) / 1000).toFixed(1) +
      "s" +
      (report.pkg ? " · " + report.pkg : ""),
  );
  const errors = (report.errors || []).map((e) => e.text).join("\n").trim();
  lines.push("\n=== " + I18n.t("builder.instance.report.errors") + " ===");
  lines.push(errors || I18n.t("builder.instance.report.none"));
  lines.push("\n=== " + I18n.t("builder.instance.report.sent") + " ===");
  if (report.sent && report.sent.length > 0) {
    for (const s of report.sent.slice(-20)) {
      lines.push(formatSentItem(s));
    }
  } else {
    lines.push(I18n.t("builder.instance.report.none"));
  }
  lines.push("\n=== " + I18n.t("builder.instance.report.logs") + " ===");
  const logs = (report.logs || []).map((l) => l.text).join("\n").trim();
  lines.push(logs || I18n.t("builder.instance.report.none"));
  let out = lines.join("\n");
  if (out.length > 4000) out = out.slice(0, 4000) + "\n…（过长已截断）";
  return out;
}

/** 把 MockAdapter 捕获的发送记录格式化为一行摘要 */
function formatSentItem(s) {
  try {
    const segs = Array.isArray(s.message) ? s.message : [];
    const parts = [];
    for (const seg of segs) {
      if (seg && seg.type === "text" && seg.data) parts.push(seg.data.text || "");
      else parts.push("[" + ((seg && seg.type) || "seg") + "]");
    }
    return "→ " + parts.join("");
  } catch (e) {
    try {
      return "→ " + JSON.stringify(s).slice(0, 200);
    } catch (_) {
      return "→ (unserializable)";
    }
  }
}

/**
 * 根据工具类型生成简洁的参数摘要，避免把 write_file 的整份 content 输出出来
 */
function formatToolDetail(tool, args) {
  try {
    if (tool === "write_file" || tool === "read_file" || tool === "delete_file")
      return args && args.path ? "path: " + args.path : "";
    if (tool === "patch_file")
      return args && args.path
        ? "path: " + args.path + (args.replace_all ? " (全部)" : "")
        : "";
    if (tool === "read_document")
      return args && args.doc_path ? "doc: " + args.doc_path : "";
    if (tool === "search_docs")
      return args && args.query ? "q: " + args.query : "";
    if (tool === "web_fetch")
      return args && args.url ? args.url : "";
    if (tool === "ask_question") {
      const n = Array.isArray(args && args.questions)
        ? args.questions.length
        : 0;
      return n ? n + " 个问题" : "";
    }
    if (tool === "run_module") {
      const n = Array.isArray(args && args.events) ? args.events.length : 0;
      return n ? n + " events" : "auto event";
    }
    if (tool === "exec_python") {
      return args && args.code ? String(args.code).slice(0, 60) : "";
    }
    if (tool === "install_packages") {
      return Array.isArray(args && args.packages)
        ? args.packages.join(", ")
        : "";
    }
  } catch (_) {}
  return "";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function updateFileList() {
  const list = $("builder-files-list");
  const countEl = $("builder-files-count");
  const dlBtn = $("builder-download");
  const viewAllBtn = $("builder-view-all");
  const sbBtn = $("builder-sandbox-btn");
  if (!list) return;
  const names = Object.keys(generatedFiles);
  list.innerHTML = "";
  if (countEl) countEl.textContent = String(names.length);
  if (names.length === 0) {
    const p = document.createElement("p");
    p.className = "builder-empty";
    p.textContent = I18n.t("builder.noFiles");
    list.appendChild(p);
    if (dlBtn) dlBtn.disabled = true;
    if (sbBtn) sbBtn.disabled = true;
    if (viewAllBtn) viewAllBtn.style.display = "none";
    return;
  }
  // 预览最多 3 个
  const preview = names.slice(0, 3);
  for (const n of preview) {
    const item = document.createElement("div");
    item.className = "builder-file-item";
    const size = formatSize((generatedFiles[n] || "").length);
    item.innerHTML =
      icon("fileCode") +
      "<span>" +
      escapeHtml(n) +
      '</span><span class="builder-file-size">' +
      size +
      "</span>";
    list.appendChild(item);
  }
  if (dlBtn) dlBtn.disabled = false;
  if (sbBtn) sbBtn.disabled = false;
  if (viewAllBtn) {
    if (names.length > 3) {
      viewAllBtn.style.display = "flex";
      const span = viewAllBtn.querySelector("span");
      if (span)
        span.textContent =
          I18n.t("builder.viewAll") + " (" + names.length + ")";
    } else {
      viewAllBtn.style.display = "none";
    }
  }
}

/* 文件查看模态窗 */
function openFilesModal() {
  const modal = $("builder-files-modal");
  if (!modal) return;
  modal.style.display = "flex";
  renderFilesModalList();
}

function closeFilesModal() {
  const modal = $("builder-files-modal");
  if (!modal) return;
  modal.style.display = "none";
}

function renderFilesModalList() {
  const body = $("builder-files-modal-body");
  const title = $("builder-files-modal-title");
  const back = $("builder-files-back");
  if (!body) return;
  if (title) title.textContent = I18n.t("builder.generatedFiles");
  if (back) back.style.display = "none";
  body.innerHTML = "";
  body.classList.remove("builder-ide-body");
  const names = Object.keys(generatedFiles);
  if (names.length === 0) {
    const p = document.createElement("p");
    p.className = "builder-empty";
    p.textContent = I18n.t("builder.noFiles");
    body.appendChild(p);
    return;
  }
  for (const n of names) {
    const item = document.createElement("div");
    item.className = "builder-modal-file-item";
    const size = formatSize((generatedFiles[n] || "").length);
    item.innerHTML =
      icon("fileCode") +
      '<span class="builder-file-name">' +
      escapeHtml(n) +
      "</span>" +
      '<span class="builder-file-size">' +
      size +
      "</span>";
    item.addEventListener("click", () => renderFileContent(n));
    body.appendChild(item);
  }
}

function renderFileContent(path) {
  const body = $("builder-files-modal-body");
  const title = $("builder-files-modal-title");
  const back = $("builder-files-back");
  if (!body) return;
  if (title) title.textContent = path;
  if (back) back.style.display = "inline-flex";
  const content = generatedFiles[path] || "";
  body.innerHTML =
    '<pre class="builder-code-view"><code>' +
    escapeHtml(content) +
    "</code></pre>";
  // 尝试语法高亮
  const code = body.querySelector("code");
  if (code && typeof Prism !== "undefined") {
    try {
      Prism.highlightElement(code);
    } catch (_) {}
  }
}

function bindFilesModal() {
  const viewAll = $("builder-view-all");
  const close = $("builder-files-close");
  const back = $("builder-files-back");
  const modal = $("builder-files-modal");
  if (viewAll) viewAll.addEventListener("click", openFilesModal);
  if (close) close.addEventListener("click", closeFilesModal);
  if (back) back.addEventListener("click", renderFilesModalList);
  if (modal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeFilesModal();
    });
}

function updateDocsStatus() {
  // 文档缓存卡片已移除，此函数不再需要
}

function updatePhaseToggle() {
  const toggle = $("builder-phase-toggle");
  if (!toggle) return;
  toggle.querySelectorAll(".builder-phase-seg").forEach((seg) => {
    seg.classList.toggle("active", seg.getAttribute("data-phase") === phase);
  });
  updateInputPlaceholder();
}

/**
 * 切换阶段（可由用户点击胶囊或 AI 的 confirm_start 触发）
 */
function switchPhase(newPhase, announce) {
  if (newPhase !== "plan" && newPhase !== "generate") return;
  if (newPhase === phase) return;
  phase = newPhase;
  // 切回规划阶段时重置 finalized，避免遗留“已完成”状态
  if (newPhase === "plan") finalized = false;
  updatePhaseToggle();
  updateFileList();
  if (announce && activeMessagesEl) {
    const msgKey = newPhase === "plan" ? "builder.phaseSwitchedToPlan" : "builder.phaseSwitched";
    appendSystemMessage(activeMessagesEl, I18n.t(msgKey));
  }
  persistCurrentSession();
}

function updateInputPlaceholder() {
  const input = $("builder-input");
  if (!input) return;
  input.placeholder = I18n.t(
    phase === "generate"
      ? "builder.inputPlaceholderGenerate"
      : "builder.inputPlaceholderPlan",
  );
}

/* ============================================================
 * 12. UI 事件绑定（setupBuilder）
 * ============================================================ */

let sending = false;

function setSending(v) {
  sending = v;
  const btn = $("builder-send");
  if (!btn) return;
  // 生成中按钮变「停止」图标；停止元素只注入一次
  let stopEl = btn.querySelector(".builder-send-stop");
  if (!stopEl) {
    stopEl = document.createElement("span");
    stopEl.className = "builder-send-stop";
    stopEl.innerHTML = icon("stop");
    btn.appendChild(stopEl);
  }
  btn.classList.toggle("sending", v);
  btn.title = v ? I18n.t("builder.stop") : "";
  // 生成中按钮保持可点击（充当停止键）
  btn.disabled = false;
}

function bindConfigInputs() {
  const b = settings();

  const urlInput = $("builder-api-url");
  const keyInput = $("builder-api-key");
  const modelInput = $("builder-model");
  const persistChk = $("builder-persist-key");
  const toggleEye = $("builder-toggle-key");

  if (urlInput) {
    urlInput.value = b.api_url || "";
    urlInput.addEventListener("input", () => {
      b.api_url = urlInput.value;
      persist();
    });
  }
  if (keyInput) {
    keyInput.value = b.api_key || "";
    keyInput.addEventListener("input", () => {
      b.api_key = keyInput.value;
      persist();
    });
  }
  if (modelInput) {
    modelInput.value = b.model || "";
    modelInput.addEventListener("input", () => {
      b.model = modelInput.value;
      persist();
    });
  }
  if (persistChk) {
    persistChk.checked = !!b.persistKey;
    persistChk.addEventListener("change", () => {
      b.persistKey = persistChk.checked;
      persist();
    });
  }

  // 联网请求开关（关闭时撤销已记住的授权）
  const webChk = $("builder-web-tool");
  if (webChk) {
    webChk.checked = b.webTool !== false;
    webChk.addEventListener("change", () => {
      b.webTool = webChk.checked;
      if (!webChk.checked) b.webToolConsent = false;
      persist();
    });
  }

  // OLED 纯黑模式
  const oledChk = $("builder-oled-toggle");
  if (oledChk) {
    oledChk.checked = isOledOn();
    oledChk.addEventListener("change", () => applyOledPreference(oledChk.checked));
  }

  // API Key 显示/隐藏
  if (toggleEye && keyInput) {
    const eyeSvg = icon("eye");
    const eyeOffSvg = icon("eyeOff");
    toggleEye.addEventListener("click", () => {
      if (keyInput.type === "password") {
        keyInput.type = "text";
        toggleEye.innerHTML = eyeOffSvg;
      } else {
        keyInput.type = "password";
        toggleEye.innerHTML = eyeSvg;
      }
    });
  }

  // 配置模态窗打开/关闭
  bindConfigModal();
}

function bindConfigModal() {
  const btn = $("builder-config-modal-btn");
  const drawer = $("builder-settings-drawer");
  const close = $("builder-settings-close");
  if (!btn || !drawer) return;
  btn.addEventListener("click", () => {
    drawer.classList.add("open");
    renderMcpServers();
    renderKnowledgeBaseInModal();
  });
  const hide = () => drawer.classList.remove("open");
  if (close) close.addEventListener("click", hide);
  // 遮罩层点击关闭抽屉
  const overlay = $("builder-settings-overlay");
  if (overlay) overlay.addEventListener("click", hide);
  // ESC 关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open")) hide();
  });
}

function bindDocsButtons() {
  // 文档缓存卡片已移除，此函数不再需要
}

function bindSendModeDropdown() {
  const btn = $("builder-send-mode-btn");
  const menu = $("builder-send-mode-menu");
  if (!btn || !menu) return;

  // 从配置恢复
  const b = settings();
  if (b.sendMode === "ctrlEnter") sendMode = "ctrlEnter";
  else sendMode = "enter";
  updateSendModeUI();

  // tag 嵌在提交按钮内，点击/键盘必须阻止表单提交
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("open");
  };
  btn.addEventListener("click", toggle);
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      toggle(e);
    }
  });
  document.addEventListener("click", (e) => {
    if (
      !menu.contains(e.target) &&
      e.target !== btn &&
      !btn.contains(e.target)
    ) {
      menu.classList.remove("open");
    }
  });
  menu.querySelectorAll(".builder-send-mode-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      sendMode =
        opt.getAttribute("data-mode") === "ctrlEnter" ? "ctrlEnter" : "enter";
      b.sendMode = sendMode;
      persist();
      updateSendModeUI();
      menu.classList.remove("open");
    });
  });
}

function updateSendModeUI() {
  const btn = $("builder-send-mode-btn");
  const menu = $("builder-send-mode-menu");
  if (btn) {
    const lbl = btn.querySelector(".builder-send-mode-label");
    if (lbl)
      lbl.textContent =
        sendMode === "ctrlEnter"
          ? I18n.t("builder.sendMode.ctrlEnter")
          : I18n.t("builder.sendMode.enter");
  }
  if (menu) {
    menu.querySelectorAll(".builder-send-mode-opt").forEach((opt) => {
      opt.classList.toggle(
        "active",
        opt.getAttribute("data-mode") === sendMode,
      );
    });
  }
}

function bindSessionIO() {
  const exportBtn = $("builder-export-session");
  const exportMenu = $("builder-export-menu");
  const importBtn = $("builder-import-session");
  const importFile = $("builder-import-file");

  // 导出下拉
  if (exportBtn && exportMenu) {
    exportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle("open");
    });
    exportMenu.querySelectorAll(".builder-export-opt").forEach((opt) => {
      opt.addEventListener("click", () => {
        const scope = opt.getAttribute("data-scope");
        exportMenu.classList.remove("open");
        exportSessions(scope);
      });
    });
    // 点击外部关闭
    document.addEventListener("click", (e) => {
      if (!exportMenu.classList.contains("open")) return;
      if (exportBtn.contains(e.target) || exportMenu.contains(e.target)) return;
      exportMenu.classList.remove("open");
    });
  }

  // 导入文件选择
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => {
      importFile.value = "";
      importFile.click();
    });
    importFile.addEventListener("change", async () => {
      const file = importFile.files && importFile.files[0];
      if (!file) return;
      await importSessionsFromFile(file);
    });
  }
}

function bindMobileDrawer() {
  const menuBtn = $("builder-mobile-menu");
  const overlay = $("builder-mobile-overlay");
  const panel = document.querySelector(".builder-sidebar");
  if (!menuBtn || !overlay || !panel) return;

  const open = () => {
    panel.classList.add("show");
    overlay.classList.add("show");
  };
  const close = () => {
    panel.classList.remove("show");
    overlay.classList.remove("show");
  };

  menuBtn.addEventListener("click", () => {
    if (panel.classList.contains("show")) close();
    else open();
  });
  overlay.addEventListener("click", close);

  // 移动端手势：在侧边栏上左滑关闭
  let touchStartX = 0;
  let touchStartY = 0;
  let tracking = false;
  panel.addEventListener(
    "touchstart",
    (e) => {
      if (!panel.classList.contains("show")) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      tracking = true;
    },
    { passive: true },
  );
  panel.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = Math.abs(t.clientY - touchStartY);
      // 水平左滑超过 56px 且纵向位移不 dominant 时关闭（不影响纵向滚动）
      if (dx < -56 && dy < 40) {
        tracking = false;
        close();
      }
    },
    { passive: true },
  );
  panel.addEventListener("touchend", () => (tracking = false), {
    passive: true,
  });
}

function bindChatActions() {
  const form = $("builder-form");
  const input = $("builder-input");
  const clearBtn = $("builder-clear");

  const send = async () => {
    if (sending) {
      // 生成中点击发送按钮 = 停止
      stopGeneration();
      return;
    }
    const text = ((input && input.value) || "").trim();
    // 没有文本且没有附件时不发送
    const hasUploads = pendingUploads.length > 0;
    if (!text && !hasUploads) return;

    const b = settings();
    if (!b.api_url || !b.api_key || !b.model) {
      // 未配置 → 自动打开设置抽屉，引导填写
      const drawer = $("builder-settings-drawer");
      if (drawer) {
        drawer.classList.add("open");
        renderMcpServers();
        renderKnowledgeBaseInModal();
        // 聚焦到第一个空的配置项
        setTimeout(() => {
          if (!b.api_url) {
            $("builder-api-url")?.focus();
          } else if (!b.api_key) {
            $("builder-api-key")?.focus();
          } else if (!b.model) {
            $("builder-model")?.focus();
          }
        }, 350);
      }
      showMessage(I18n.t("builder.error.noConfig"), "warning");
      return;
    }

    const messagesEl = $("builder-messages");
    activeMessagesEl = messagesEl;
    // 移除欢迎消息（整个气泡容器）
    const welcome = $("builder-welcome-msg");
    if (welcome) welcome.remove();
    updateEmptyState();

    // 文档检索由 MCP 负责，无需本地预加载提示

    // 阶段切换检测：规划阶段 → 用户发送「开始」 → 进入生成阶段
    if (phase === "plan" && isStartCommand(text)) {
      switchPhase("generate", true);
    }

    // 用户在已完成的会话里继续发送 → 重置 finalized，允许继续迭代
    if (finalized) {
      finalized = false;
      persistCurrentSession();
    }

    // 自动命名会话（首次发送时用首条消息）
    if (
      activeSessionId &&
      sessions[activeSessionId] &&
      sessions[activeSessionId].title === I18n.t("builder.newSession")
    ) {
      const titleBase = text || pendingUploads.map((f) => f.name).join("、");
      sessions[activeSessionId].title =
        titleBase.slice(0, 24) + (titleBase.length > 24 ? "…" : "");
      renderSessionList();
    }

    // 快照附件并清理输入（不污染可见输入框）
    const attachments = pendingUploads.slice();
    clearPendingUploads();

    // 显示用户消息：有附件时以 SVG 图标列出附件名（不使用 emoji）
    appendMessage(messagesEl, "user", text, attachments);
    input.value = "";
    if (input.style) input.style.height = "";
    setSending(true);
    showTyping(messagesEl);

    try {
      const ctx = {
        askQuestions: (qs) => renderQuestionForm(messagesEl, qs),
      };
      let currentProgressWrap = null; // 跟踪当前工具调用的进度条目（供展开详情）
      // 流式气泡状态（stream_start → delta… → stream_end）
      let liveMsgContent = null;
      let liveTextEl = null;
      let liveRaw = "";
      const liveReset = () => {
        liveMsgContent = null;
        liveTextEl = null;
        liveRaw = "";
      };
      await runGeneration(
        text,
        (event) => {
          hideTyping(messagesEl);
          if (event.type === "stream_start") {
            liveReset();
          } else if (event.type === "delta") {
            if (!liveMsgContent) {
              liveMsgContent = appendMessage(messagesEl, "bot", "");
              liveMsgContent.classList.add("streaming");
              liveTextEl = document.createElement("div");
              liveTextEl.className = "builder-msg-stream-text";
              liveMsgContent.appendChild(liveTextEl);
            }
            liveRaw += event.text || "";
            liveTextEl.textContent = liveRaw;
            scrollToBottom(messagesEl);
          } else if (event.type === "stream_end") {
            if (liveMsgContent) {
              if (liveRaw.trim()) {
                liveMsgContent.classList.remove("streaming");
                liveMsgContent.innerHTML = renderMarkdown(liveRaw);
                enhanceMarkdownContainer(liveMsgContent);
              } else {
                const wrap = liveMsgContent.closest(".builder-msg");
                if (wrap) wrap.remove();
              }
              liveReset();
            }
            if (!event.aborted) showTyping(messagesEl);
          } else if (event.type === "aborted") {
            appendSystemMessage(messagesEl, I18n.t("builder.stopped"));
          } else if (event.type === "tool") {
            if (event.tool === "ask_question") {
              // 问题表单由工具内部渲染，不重复显示进度行
            } else {
              const label = toolLabel(event.tool);
              const detail = escapeHtml(
                formatToolDetail(event.tool, event.args),
              );
              const isWrite = event.tool === "write_file";
              // 写入文件：添加实时动画标记
              let extraHtml = "";
              if (isWrite) {
                extraHtml =
                  '<span class="builder-progress-writing">' +
                  escapeHtml(I18n.t("builder.writing")) +
                  "</span>";
              }
              currentProgressWrap = appendProgress(
                messagesEl,
                kindForTool(event.tool),
                iconForTool(event.tool) +
                  " " +
                  label +
                  (detail ? " <code>" + detail + "</code>" : "") +
                  extraHtml,
              );
              // 存储请求参数供展开详情（write_file 内容太长不存）
              if (
                event.tool !== "write_file" &&
                event.args &&
                typeof event.args === "object"
              ) {
                currentProgressWrap.storedArgs = event.args;
              }
              showTyping(messagesEl);
            }
          } else if (event.type === "tool_result") {
            if (event.tool === "ask_question") {
              // 用户已作答，显示打字指示等待下一轮
              showTyping(messagesEl);
            } else {
              const wrap = currentProgressWrap;
              const last = wrap && wrap.querySelector(".builder-progress-item");
              if (last) {
                if (event.tool === "write_file") {
                  // 写入完成：替换动画标记为完成状态 + 文件大小
                  const writingEl = last.querySelector(
                    ".builder-progress-writing",
                  );
                  if (writingEl) {
                    const sizeMatch = String(event.result || "").match(
                      /（(\d+) 字符）/,
                    );
                    const sizeText = sizeMatch ? sizeMatch[1] + " chars" : "";
                    writingEl.outerHTML =
                      '<span class="builder-progress-result">' +
                      "\u2713 " +
                      escapeHtml(
                        sizeText || String(event.result || "").slice(0, 60),
                      ) +
                      "</span>";
                  }
                  last.classList.add("done");
                }
              }
              // 可点开查看完整返回（结果仅在展开时显示，不显示在折叠行）
              if (wrap) {
                makeProgressExpandable(
                  wrap,
                  wrap.storedArgs || null,
                  event.result,
                );
              }
            }
            if (event.tool === "write_file" || event.tool === "finalize") {
              updateFileList();
            }
          }
        },
        ctx,
        attachments,
      );
      hideTyping(messagesEl);
      if (finalized) {
        appendProgress(
          messagesEl,
          "done",
          icon("check") + " " + escapeHtml(I18n.t("builder.done")),
        );
      }
    } catch (e) {
      hideTyping(messagesEl);
      appendMessage(messagesEl, "bot", "**" + escapeHtml(e.message) + "**");
    } finally {
      hideTyping(messagesEl);
      setSending(false);
      updateFileList();
      persistCurrentSession();
      renderSessionList();
    }
  };

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      send();
    });
  }
  if (input) {
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(140, input.scrollHeight) + "px";
    });
    // 根据 sendMode 决定发送/换行键位
    input.addEventListener("keydown", (e) => {
      // 生成中按 Esc 停止
      if (e.key === "Escape" && sending) {
        e.preventDefault();
        stopGeneration();
        return;
      }
      if (e.key !== "Enter") return;
      if (sending) return; // 生成中 Enter 不触发发送（停止请用按钮或 Esc）
      const isCtrl = e.ctrlKey || e.metaKey;
      if (sendMode === "ctrlEnter") {
        // Ctrl+Enter 发送，纯 Enter 换行
        if (isCtrl) {
          e.preventDefault();
          send();
        }
        // 否则放行，浏览器默认插入换行
      } else {
        // 默认：Enter 发送，Ctrl+Enter 换行
        if (isCtrl) {
          // 手动插入换行
          e.preventDefault();
          const s = input.selectionStart;
          const en = input.selectionEnd;
          input.value = input.value.slice(0, s) + "\n" + input.value.slice(en);
          input.selectionStart = input.selectionEnd = s + 1;
          input.dispatchEvent(new Event("input"));
        } else if (!e.shiftKey) {
          e.preventDefault();
          send();
        }
      }
    });
  }

  // 发送模式下拉
  bindSendModeDropdown();

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      const ok = await showConfirmModal(I18n.t("builder.error.clearConfirm"));
      if (!ok) return;
      const messagesEl = $("builder-messages");
      messagesEl.innerHTML = "";
      // 重新添加欢迎消息
      messagesEl.appendChild(buildWelcomeMessageEl());
      renderWelcome();
      updateEmptyState();
      resetAll();
      clearPendingUploads();
      updateFileList();
    });
  }

  const dlBtn = $("builder-download");
  if (dlBtn) dlBtn.addEventListener("click", downloadZip);

  bindFilesModal();
  bindUploadButton();
}

/* ============================================================
 * 13. MCP 预热（可选）
 * ============================================================ */

async function autoLoadDocs() {
  // 后台预热 MCP 连接（非阻塞，首次工具调用时也会自动初始化）
  MCP.ensureInitialized().catch((e) => {
    console.warn("MCP 预热失败（将在首次工具调用时重试）:", e);
  });
}

/* ============================================================
 * 14. 欢迎消息渲染
 * ============================================================ */

/** 构建欢迎消息的 DOM 结构（空会话时显示） */
function buildWelcomeMessageEl() {
  const msg = document.createElement("div");
  msg.className = "builder-msg builder-msg-bot";
  msg.id = "builder-welcome-msg";
  const avatar = document.createElement("div");
  avatar.className = "builder-msg-avatar";
  avatar.innerHTML =
    '<img src="' + CONFIG.ASSETS.erisAvatar + '" alt="" />';
  const body = document.createElement("div");
  body.className = "builder-msg-body";
  const content = document.createElement("div");
  content.className = "builder-msg-content builder-md";
  content.id = "builder-welcome";
  body.appendChild(content);
  msg.appendChild(avatar);
  msg.appendChild(body);
  return msg;
}

/** 渲染欢迎页：居中吉祥物 + 标题 + 副标题 + 建议提问 chips */
function renderWelcome() {
  const el = $("builder-welcome");
  if (!el) return;
  el.innerHTML = "";
  const hero = document.createElement("div");
  hero.className = "builder-welcome-hero";

  const ic = document.createElement("div");
  ic.className = "builder-welcome-hero-icon";
  ic.innerHTML = BOT_FACE_SVG;

  const title = document.createElement("h2");
  title.className = "builder-welcome-title";
  title.textContent = I18n.t("builder.welcomeTitle");

  const sub = document.createElement("p");
  sub.className = "builder-welcome-subtitle";
  sub.textContent = I18n.t("builder.welcomeSubtitle");

  const tipsWrap = document.createElement("div");
  tipsWrap.className = "builder-welcome-tips";
  for (const key of ["builder.tip1", "builder.tip2", "builder.tip3", "builder.tip4"]) {
    const tip = I18n.t(key);
    if (!tip || tip === key) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "builder-welcome-tip";
    chip.textContent = tip;
    chip.addEventListener("click", () => {
      const input = $("builder-input");
      if (input) {
        input.value = tip;
        input.focus();
        input.dispatchEvent(new Event("input"));
      }
    });
    tipsWrap.appendChild(chip);
  }

  hero.appendChild(ic);
  hero.appendChild(title);
  hero.appendChild(sub);
  hero.appendChild(tipsWrap);
  el.appendChild(hero);
}

/* ============================================================
 * 15. 会话历史（本地持久化）
 * ============================================================ */

const SESSIONS_KEY = "erispulse-builder-sessions";
let sessions = {}; // id -> session
let activeSessionId = null;

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    sessions = data.sessions || {};
    activeSessionId = data.activeId || null;
  } catch (e) {
    sessions = {};
    activeSessionId = null;
  }
}

function saveSessions() {
  try {
    localStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify({ sessions: sessions, activeId: activeSessionId }),
    );
  } catch (e) {
    console.warn("save sessions failed", e);
  }
}

function applySessionToMemory(s) {
  var raw = Array.isArray(s.conversation) ? s.conversation : [];
  // 迁移旧版会话（用户消息在末尾 → 用户消息在对应回复前方）
  var migrated = [];
  var buffer = [];
  for (var i = 0; i < raw.length; i++) {
    if (raw[i].role === "user") {
      migrated.push(raw[i]);
      migrated.push.apply(migrated, buffer);
      buffer = [];
    } else {
      buffer.push(raw[i]);
    }
  }
  migrated.push.apply(migrated, buffer);
  conversation = migrated;
  generatedFiles = { ...(s.generatedFiles || {}) };
  phase = s.phase === "generate" ? "generate" : "plan";
  finalized = !!s.finalized;
}

function persistCurrentSession() {
  if (!activeSessionId || !sessions[activeSessionId]) return;
  const s = sessions[activeSessionId];
  s.conversation = conversation;
  s.generatedFiles = { ...generatedFiles };
  s.phase = phase;
  s.finalized = finalized;
  s.updatedAt = Date.now();
  saveSessions();
}

/* ============================================================
 * 文件历史 / 撤销重做
 * ============================================================ */

let fileUndoStack = []; // 每项: { files: {...} }
let fileRedoStack = [];

/**
 * 在文件变更前快照当前状态（推入 undo 栈，清空 redo）
 */
function pushFileSnapshot() {
  fileUndoStack.push({ files: { ...generatedFiles } });
  fileRedoStack = [];
  // 限制历史长度
  if (fileUndoStack.length > 50) fileUndoStack.shift();
  updateUndoRedoUI();
}

function undoFiles() {
  if (fileUndoStack.length === 0) return;
  const snap = fileUndoStack.pop();
  fileRedoStack.push({ files: { ...generatedFiles } });
  generatedFiles = snap.files;
  finalized = false;
  persistCurrentSession();
  updateFileList();
  updateUndoRedoUI();
  showMessage(I18n.t("builder.undoDone"), "success");
}

function redoFiles() {
  if (fileRedoStack.length === 0) return;
  const snap = fileRedoStack.pop();
  fileUndoStack.push({ files: { ...generatedFiles } });
  generatedFiles = snap.files;
  persistCurrentSession();
  updateFileList();
  updateUndoRedoUI();
  showMessage(I18n.t("builder.redoDone"), "success");
}

function updateUndoRedoUI() {
  const undoBtn = $("builder-undo");
  const redoBtn = $("builder-redo");
  if (undoBtn) undoBtn.disabled = fileUndoStack.length === 0;
  if (redoBtn) redoBtn.disabled = fileRedoStack.length === 0;
}

function resetUndoRedo() {
  fileUndoStack = [];
  fileRedoStack = [];
  updateUndoRedoUI();
}

/* ============================================================
 * 知识库（用户自定义上下文）
 * ============================================================ */

/**
 * 添加一条知识库条目（存储在当前会话中）
 */
function addKnowledgeEntry(title, content) {
  if (!activeSessionId || !sessions[activeSessionId]) return;
  const s = sessions[activeSessionId];
  if (!s.knowledgeBase) s.knowledgeBase = [];
  s.knowledgeBase.push({
    id: "kb_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
    title: title || ("知识" + (s.knowledgeBase.length + 1)),
    content: content || "",
    timestamp: Date.now(),
  });
  saveSessions();
}

function removeKnowledgeEntry(kbId) {
  if (!activeSessionId || !sessions[activeSessionId]) return;
  const s = sessions[activeSessionId];
  if (!s.knowledgeBase) return;
  s.knowledgeBase = s.knowledgeBase.filter((k) => k.id !== kbId);
  saveSessions();
}

/**
 * 构建知识库注入文本（并入系统提示词）
 */
function knowledgeBaseSection() {
  if (!activeSessionId || !sessions[activeSessionId]) return "";
  const s = sessions[activeSessionId];
  const kb = s.knowledgeBase || [];
  if (kb.length === 0) return "";
  const blocks = kb
    .map(
      (k) =>
        "### " +
        k.title +
        "\n" +
        String(k.content || "").slice(0, 4000),
    )
    .join("\n\n---\n\n");
  return (
    "\n\n【用户知识库】\n以下是用户提供的参考知识，优先级高于你的固有认知：\n\n" +
    blocks
  );
}

function renderKnowledgeBase() {
  // 知识库已移至配置模态窗，此函数不再使用
}

/**
 * 导出会话为 JSON 文件
 * @param {"current"|"all"} scope
 */
function exportSessions(scope) {
  // 先同步当前会话到 sessions 对象
  persistCurrentSession();

  let out = {};
  if (scope === "current") {
    if (!activeSessionId || !sessions[activeSessionId]) {
      showMessage(I18n.t("builder.error.noActiveSession"), "warning");
      return;
    }
    out[activeSessionId] = sessions[activeSessionId];
  } else {
    out = { ...sessions };
  }

  const keys = Object.keys(out);
  if (keys.length === 0) {
    showMessage(I18n.t("builder.noSessions"), "warning");
    return;
  }

  const payload = {
    type: "erispulse-builder-sessions",
    version: 1,
    exportedAt: Date.now(),
    sessions: out,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date();
  const stamp =
    ts.getFullYear() +
    String(ts.getMonth() + 1).padStart(2, "0") +
    String(ts.getDate()).padStart(2, "0") +
    "-" +
    String(ts.getHours()).padStart(2, "0") +
    String(ts.getMinutes()).padStart(2, "0");
  a.download =
    (scope === "current" ? "erispulse-session" : "erispulse-sessions") +
    "-" +
    stamp +
    ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 从文件导入会话（合并不覆盖已有数据）
 * @param {File} file
 */
async function importSessionsFromFile(file) {
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch (e) {
    showMessage(I18n.t("builder.error.importRead"), "error");
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    showMessage(I18n.t("builder.error.importParse"), "error");
    return;
  }

  // 兼容两种结构：带信封 / 裸 sessions 对象 / 单个 session
  let incoming = {};
  if (data && data.type === "erispulse-builder-sessions" && data.sessions) {
    incoming = data.sessions;
  } else if (data && typeof data === "object" && data.conversation) {
    // 单个会话对象
    incoming = { [data.id || "imported"]: data };
  } else if (
    data &&
    typeof data === "object" &&
    data.sessions &&
    typeof data.sessions === "object"
  ) {
    incoming = data.sessions;
  } else {
    showMessage(I18n.t("builder.error.importFormat"), "error");
    return;
  }

  const now = Date.now();
  let added = 0;
  for (const [oldId, raw] of Object.entries(incoming)) {
    if (!raw || typeof raw !== "object") continue;
    const newId =
      "s_" + now + "_" + added + "_" + Math.random().toString(36).slice(2, 7);
    const s = {
      id: newId,
      title: raw.title || I18n.t("builder.newSession"),
      conversation: Array.isArray(raw.conversation) ? raw.conversation : [],
      generatedFiles: raw.generatedFiles || {},
      phase: raw.phase === "generate" ? "generate" : "plan",
      finalized: !!raw.finalized,
      createdAt: raw.createdAt || now,
      updatedAt: now,
    };
    sessions[newId] = s;
    added++;
  }

  if (added === 0) {
    showMessage(I18n.t("builder.error.importEmpty"), "warning");
    return;
  }

  // 切换到最近导入的会话
  saveSessions();
  renderSessionList();
  const lastImportedId = Object.keys(sessions)
    .filter((id) => sessions[id].updatedAt === now)
    .sort((a, b) => (sessions[a].createdAt || 0) - (sessions[b].createdAt || 0))
    .pop();
  if (lastImportedId) switchSession(lastImportedId);
  showMessage(I18n.t("builder.importSuccess", { n: added }), "success");
}

function newSession() {
  const id = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const s = {
    id: id,
    title: I18n.t("builder.newSession"),
    conversation: [],
    generatedFiles: {},
    phase: "plan",
    finalized: false,
    knowledgeBase: [], // [{id, title, content, timestamp}]
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions[id] = s;
  activeSessionId = id;
  applySessionToMemory(s);
  saveSessions();
  const messagesEl = $("builder-messages");
  renderHistory(messagesEl);
  updateFileList();
  updatePhaseToggle();
  resetUndoRedo();
  renderSessionList();
}

function switchSession(id) {
  const s = sessions[id];
  if (!s) return;
  activeSessionId = id;
  applySessionToMemory(s);
  s.conversation = conversation; // 保留迁移结果
  saveSessions();
  const messagesEl = $("builder-messages");
  activeMessagesEl = messagesEl;
  renderHistory(messagesEl);
  updateFileList();
  updatePhaseToggle();
  resetUndoRedo();
  renderSessionList();
  // 切换会话时清除未发送的附件
  clearPendingUploads();
}

function deleteSession(id) {
  delete sessions[id];
  if (activeSessionId === id) {
    const ids = Object.keys(sessions);
    if (ids.length) {
      switchSession(ids[0]);
    } else {
      newSession();
    }
  } else {
    saveSessions();
    renderSessionList();
  }
}

async function clearAllSessions() {
  const ok = await showConfirmModal(I18n.t("builder.clearAllConfirm"));
  if (!ok) return;
  sessions = {};
  saveSessions();
  newSession();
}

const SESSION_GROUP_ORDER = ["today", "yesterday", "withinWeek", "earlier"];

function sessionGroupKey(ts) {
  const DAY = 86400000;
  const startOfDay = (x) => {
    const d = new Date(x);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diff = Math.floor(
    (startOfDay(Date.now()) - startOfDay(ts || 0)) / DAY,
  );
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "withinWeek";
  return "earlier";
}

function startSessionRename(item, titleSpan, id) {
  const current = (sessions[id] && sessions[id].title) || "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "builder-session-rename-input";
  input.value = current;
  titleSpan.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const val = input.value.trim();
    if (val && sessions[id]) {
      sessions[id].title = val;
      saveSessions();
    }
    renderSessionList();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    } else if (e.key === "Escape") {
      input.value = current;
      input.blur();
    }
  });
  input.addEventListener("blur", commit);
  input.addEventListener("click", (e) => e.stopPropagation());
}

function renderSessionList() {
  const list = $("builder-sessions-list");
  if (!list) return;
  list.innerHTML = "";
  if (Object.keys(sessions).length === 0) {
    const p = document.createElement("p");
    p.className = "builder-empty";
    p.textContent = I18n.t("builder.noSessions");
    list.appendChild(p);
    return;
  }
  // 按更新时间倒序，再按「今天 / 昨天 / 7 天内 / 更早」分组
  const ids = Object.keys(sessions).sort(
    (a, b) => (sessions[b].updatedAt || 0) - (sessions[a].updatedAt || 0),
  );
  const groups = {};
  for (const id of ids) {
    const g = sessionGroupKey(sessions[id].updatedAt);
    (groups[g] = groups[g] || []).push(id);
  }
  for (const g of SESSION_GROUP_ORDER) {
    const gIds = groups[g];
    if (!gIds || gIds.length === 0) continue;
    const header = document.createElement("div");
    header.className = "builder-session-group";
    header.textContent = I18n.t("builder.session." + g);
    list.appendChild(header);
    for (const id of gIds) {
      const s = sessions[id];
      const item = document.createElement("div");
      item.className =
        "builder-session-item" + (id === activeSessionId ? " active" : "");
      item.dataset.id = id;
      const ic = document.createElement("span");
      ic.innerHTML = icon("message");
      const title = document.createElement("span");
      title.className = "builder-session-title";
      title.textContent = s.title || I18n.t("builder.newSession");
      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "builder-session-rename";
      rename.title = I18n.t("builder.renameSession");
      rename.innerHTML = icon("pen");
      rename.addEventListener("click", (e) => {
        e.stopPropagation();
        startSessionRename(item, title, id);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "builder-session-del";
      del.innerHTML = ICON_X;
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await showConfirmModal(
          I18n.t("builder.deleteSessionConfirm"),
        );
        if (ok) deleteSession(id);
      });
      item.addEventListener("click", () => switchSession(id));
      item.appendChild(ic.firstChild);
      item.appendChild(title);
      item.appendChild(rename);
      item.appendChild(del);
      list.appendChild(item);
    }
  }
}

/* ---------- 主题（auto / light / dark 三态 + OLED 纯黑） ---------- */

function getThemePreference() {
  try {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || "auto";
  } catch (e) {
    return "auto";
  }
}

function applyThemePreference(pref) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, pref);
  } catch (e) {}
  if (pref === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (pref === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    // auto：交给 prefers-color-scheme 媒体查询
    document.documentElement.removeAttribute("data-theme");
  }
}

function applyOledPreference(on) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.OLED, on ? "on" : "off");
  } catch (e) {}
  if (on) document.documentElement.setAttribute("data-oled", "on");
  else document.documentElement.removeAttribute("data-oled");
}

function isOledOn() {
  try {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.OLED) === "on";
  } catch (e) {
    return false;
  }
}

function bindThemeToggle() {
  const themeBtn = $("builder-theme-toggle");
  if (!themeBtn) return;
  const applyIcon = () => {
    const pref = getThemePreference();
    const key = pref === "dark" ? "moon" : pref === "light" ? "sun" : "autoTheme";
    themeBtn.innerHTML = icon(key);
    themeBtn.title = I18n.t("builder.theme." + pref) || pref;
  };
  applyIcon();
  themeBtn.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    const cur = getThemePreference();
    const next = order[(order.indexOf(cur) + 1) % order.length] || "auto";
    applyThemePreference(next);
    applyIcon();
    showMessage(I18n.t("builder.theme." + next) || next, "info");
  });
  // auto 模式下跟随系统切换
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getThemePreference() === "auto") {
        document.documentElement.removeAttribute("data-theme");
      }
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
}

/**
 * 空会话态管理：欢迎消息存在时聊天区进入 hero 居中态
 */
function updateEmptyState() {
  const chat = document.querySelector(".builder-chat");
  if (!chat) return;
  chat.classList.toggle("is-empty", !!$("builder-welcome-msg"));
}

/**
 * 根据当前会话历史重建对话区（切换会话 / 新建会话时调用）
 */
function renderHistory(messagesEl) {
  messagesEl.innerHTML = "";

  // 仅空会话时显示欢迎消息
  if (!conversation.length) {
    messagesEl.appendChild(buildWelcomeMessageEl());
    renderWelcome();
  }

  let progressMap = {}; // call_id → progress wrap DOM
  for (const msg of conversation) {
    if (msg.role === "user") {
      appendMessage(messagesEl, "user", msg.content || "");
      progressMap = {};
    } else if (msg.role === "assistant") {
      if (msg.content && msg.content.trim()) {
        appendMessage(messagesEl, "bot", msg.content);
      }
      if (msg.tool_calls && msg.tool_calls.length) {
        for (const call of msg.tool_calls) {
          const fn = (call.function && call.function.name) || "";
          let args = {};
          try {
            args = call.function.arguments
              ? JSON.parse(call.function.arguments)
              : {};
          } catch (_) {
            args = {};
          }
          const detail = escapeHtml(formatToolDetail(fn, args));
          const wrap = appendProgress(
            messagesEl,
            kindForTool(fn),
            iconForTool(fn) +
              " " +
              toolLabel(fn) +
              (detail ? " <code>" + detail + "</code>" : ""),
          );
          // 存储请求参数供展开详情
          if (fn !== "write_file" && Object.keys(args).length > 0) {
            wrap.storedArgs = args;
          }
          progressMap[call.id || ""] = wrap;
        }
      }
    } else if (msg.role === "tool") {
      const wrap =
        progressMap[msg.tool_call_id || ""] || Object.values(progressMap)[0];
      const target = wrap && wrap.querySelector(".builder-progress-item");
      if (target) {
        if (target.classList.contains("write")) {
          // 写入类工具：显示完成标记
          target.classList.add("done");
          const writingEl = target.querySelector(".builder-progress-writing");
          if (writingEl) {
            const sizeMatch = String(msg.content || "").match(/（(\d+) 字符）/);
            const sizeText = sizeMatch
              ? "\u2713 " + sizeMatch[1] + " chars"
              : "";
            writingEl.outerHTML =
              '<span class="builder-progress-result">' +
              escapeHtml(sizeText || String(msg.content || "").slice(0, 60)) +
              "</span>";
          }
        }
      }
      // 历史重现时同样只显示请求，结果仅在展开时可见
      if (wrap) {
        makeProgressExpandable(wrap, wrap.storedArgs || null, msg.content);
      }
    }
  }
  if (finalized) {
    appendProgress(
      messagesEl,
      "done",
      icon("check") + " " + escapeHtml(I18n.t("builder.done")),
    );
  }
  updateEmptyState();
  scrollToBottom(messagesEl);
}

/* ============================================================
 * 16. 用户文件上传（仅常见文本类型，随下一条消息拼接进上下文）
 * ============================================================ */

/**
 * 判断文件是否为可解析的文本类型（依据扩展名 + MIME 提示）
 */
function isTextUpload(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.split(".").pop() || "";
  if (UPLOAD_TEXT_EXTS.includes(ext)) return true;
  // 没有「常见」扩展名时，看 MIME 是否以 text/ 或 application/json 等开头
  const mime = (file.type || "").toLowerCase();
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/x-yaml"
  ) {
    return true;
  }
  return false;
}

/**
 * 以文本方式读取文件
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("read error"));
    r.readAsText(file);
  });
}

/**
 * 处理用户选择的文件：校验类型与大小，逐个读取后加入 pendingUploads
 */
async function handleUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  let added = 0;
  for (const file of files) {
    if (!isTextUpload(file)) {
      showMessage(
        I18n.t("builder.upload.unsupported").replace("{name}", file.name),
        "warning",
      );
      continue;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      showMessage(
        I18n.t("builder.upload.tooLarge")
          .replace("{name}", file.name)
          .replace("{max}", Math.round(UPLOAD_MAX_BYTES / 1024) + "KB"),
        "warning",
      );
      continue;
    }
    try {
      const content = await readFileAsText(file);
      pendingUploads.push({
        name: file.name,
        content,
        size: file.size,
      });
      added++;
    } catch (e) {
      showMessage(
        I18n.t("builder.upload.readFail").replace("{name}", file.name),
        "error",
      );
    }
  }
  if (added > 0) renderUploadChips();
}

/**
 * 渲染输入框上方的「待发送附件」chip 列表
 */
function renderUploadChips() {
  const wrap = $("builder-upload-chips");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (pendingUploads.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "flex";
  pendingUploads.forEach((f, idx) => {
    const chip = document.createElement("div");
    chip.className = "builder-upload-chip";
    chip.innerHTML =
      ICON_PAPERCLIP +
      '<span class="builder-upload-chip-name">' +
      escapeHtml(f.name) +
      "</span>" +
      '<span class="builder-upload-chip-size">' +
      formatSize(f.size) +
      "</span>" +
      '<button type="button" class="builder-upload-chip-remove" aria-label="remove">' +
      ICON_X +
      "</button>";
    chip
      .querySelector(".builder-upload-chip-remove")
      .addEventListener("click", () => {
        pendingUploads.splice(idx, 1);
        renderUploadChips();
      });
    wrap.appendChild(chip);
  });
}

function clearPendingUploads() {
  pendingUploads = [];
  renderUploadChips();
}

/**
 * 绑定上传按钮 + 隐藏的 file input
 */
function bindUploadButton() {
  const btn = $("builder-upload-btn");
  const fileInput = $("builder-upload-input");
  if (!btn || !fileInput) return;
  btn.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    await handleUploadFiles(fileInput.files);
    fileInput.value = "";
  });
  // 支持拖拽到输入区
  const inputBar = document.querySelector(".builder-input-bar");
  if (inputBar && !inputBar.dataset.uploadBound) {
    inputBar.dataset.uploadBound = "1";
    inputBar.addEventListener("dragover", (e) => {
      e.preventDefault();
      inputBar.classList.add("builder-drag-over");
    });
    inputBar.addEventListener("dragleave", () => {
      inputBar.classList.remove("builder-drag-over");
    });
    inputBar.addEventListener("drop", async (e) => {
      e.preventDefault();
      inputBar.classList.remove("builder-drag-over");
      if (e.dataTransfer && e.dataTransfer.files) {
        await handleUploadFiles(e.dataTransfer.files);
      }
    });
  }
  // 粘贴文本文件（部分浏览器支持）
  const inputEl = $("builder-input");
  if (inputEl && !inputEl.dataset.pasteBound) {
    inputEl.dataset.pasteBound = "1";
    inputEl.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleUploadFiles(files);
      }
    });
  }
}

/* ============================================================
 * 17.5 ErisPulse 实例控制台（浏览器内沙箱面板）+ 状态 chip
 * ============================================================ */

let sandboxPanelBound = false;

function instanceStateLabel() {
  return (
    I18n.t("builder.instance.state." + Sandbox.state) || Sandbox.state
  );
}

/** 侧边栏「实例控制台」按钮：文字反映状态，光晕由 data-state 驱动（CSS） */
function updateSandboxButton() {
  const btn = $("builder-sandbox-btn");
  if (!btn) return;
  btn.setAttribute("data-state", Sandbox.state);
  const span = btn.querySelector("span");
  if (!span) return;
  let label = I18n.t("builder.instance.state." + Sandbox.state);
  if (!label || label.indexOf("builder.instance.") === 0) {
    label = I18n.t("builder.instance.openPanel");
  }
  span.textContent = label;
  btn.title = Sandbox.stageText || I18n.t("builder.instance.chipTitle");
}

/** 控制台面板的状态区与按钮可用性 */
function updateSandboxPanelStatus() {
  const status = $("builder-sb-status");
  const stateText = $("builder-sb-state-text");
  const stageText = $("builder-sb-stage-text");
  if (status) status.setAttribute("data-state", Sandbox.state);
  if (stateText) stateText.textContent = instanceStateLabel();
  if (stageText) stageText.textContent = Sandbox.stageText || "";
  const bootBtn = $("builder-sb-boot");
  const reloadBtn = $("builder-sb-reload");
  const stopBtn = $("builder-sb-stop");
  const sendBtn = $("builder-sb-send-event");
  const hasFiles = Object.keys(generatedFiles).length > 0;
  const booted = Sandbox.booted && !!Sandbox._worker;
  const busy = Sandbox.state === "busy";
  if (bootBtn) bootBtn.disabled = booted || busy;
  if (reloadBtn) reloadBtn.disabled = !booted || !hasFiles || busy;
  if (stopBtn) stopBtn.disabled = !booted || busy;
  if (sendBtn) sendBtn.disabled = !booted || busy;
}

function appendSandboxLog(entry) {
  const box = $("builder-sb-logs");
  if (!box) return;
  if (entry.stream === "clear") {
    box.innerHTML = "";
    return;
  }
  const empty = box.querySelector(".log-empty");
  if (empty) empty.remove();
  const line = document.createElement("div");
  line.className =
    "log-" +
    (entry.stream === "err"
      ? "err"
      : entry.stream === "warn"
        ? "warn"
        : entry.stream === "sys"
          ? "sys"
          : "out");
  line.textContent = entry.text;
  box.appendChild(line);
  while (box.childNodes.length > 400) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

function renderSandboxSent() {
  const box = $("builder-sb-sent");
  if (!box) return;
  box.innerHTML = "";
  if (!Sandbox.sent.length) {
    const p = document.createElement("p");
    p.className = "builder-empty";
    p.textContent = I18n.t("builder.instance.emptySent");
    box.appendChild(p);
    return;
  }
  for (const s of Sandbox.sent.slice(-30).reverse()) {
    const item = document.createElement("div");
    item.className = "builder-sb-sent-item";
    const meta = document.createElement("span");
    meta.className = "builder-sb-sent-meta";
    const t = s && s.time ? new Date(s.time * 1000) : new Date();
    meta.textContent = t.toTimeString().slice(0, 8);
    const text = document.createElement("span");
    text.className = "builder-sb-sent-text";
    text.textContent = formatSentItem(s).replace(/^→ /, "");
    item.appendChild(meta);
    item.appendChild(text);
    box.appendChild(item);
  }
}

async function bootInstanceFromUI() {
  updateSandboxPanelStatus();
  try {
    await Sandbox.boot();
    showMessage(I18n.t("builder.instance.bootDone"), "success");
  } catch (e) {
    showMessage(
      I18n.t("builder.instance.bootFail") + ": " + (e.message || e),
      "error",
    );
  } finally {
    updateSandboxPanelStatus();
  }
}

async function reloadInstanceFromUI() {
  if (Object.keys(generatedFiles).length === 0) {
    showMessage(I18n.t("builder.instance.needFiles"), "warning");
    return;
  }
  updateSandboxPanelStatus();
  try {
    const report = await Sandbox.runTest({ ...generatedFiles }, []);
    renderSandboxSent();
    showMessage(
      I18n.t("builder.instance.reloadDone") +
        (report.ok ? "" : " (" + I18n.t("builder.instance.report.fail") + ")"),
      report.ok ? "success" : "warning",
    );
  } catch (e) {
    showMessage(
      I18n.t("builder.instance.bootFail") + ": " + (e.message || e),
      "error",
    );
  } finally {
    updateSandboxPanelStatus();
  }
}

async function sendEventFromUI() {
  const input = $("builder-sb-event-input");
  const text = ((input && input.value) || "").trim();
  if (!text) return;
  let payload = text;
  // 支持直接粘贴 OneBot12 事件 JSON
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      payload = JSON.parse(text);
    } catch (e) {
      showMessage(I18n.t("builder.instance.eventInvalid"), "error");
      return;
    }
  }
  updateSandboxPanelStatus();
  try {
    await Sandbox.sendUserEvent(payload);
    if (input) input.value = "";
    renderSandboxSent();
    showMessage(I18n.t("builder.instance.eventSent"), "success");
  } catch (e) {
    showMessage(String(e.message || e), "error");
  } finally {
    updateSandboxPanelStatus();
  }
}

function openSandboxPanel() {
  const modal = $("builder-sandbox-modal");
  if (!modal) return;
  modal.style.display = "flex";
  updateSandboxPanelStatus();
  renderSandboxSent();
  const logs = $("builder-sb-logs");
  if (logs && Sandbox.logs.length) {
    logs.innerHTML = "";
    for (const entry of Sandbox.logs.slice(-300)) appendSandboxLog(entry);
    logs.scrollTop = logs.scrollHeight;
  }
}

function closeSandboxPanel() {
  const modal = $("builder-sandbox-modal");
  if (modal) modal.style.display = "none";
}

function bindSandboxPanel() {
  if (sandboxPanelBound) return;
  sandboxPanelBound = true;

  const openBtn = $("builder-sandbox-btn");
  if (openBtn) openBtn.addEventListener("click", openSandboxPanel);
  const closeBtn = $("builder-sandbox-close");
  if (closeBtn) closeBtn.addEventListener("click", closeSandboxPanel);
  const modal = $("builder-sandbox-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeSandboxPanel();
    });
  }
  const bootBtn = $("builder-sb-boot");
  if (bootBtn) bootBtn.addEventListener("click", bootInstanceFromUI);
  const reloadBtn = $("builder-sb-reload");
  if (reloadBtn) reloadBtn.addEventListener("click", reloadInstanceFromUI);
  const stopBtn = $("builder-sb-stop");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      Sandbox.stop();
      updateSandboxPanelStatus();
      showMessage(I18n.t("builder.instance.stopped"), "info");
    });
  }
  const clearBtn = $("builder-sb-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      Sandbox.clearLogs();
      Sandbox.clearSent();
      renderSandboxSent();
    });
  }
  const sendBtn = $("builder-sb-send-event");
  if (sendBtn) sendBtn.addEventListener("click", sendEventFromUI);
  const eventInput = $("builder-sb-event-input");
  if (eventInput) {
    eventInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendEventFromUI();
      }
    });
  }

  // 订阅沙箱广播（日志 / 状态）
  Sandbox.onLog((entry) => appendSandboxLog(entry));
  Sandbox.onStatus(() => {
    updateSandboxButton();
    updateSandboxPanelStatus();
  });
  updateSandboxButton();
  updateSandboxPanelStatus();
}

/* ============================================================
 * 17.6 新手引导向导
 * ============================================================ */

let onboardingStep = 0;

function showOnboarding() {
  const overlay = $("builder-onboarding");
  if (!overlay) return;
  overlay.style.display = "flex";
  const b = settings();
  const url = $("builder-ob-api-url");
  const key = $("builder-ob-api-key");
  const model = $("builder-ob-model");
  if (url) url.value = b.api_url || "";
  if (key) key.value = b.api_key || "";
  if (model) model.value = b.model || "";
  setOnboardingStep(0);
}

function hideOnboarding() {
  const overlay = $("builder-onboarding");
  if (overlay) overlay.style.display = "none";
}

function setOnboardingStep(step) {
  onboardingStep = step;
  const steps = [$("builder-ob-step-welcome"), $("builder-ob-step-config")];
  steps.forEach((el, i) => {
    if (el) el.classList.toggle("active", i === step);
  });
  const dots = document.querySelectorAll("#builder-ob-dots span");
  dots.forEach((d, i) => d.classList.toggle("active", i === step));
  const nextBtn = $("builder-ob-next");
  if (nextBtn) {
    nextBtn.textContent =
      step === 0
        ? I18n.t("builder.onboarding.next")
        : I18n.t("builder.onboarding.finish");
  }
  const skipBtn = $("builder-ob-skip");
  if (skipBtn) skipBtn.style.display = step === 0 ? "" : "none";
}

function finishOnboarding(saveConfig) {
  const b = settings();
  if (saveConfig) {
    const url = $("builder-ob-api-url");
    const key = $("builder-ob-api-key");
    const model = $("builder-ob-model");
    const persistChk = $("builder-ob-persist");
    if (url) b.api_url = url.value.trim();
    if (key) b.api_key = key.value.trim();
    if (model) b.model = model.value.trim();
    b.persistKey = persistChk ? persistChk.checked : true;
    // 同步到设置抽屉
    const dUrl = $("builder-api-url");
    const dKey = $("builder-api-key");
    const dModel = $("builder-model");
    const dPersist = $("builder-persist-key");
    if (dUrl) dUrl.value = b.api_url || "";
    if (dKey) dKey.value = b.api_key || "";
    if (dModel) dModel.value = b.model || "";
    if (dPersist) dPersist.checked = b.persistKey;
  }
  b.onboarded = true;
  persist();
  hideOnboarding();
}

function bindOnboarding() {
  const nextBtn = $("builder-ob-next");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (onboardingStep === 0) {
        setOnboardingStep(1);
      } else {
        finishOnboarding(true);
        showMessage(I18n.t("builder.onboarding.finish"), "success");
      }
    });
  }
  const skipBtn = $("builder-ob-skip");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => finishOnboarding(false));
  }
  const testBtn = $("builder-ob-test");
  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      const url = ($("builder-ob-api-url") || {}).value || "";
      const key = ($("builder-ob-api-key") || {}).value || "";
      const model = ($("builder-ob-model") || {}).value || "";
      const result = $("builder-ob-test-result");
      const set = (text, cls) => {
        if (result) {
          result.textContent = text;
          result.className = "builder-onboarding-test-result" + (cls ? " " + cls : "");
        }
      };
      if (!url || !model) {
        set("✗ " + I18n.t("builder.onboarding.testFail"), "fail");
        return;
      }
      set(I18n.t("builder.onboarding.testing"));
      testBtn.disabled = true;
      try {
        // 用 OpenAI 兼容的 /models 端点探测连通性
        const base = normalizeApiUrl(url).replace(/\/chat\/completions$/i, "");
        const headers = {};
        if (key) headers.Authorization = "Bearer " + key;
        const res = await fetch(base + "/models", { headers });
        if (!res.ok) throw new Error("HTTP " + res.status);
        set("✓ " + I18n.t("builder.onboarding.testOk"), "ok");
      } catch (e) {
        set(
          "✗ " + I18n.t("builder.onboarding.testFail") + " (" + e.message + ")",
          "fail",
        );
      } finally {
        testBtn.disabled = false;
      }
    });
  }
}



function bindPhaseToggle() {
  const toggle = $("builder-phase-toggle");
  if (!toggle) return;
  toggle.querySelectorAll(".builder-phase-seg").forEach((seg) => {
    seg.addEventListener("click", () => {
      const target = seg.getAttribute("data-phase");
      if (target && target !== phase) {
        switchPhase(target, true);
      }
    });
  });

  // 手动保存检查点 → 已移除，改为撤销/重做
  const undoBtn = $("builder-undo");
  if (undoBtn) undoBtn.addEventListener("click", undoFiles);
  const redoBtn = $("builder-redo");
  if (redoBtn) redoBtn.addEventListener("click", redoFiles);

  // MCP 恢复默认
  const restoreBtn = $("builder-mcp-restore");
  if (restoreBtn) {
    restoreBtn.addEventListener("click", async () => {
      const ok = await showConfirmModal(I18n.t("builder.mcpRestoreConfirm"));
      if (!ok) return;
      const b = settings();
      b.mcpServers = [
        { id: "builtin-erispulse", name: "ErisPulse Docs", url: "https://mcp.erisdev.com/", enabled: true },
      ];
      persist();
      renderMcpServers();
      showMessage(I18n.t("builder.mcpRestoreDone"), "success");
    });
  }

  // 知识库添加 → 已移至配置模态窗
}

/* ============================================================
 * MCP 服务管理（配置模态窗内）
 * ============================================================ */

function renderMcpServers() {
  const container = $("builder-mcp-list");
  if (!container) return;
  const b = settings();
  const servers = b.mcpServers || [];

  container.innerHTML = servers
    .map((s) => {
      const id = escapeHtml(s.id);
      const name = escapeHtml(s.name || s.url || I18n.t("builder.mcpUntitled"));
      const url = escapeHtml(s.url || "");
      const checked = s.enabled !== false ? "checked" : "";
      return (
        '<div class="builder-mcp-item">' +
        '<label class="builder-mcp-item-toggle">' +
        '<input type="checkbox" data-mcp-id="' +
        id +
        '" ' +
        checked +
        ' />' +
        '<span class="builder-mcp-item-name">' +
        name +
        "</span>" +
        '</label>' +
        '<span class="builder-mcp-item-url">' +
        url +
        "</span>" +
        '<button class="builder-mcp-remove" data-mcp-id="' +
        id +
        '">' +
        ICON_X +
        "</button>" +
        "</div>"
      );
    })
    .join("");

  // 切换启用
  container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-mcp-id");
      const srv = servers.find((s) => s.id === id);
      if (srv) {
        srv.enabled = cb.checked;
        persist();
      }
    });
  });
  // 删除
  container.querySelectorAll(".builder-mcp-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-mcp-id");
      const srv = servers.find((s) => s.id === id);
      const ok = await showConfirmModal(I18n.t("builder.mcpDeleteConfirm").replace("{name}", srv?.name || id));
      if (!ok) return;
      b.mcpServers = servers.filter((s) => s.id !== id);
      persist();
      renderMcpServers();
    });
  });
}

function bindMcpAddForm() {
  const form = $("builder-mcp-add-form");
  const addBtn = $("builder-mcp-add-btn");
  const nameInp = $("builder-mcp-add-name");
  const urlInp = $("builder-mcp-add-url");
  const saveBtn = $("builder-mcp-add-save");
  const cancelBtn = $("builder-mcp-add-cancel");
  if (!form || !addBtn) return;

  addBtn.addEventListener("click", () => {
    form.style.display = "block";
    addBtn.style.display = "none";
    if (nameInp) nameInp.value = "";
    if (urlInp) urlInp.value = "";
  });
  const hide = () => {
    form.style.display = "none";
    addBtn.style.display = "";
  };
  if (saveBtn && nameInp && urlInp) {
    saveBtn.addEventListener("click", () => {
      const name = (nameInp.value || "").trim();
      const url = (urlInp.value || "").trim();
      if (!url) return;
      const b = settings();
      if (!b.mcpServers) b.mcpServers = [];
      b.mcpServers.push({
        id: "mcp_" + Date.now(),
        name: name || url,
        url: url,
        enabled: true,
      });
      persist();
      renderMcpServers();
      hide();
    });
  }
  if (cancelBtn) cancelBtn.addEventListener("click", hide);
}

/* ============================================================
 * 知识库管理（配置模态窗内）
 * ============================================================ */

function renderKnowledgeBaseInModal() {
  const container = $("builder-kb-list-inline");
  if (!container) return;
  const s = (activeSessionId && sessions[activeSessionId]) || null;
  const kb = (s && s.knowledgeBase) || [];

  if (kb.length === 0) {
    container.innerHTML =
      '<p class="builder-empty">' + escapeHtml(I18n.t("builder.knowledgeBaseEmpty")) + "</p>";
    return;
  }
  container.innerHTML = kb
    .map(
      (k) =>
        '<div class="builder-kb-item">' +
        '<div class="builder-kb-info">' +
        '<span class="builder-kb-icon">' +
        icon("fileLines") +
        "</span>" +
        '<span class="builder-kb-title">' +
        escapeHtml(k.title) +
        "</span>" +
        '<span class="builder-kb-meta">' +
        (String(k.content || "").length > 60
          ? escapeHtml(String(k.content || "").slice(0, 60)) + "…"
          : escapeHtml(String(k.content || ""))) +
        "</span>" +
        "</div>" +
        '<button class="builder-kb-remove" data-kb="' +
        k.id +
        '">' +
        ICON_X +
        "</button>" +
        "</div>",
    )
    .join("");
  container.querySelectorAll(".builder-kb-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const kbId = btn.getAttribute("data-kb");
      const s = (activeSessionId && sessions[activeSessionId]) || null;
      const entry = (s?.knowledgeBase || []).find((k) => k.id === kbId);
      const ok = await showConfirmModal(I18n.t("builder.knowledgeBaseDeleteConfirm").replace("{title}", entry?.title || kbId));
      if (!ok) return;
      removeKnowledgeEntry(kbId);
      renderKnowledgeBaseInModal();
    });
  });
}

function bindKbActions() {
  const addTextBtn = $("builder-kb-add-text-btn");
  const importFileBtn = $("builder-kb-import-file-btn");
  const fileInput = $("builder-kb-file-input");
  const form = $("builder-kb-add-form");
  const titleInp = $("builder-kb-add-title");
  const contentInp = $("builder-kb-add-content");
  const saveBtn = $("builder-kb-add-save");
  const cancelBtn = $("builder-kb-add-cancel");
  if (!form) return;

  const showForm = () => {
    form.style.display = "block";
    if (titleInp) titleInp.value = "";
    if (contentInp) contentInp.value = "";
  };
  const hideForm = () => {
    form.style.display = "none";
  };

  if (addTextBtn) addTextBtn.addEventListener("click", showForm);
  if (cancelBtn) cancelBtn.addEventListener("click", hideForm);
  if (saveBtn && titleInp && contentInp) {
    saveBtn.addEventListener("click", () => {
      const title = (titleInp.value || "").trim();
      const content = contentInp.value || "";
      if (!title && !content.trim()) return;
      addKnowledgeEntry(
        title || I18n.t("builder.kbUntitled"),
        content.trim(),
      );
      hideForm();
      renderKnowledgeBaseInModal();
    });
  }
  // 导入文件
  if (importFileBtn && fileInput) {
    importFileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const files = fileInput.files;
      if (!files || !files.length) return;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          addKnowledgeEntry(file.name, reader.result || "");
          renderKnowledgeBaseInModal();
        };
        reader.readAsText(file);
      });
      fileInput.value = "";
    });
  }
}

// 移除旧的 promptAddKnowledge（不再使用浏览器 prompt）
function promptAddKnowledge() {
  // 已改为模态窗内表单，此函数保留空壳以兼容旧引用
}

function bindLanguageDropdown() {
  const btn = $("builder-lang-btn");
  const dropdown = $("builder-lang-dropdown");
  const label = $("builder-lang-label");
  if (!btn || !dropdown || !label) return;

  const langs = I18n.getSupportedLanguages();
  const codes = { "zh-CN": "ZH", en: "EN", "zh-TW": "TW", ja: "JA", ru: "RU" };

  const updateLabel = () => {
    const cur = I18n.getLang();
    label.textContent = codes[cur] || cur;
  };

  // 渲染下拉列表（根据当前语言标记 active）
  const renderOptions = () => {
    dropdown.innerHTML = langs
      .map((l) => {
        const active = l.code === I18n.getLang() ? ' class="active"' : "";
        return (
          '<button type="button"' +
          active +
          ' data-lang="' +
          l.code +
          '">' +
          escapeHtml(l.name) +
          "</button>"
        );
      })
      .join("");
    // 绑定点击
    dropdown.querySelectorAll("button").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const code = opt.getAttribute("data-lang");
        if (code && code !== I18n.getLang()) {
          I18n.setLang(code);
          updateLabel();
          renderOptions();
          // 重新渲染所有动态内容
          renderWelcome();
          renderMcpServers();
          renderKnowledgeBaseInModal();
          renderSessionList();
          updateInputPlaceholder();
          updateSandboxButton();
        }
        dropdown.classList.remove("open");
      });
    });
  };

  updateLabel();
  renderOptions();

  // 切换
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => dropdown.classList.remove("open"));
}

export function setupBuilder() {
  loadSessions();
  bindConfigInputs();
  bindMcpAddForm();
  bindKbActions();
  bindLanguageDropdown();
  bindChatActions();
  bindMobileDrawer();
  bindSessionIO();
  bindThemeToggle();
  bindSandboxPanel();
  bindOnboarding();
  renderWelcome();
  updateEmptyState();

  // 会话初始化
  const newBtn = $("builder-new-session");
  if (newBtn) {
    newBtn.addEventListener("click", () => {
      newSession();
      $("builder-input").focus();
    });
  }
  const clearSessionsBtn = $("builder-clear-sessions");
  if (clearSessionsBtn) {
    clearSessionsBtn.addEventListener("click", () => {
      clearAllSessions();
    });
  }
  if (!activeSessionId || !sessions[activeSessionId]) {
    newSession();
  } else {
    switchSession(activeSessionId);
  }

  updateFileList();
  updatePhaseToggle();
  bindPhaseToggle();
  renderUploadChips();
  autoLoadDocs();

  // 新手引导：未完成过引导且未配置模型时弹出
  const b = settings();
  if (!b.onboarded && (!b.api_url || !b.api_key || !b.model)) {
    showOnboarding();
  }
}

export {
  MCP,
  normalizeApiUrl,
  PLAN_TOOLS,
  GENERATE_TOOLS,
};
