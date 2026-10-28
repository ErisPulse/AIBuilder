/**
 * ErisPulse Builder — 精简版国际化
 *
 * 从原 erispulse.github.io/assets/js/i18n.js 移植而来。
 * 仅保留 builder.* 文案以及 builder 间接依赖的少量通用键。
 * 支持 5 种语言：zh-CN、en、zh-TW、ja、ru（缺失键回退到 zh-CN）。
 *
 * 与原版 API 保持一致：I18n.t / getLang / setLang / applyTranslations /
 * getLanguageName / getSupportedLanguages / init。
 */

export const I18n = (function () {
  const STORAGE_KEY = "erispulse-builder-lang";

  /**
   * 根据浏览器语言偏好检测默认语言
   */
  function detectBrowserLang() {
    const langs = navigator.languages || [navigator.language || "zh-CN"];
    for (const lang of langs) {
      const lower = String(lang || "").toLowerCase();
      if (lower.startsWith("zh-cn") || lower.startsWith("zh-hans")) return "zh-CN";
      if (lower.startsWith("zh-tw") || lower.startsWith("zh-hk") || lower.startsWith("zh-hant"))
        return "zh-TW";
      if (lower.startsWith("zh")) return "zh-CN";
      if (lower.startsWith("ja")) return "ja";
      if (lower.startsWith("ru")) return "ru";
      if (lower.startsWith("en")) return "en";
    }
    return "zh-CN";
  }

  let currentLang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();

  const messages = {
    "zh-CN": {
      "builder.config": "模型配置",
      "builder.apiUrl": "API 地址",
      "builder.apiUrlPlaceholder": "https://api.openai.com/v1",
      "builder.apiKey": "API Key",
      "builder.apiKeyPlaceholder": "sk-...",
      "builder.model": "模型",
      "builder.modelPlaceholder": "gpt-4o",
      "builder.persistKey": "记住密钥（仅本机）",
      "builder.showKey": "显示/隐藏密钥",
      "builder.docsSource": "文档缓存",
      "builder.docsStatusReady": "已就绪",
      "builder.docsStatusEmpty": "未加载",
      "builder.docsStatusLoading": "加载中…",
      "builder.loadDocs": "加载/刷新文档",
      "builder.docsHint":
        "加载官方文档后，AI 可通过检索工具查阅 SDK 用法，生成更准确的代码。建议先在文档中心本地化缓存。",
      "builder.docsLoaded": "已加载 {n} 篇文档",
      "builder.generatedFiles": "已生成文件",
      "builder.noFiles": "尚未生成文件",
      "builder.viewAll": "查看全部",
      "builder.downloadZip": "下载 ZIP",
      "builder.sessions": "会话",
      "builder.newSession": "新会话",
      "builder.newChat": "开启新对话",
      "builder.themeToggle": "切换主题",
      "builder.noSessions": "暂无会话",
      "builder.exportSessions": "导出会话",
      "builder.exportCurrent": "导出当前会话",
      "builder.exportAll": "导出全部会话",
      "builder.importSessions": "导入会话",
      "builder.importSuccess": "已导入 {n} 个会话",
      "builder.error.noActiveSession": "没有可导出的当前会话",
      "builder.error.importRead": "无法读取文件",
      "builder.error.importParse": "文件不是有效的 JSON",
      "builder.error.importFormat": "文件格式不正确",
      "builder.error.importEmpty": "文件中未找到可导入的会话",
      "builder.deleteSessionConfirm":
        "确定删除该会话？会话内的对话与生成文件将一并清除。",
      "builder.session.today": "今天",
      "builder.session.yesterday": "昨天",
      "builder.session.withinWeek": "7 天内",
      "builder.session.earlier": "更早",
      "builder.renameSession": "重命名会话",
      "builder.clearAllSessions": "清空全部会话",
      "builder.clearAllConfirm":
        "确定清空全部会话？所有对话与生成文件将一并清除，且无法恢复。",
      "builder.title": "AI 模块构建器",
      "builder.subtitle":
        "描述需求，AI 查阅文档后生成完整 ErisPulse 模块代码并打包下载",
      "builder.clear": "清空",
      "builder.menu": "菜单",
      "builder.inputPlaceholder": "描述你想构建的 ErisPulse 模块 / 适配器...",
      "builder.inputPlaceholderPlan": "描述需求或回答问题…",
      "builder.inputPlaceholderGenerate": "补充说明…",
      "builder.send": "发送",
      "builder.sending": "生成中...",
      "builder.stop": "停止",
      "builder.stopped": "已停止生成。",
      "builder.writing": "正在写入…",
      "builder.question.custom": "自定义答案...",
      "builder.question.ok": "确定",
      "builder.question.submitAll": "提交全部回答",
      "builder.confirmCancel": "取消",
      "builder.confirmOk": "确定",
      "builder.tool.ask_question": "提问",
      "builder.tool.confirm_start": "确认开始",
      "builder.tool.web_fetch": "联网请求",
      "builder.webFetch.confirm":
        "AI 请求访问外部网络地址（web_fetch）。允许本次请求吗？",
      "builder.webFetch.remember": "记住选择，不再询问",
      "builder.webFetch.disabled": "联网请求已在设置中关闭。",
      "builder.webFetch.denied":
        "用户拒绝了本次联网请求。请改用 search_docs 或请用户提供相关内容。",
      "builder.webFetch.cors": "可能被浏览器 CORS 策略拦截",
      "builder.webFetch.fallback":
        "建议改用其他资料来源（如 search_docs），或请用户粘贴相关内容。",
      "builder.confirmStartMsg": "资料准备完毕，是否开始生成？",
      "builder.startCommand": "开始",
      "builder.docsInitHint": "正在初始化文档清单，这个阶段可能较长，请耐心等待…",
      "builder.settingsTitle": "AI 模块构建器",
      "builder.settingsDesc":
        "配置构建器使用的 OpenAI 兼容 API（地址可填域名，会自动补 /chat/completions）。",
      "builder.settingsPrivacy":
        "所有数据（配置、会话、生成文件）保存在浏览器本地，不上传任何服务器。本站开源。",
      "builder.settingsConfigBtn": "配置",
      "builder.sendMode.enter": "Enter",
      "builder.sendMode.ctrlEnter": "Ctrl+Enter",
      "builder.sendModeTitle": "切换发送键位",
      "builder.phase.plan": "规划阶段",
      "builder.phase.generate": "生成阶段",
      "builder.phaseSwitched": "已进入生成阶段，AI 现在可以写入文件",
      "builder.phaseSwitchedToPlan": "已切换回规划阶段，AI 仅可查阅文档，不能写入文件",
      "builder.welcome":
        "### AI 模块构建器\n\n我是**小eris**，ErisPulse 官方的 AI 模块构建助手。\n\n我会分两步帮你构建模块：\n\n1. **规划阶段**——告诉我你想构建什么，我会查阅官方文档并与你讨论方案\n2. **生成阶段**——方案确定后，发送「**开始**」进入生成阶段，我会生成完整源码\n\n请先点击左下角「**配置**」填写 API 地址与模型。",
      "builder.done": "生成完成，可点击「下载 ZIP」获取模块包",
      "builder.error.noApiUrl": "请先填写 API 地址",
      "builder.error.noApiKey": "请先填写 API Key",
      "builder.error.noModel": "请先填写模型名称",
      "builder.error.noConfig": "请先在「配置模型」中填写 API 地址与模型",
      "builder.error.network": "网络请求失败",
      "builder.error.apiError": "API 调用失败",
      "builder.error.docsLoad": "文档加载失败",
      "builder.error.zip": "打包失败",
      "builder.error.clearConfirm": "确定要清空所有对话与已生成文件吗？",
      "builder.tool.search_docs": "检索文档",
      "builder.tool.read_document": "读取文档",
      "builder.tool.list_documents": "列出文档",
      "builder.tool.write_file": "写入文件",
      "builder.tool.patch_file": "修改文件",
      "builder.tool.read_file": "读取文件",
      "builder.tool.delete_file": "删除文件",
      "builder.tool.get_manifest": "查看文件清单",
      "builder.tool.finalize": "完成生成",
      "builder.question.multi": "多选",
      "builder.upload.title": "上传文本文件（随消息发送给 AI）",
      "builder.upload.unsupported":
        "不支持的文件类型：{name}（仅支持常见的文本文件，如 md/txt/json/py）",
      "builder.upload.tooLarge": "{name} 超过 {max} 的单文件大小限制",
      "builder.upload.readFail": "读取文件失败：{name}",
      "builder.progress.request": "请求参数",
      "builder.progress.result": "返回结果",
      // 主题
      "builder.theme.auto": "跟随系统",
      "builder.theme.light": "浅色",
      "builder.theme.dark": "深色",
      "builder.oledToggle": "OLED 纯黑模式（暗色主题下生效）",
      "builder.webFetch.toggle": "允许 AI 联网请求（web_fetch）",
      // 欢迎页
      "builder.welcomeTitle": "ErisPulse Builder",
      "builder.welcomeSubtitle":
        "我是小eris，告诉我你想构建的模块或适配器，我来查文档、写代码，还能在浏览器里的真实 ErisPulse 实例中直接试运行。",
      "builder.tip1": "做一个签到模块，每天固定时间发一条消息",
      "builder.tip2": "写一个复读机模块，收到什么就回复什么",
      "builder.tip3": "帮我开发一个对接 OneBot v11 的适配器",
      "builder.tip4": "做一个关键词自动回复模块，支持多关键词组",
      // 复制
      "builder.copy": "复制",
      "builder.copied": "已复制",
      // 实例控制台（浏览器内 ErisPulse 沙箱）
      "builder.instance.title": "实例控制台",
      "builder.instance.openPanel": "实例控制台",
      "builder.instance.chipTitle":
        "浏览器内 ErisPulse 实例状态，点击打开控制台",
      "builder.instance.state.off": "实例未启动",
      "builder.instance.state.allocating": "正在分配空间",
      "builder.instance.state.downloading": "正在下载运行时",
      "builder.instance.state.installing": "正在安装运行环境",
      "builder.instance.state.ready": "实例就绪",
      "builder.instance.state.running": "运行中",
      "builder.instance.state.busy": "执行中",
      "builder.instance.state.error": "实例错误",
      "builder.instance.boot": "启动实例",
      "builder.instance.stop": "停止",
      "builder.instance.reload": "重载模块",
      "builder.instance.clearLogs": "清空日志",
      "builder.instance.simulateTitle": "模拟用户消息（以 mock 平台私信注入）",
      "builder.instance.eventPlaceholder": "输入一条测试消息，如：你好",
      "builder.instance.sendEvent": "注入",
      "builder.instance.logsTitle": "运行日志",
      "builder.instance.emptyLogs": "暂无日志",
      "builder.instance.sentTitle": "实例发出的消息",
      "builder.instance.emptySent": "暂无消息",
      "builder.instance.note":
        "浏览器内通过 WebAssembly 运行真实 ErisPulse 框架（首次启动需下载运行时并安装依赖，约 20-40MB，之后走浏览器缓存）。模块收发消息全部经由 MockAdapter 在本地完成，不访问任何网络。",
      "builder.instance.needFiles":
        "当前没有已生成的文件，请先让 AI 生成模块代码。",
      "builder.instance.bootFirst": "请先启动实例。",
      "builder.instance.busy": "实例正在执行其他任务，请稍候。",
      "builder.instance.bootDone": "实例已就绪，模块已加载。",
      "builder.instance.reloadDone": "模块已重载并重新运行。",
      "builder.instance.stopped": "实例已停止，环境已释放。",
      "builder.instance.eventSent": "事件已注入。",
      "builder.instance.eventInvalid": "事件格式无效，请检查 JSON。",
      "builder.instance.bootFail": "实例启动失败",
      "builder.instance.progress.space": "正在分配虚拟磁盘与配置目录…",
      "builder.instance.progress.runtime":
        "正在下载 Python 运行时（WebAssembly）…",
      "builder.instance.progress.pip":
        "正在安装 ErisPulse 及依赖（aiohttp / fastapi / rich …）…",
      "builder.instance.progress.sdk":
        "正在初始化 ErisPulse 实例（加载模块与 MockAdapter）…",
      "builder.instance.progress.deploy": "正在部署生成文件并重载模块…",
      "builder.instance.report.logs": "运行日志",
      "builder.instance.report.errors": "错误",
      "builder.instance.report.sent": "实例发出的消息",
      "builder.instance.report.none": "（无）",
      "builder.instance.report.ok": "运行完成，未捕获异常",
      "builder.instance.report.fail": "运行完成，捕获到异常",
      "builder.tool.run_module": "实例试运行",
      "builder.tool.exec_python": "实例内执行",
      "builder.tool.install_packages": "安装依赖",
      // 新手引导
      "builder.onboarding.welcomeTitle": "欢迎使用 ErisPulse Builder",
      "builder.onboarding.welcomeDesc":
        "用自然语言描述需求，AI 会查阅 ErisPulse 官方文档，生成完整的模块/适配器代码，还能在浏览器内的真实 ErisPulse 实例中直接试运行。开始之前，先配置一个 OpenAI 兼容的模型 API。",
      "builder.onboarding.configTitle": "配置模型",
      "builder.onboarding.configDesc":
        "填写任意 OpenAI 兼容 API（OpenAI / DeepSeek / Kimi / 本地 Ollama 等）。密钥仅保存在本机浏览器。",
      "builder.onboarding.next": "开始配置",
      "builder.onboarding.back": "上一步",
      "builder.onboarding.finish": "完成",
      "builder.onboarding.skip": "稍后再说",
      "builder.onboarding.test": "测试连接",
      "builder.onboarding.testing": "测试中…",
      "builder.onboarding.testOk": "连接成功",
      "builder.onboarding.testFail": "连接失败",
      "builder.onboarding.privacy":
        "全部数据仅存于浏览器 localStorage，不上传任何服务器。",
      // 通用键
      "common.loading": "加载中…",
      "nav.backHome": "返回 ErisPulse 官网",
      "nav.openSource": "GitHub",
      "lang.name": "语言",
      "common.save": "保存",
      "common.cancel": "取消",
      "builder.mcpServers": "MCP 服务",
      "builder.mcpRestore": "恢复默认",
      "builder.mcpRestoreConfirm": "将 MCP 服务列表恢复为默认（仅保留 ErisPulse 文档）？",
      "builder.mcpRestoreDone": "已恢复默认 MCP 服务",
      "builder.mcpAdd": "添加 MCP 服务",
      "builder.mcpName": "服务名称",
      "builder.mcpUrlPlaceholder": "https://...",
      "builder.mcpDeleteConfirm": "确定删除 MCP 服务「{name}」？",
      "builder.mcpUntitled": "未命名服务",
      "builder.knowledgeBase": "知识库",
      "builder.knowledgeBaseEmpty": "暂未添加知识",
      "builder.knowledgeBaseDeleteConfirm": "确定删除知识「{title}」？",
      "builder.kbAddText": "添加文本",
      "builder.kbImportFile": "导入文件",
      "builder.kbTitle": "知识标题",
      "builder.kbContent": "知识内容（粘贴文本）",
      "builder.kbUntitled": "未命名知识",
      "builder.undo": "撤销",
      "builder.redo": "重做",
      "builder.undoDone": "已撤销",
      "builder.redoDone": "已重做",
      "builder.configSection": "配置",
    },

    en: {
      "builder.config": "Model Config",
      "builder.apiUrl": "API URL",
      "builder.apiUrlPlaceholder": "https://api.openai.com/v1",
      "builder.apiKey": "API Key",
      "builder.apiKeyPlaceholder": "sk-...",
      "builder.model": "Model",
      "builder.modelPlaceholder": "gpt-4o",
      "builder.persistKey": "Remember key (local only)",
      "builder.showKey": "Show/hide key",
      "builder.docsSource": "Docs Cache",
      "builder.docsStatusReady": "Ready",
      "builder.docsStatusEmpty": "Not loaded",
      "builder.docsStatusLoading": "Loading…",
      "builder.loadDocs": "Load/refresh docs",
      "builder.docsHint":
        "After loading official docs, the AI can look up SDK usage via retrieval tools to generate more accurate code.",
      "builder.docsLoaded": "Loaded {n} docs",
      "builder.generatedFiles": "Generated Files",
      "builder.noFiles": "No generated files yet",
      "builder.viewAll": "View all",
      "builder.downloadZip": "Download ZIP",
      "builder.sessions": "Sessions",
      "builder.newSession": "New session",
      "builder.newChat": "New chat",
      "builder.themeToggle": "Toggle theme",
      "builder.noSessions": "No sessions yet",
      "builder.exportSessions": "Export sessions",
      "builder.exportCurrent": "Export current session",
      "builder.exportAll": "Export all sessions",
      "builder.importSessions": "Import sessions",
      "builder.importSuccess": "Imported {n} sessions",
      "builder.error.noActiveSession": "No active session to export",
      "builder.error.importRead": "Unable to read the file",
      "builder.error.importParse": "The file is not valid JSON",
      "builder.error.importFormat": "Invalid file format",
      "builder.error.importEmpty": "No importable sessions found in the file",
      "builder.deleteSessionConfirm":
        "Delete this session? Its conversation and generated files will be removed.",
      "builder.session.today": "Today",
      "builder.session.yesterday": "Yesterday",
      "builder.session.withinWeek": "Previous 7 days",
      "builder.session.earlier": "Earlier",
      "builder.renameSession": "Rename session",
      "builder.clearAllSessions": "Clear all sessions",
      "builder.clearAllConfirm":
        "Clear all sessions? All conversations and generated files will be removed permanently.",
      "builder.title": "AI Module Builder",
      "builder.subtitle":
        "Describe your needs; the AI looks up docs, then generates a complete ErisPulse module and packages it for download",
      "builder.clear": "Clear",
      "builder.menu": "Menu",
      "builder.inputPlaceholder":
        "Describe the ErisPulse module / adapter you want to build...",
      "builder.inputPlaceholderPlan": "Describe your needs or answer questions…",
      "builder.inputPlaceholderGenerate": "Add details…",
      "builder.send": "Send",
      "builder.sending": "Generating...",
      "builder.stop": "Stop",
      "builder.stopped": "Generation stopped.",
      "builder.writing": "Writing…",
      "builder.question.custom": "Custom answer...",
      "builder.question.ok": "OK",
      "builder.question.submitAll": "Submit all answers",
      "builder.confirmCancel": "Cancel",
      "builder.confirmOk": "OK",
      "builder.tool.ask_question": "Ask",
      "builder.tool.confirm_start": "Confirm start",
      "builder.tool.web_fetch": "Web fetch",
      "builder.webFetch.confirm":
        "The AI wants to make a web request (web_fetch). Allow this request?",
      "builder.webFetch.remember": "Remember and don't ask again",
      "builder.webFetch.disabled": "Web requests are disabled in settings.",
      "builder.webFetch.denied":
        "The user denied this web request. Use search_docs instead or ask the user to provide the content.",
      "builder.webFetch.cors": "possibly blocked by browser CORS policy",
      "builder.webFetch.fallback":
        "Try another source (e.g. search_docs), or ask the user to paste the content.",
      "builder.confirmStartMsg": "Materials are ready. Start generating?",
      "builder.startCommand": "start",
      "builder.docsInitHint":
        "Initializing document index — this may take a while, please wait…",
      "builder.settingsTitle": "AI Module Builder",
      "builder.settingsDesc":
        "Configure the OpenAI-compatible API used by the builder (a bare domain is fine; /chat/completions is appended automatically).",
      "builder.settingsPrivacy":
        "All data (config, sessions, generated files) is stored locally in your browser and never uploaded. Open source.",
      "builder.settingsConfigBtn": "Settings",
      "builder.sendMode.enter": "Enter",
      "builder.sendMode.ctrlEnter": "Ctrl+Enter",
      "builder.sendModeTitle": "Switch send shortcut",
      "builder.phase.plan": "Planning",
      "builder.phase.generate": "Generating",
      "builder.phaseSwitched":
        "Switched to generation phase; the AI can now write files",
      "builder.phaseSwitchedToPlan": "Switched to planning phase; the AI can only read docs, not write files",
      "builder.welcome":
        "### AI Module Builder\n\nI'm **Xiao-eris**, the official ErisPulse AI module builder assistant.\n\nI'll help you build a module in two steps:\n\n1. **Planning**—tell me what you want to build; I'll consult the docs and discuss a plan with you\n2. **Generation**—once the plan is settled, send “**start**” to enter the generation phase and I'll produce the full source\n\nClick the “**Configure**” icon in the bottom-left sidebar to set the API URL and model.",
      "builder.done": "Done. Click 「Download ZIP」 to get the module package",
      "builder.error.noApiUrl": "Please fill in the API URL first",
      "builder.error.noApiKey": "Please fill in the API Key first",
      "builder.error.noModel": "Please fill in the model name first",
      "builder.error.noConfig": "Please configure the API URL and model first",
      "builder.error.network": "Network request failed",
      "builder.error.apiError": "API call failed",
      "builder.error.docsLoad": "Failed to load docs",
      "builder.error.zip": "Packaging failed",
      "builder.error.clearConfirm": "Clear all conversation and generated files?",
      "builder.tool.search_docs": "Search docs",
      "builder.tool.read_document": "Read document",
      "builder.tool.list_documents": "List documents",
      "builder.tool.write_file": "Write file",
      "builder.tool.patch_file": "Patch file",
      "builder.tool.read_file": "Read file",
      "builder.tool.delete_file": "Delete file",
      "builder.tool.get_manifest": "View manifest",
      "builder.tool.finalize": "Finalize",
      "builder.question.multi": "Multi",
      "builder.upload.title": "Upload text file (sent to AI with the message)",
      "builder.upload.unsupported":
        "Unsupported file type: {name} (only common text files like md/txt/json/py are supported)",
      "builder.upload.tooLarge": "{name} exceeds the {max} per-file size limit",
      "builder.upload.readFail": "Failed to read file: {name}",
      "builder.progress.request": "Request",
      "builder.progress.result": "Result",
      // Theme
      "builder.theme.auto": "System",
      "builder.theme.light": "Light",
      "builder.theme.dark": "Dark",
      "builder.oledToggle": "OLED pure black (applies in dark theme)",
      "builder.webFetch.toggle": "Allow AI web requests (web_fetch)",
      // Welcome hero
      "builder.welcomeTitle": "ErisPulse Builder",
      "builder.welcomeSubtitle":
        "I'm Xiaoeris. Tell me what module or adapter you want to build — I'll read the docs, write the code, and even test-run it in a real ErisPulse instance right inside your browser.",
      "builder.tip1": "Build a check-in module that posts a daily message",
      "builder.tip2": "Write an echo module that replies with whatever it receives",
      "builder.tip3": "Help me develop an adapter for OneBot v11",
      "builder.tip4": "Make a keyword auto-reply module with multiple keyword groups",
      // Copy
      "builder.copy": "Copy",
      "builder.copied": "Copied",
      // Instance console (in-browser ErisPulse sandbox)
      "builder.instance.title": "Instance Console",
      "builder.instance.openPanel": "Instance Console",
      "builder.instance.chipTitle":
        "In-browser ErisPulse instance status — click to open the console",
      "builder.instance.state.off": "Instance off",
      "builder.instance.state.allocating": "Allocating space",
      "builder.instance.state.downloading": "Downloading runtime",
      "builder.instance.state.installing": "Installing environment",
      "builder.instance.state.ready": "Instance ready",
      "builder.instance.state.running": "Running",
      "builder.instance.state.busy": "Busy",
      "builder.instance.state.error": "Instance error",
      "builder.instance.boot": "Start Instance",
      "builder.instance.stop": "Stop",
      "builder.instance.reload": "Reload Modules",
      "builder.instance.clearLogs": "Clear Logs",
      "builder.instance.simulateTitle":
        "Simulate user message (injected as mock platform private message)",
      "builder.instance.eventPlaceholder": "Type a test message, e.g. hello",
      "builder.instance.sendEvent": "Inject",
      "builder.instance.logsTitle": "Runtime Logs",
      "builder.instance.emptyLogs": "No logs yet",
      "builder.instance.sentTitle": "Messages Sent by Instance",
      "builder.instance.emptySent": "No messages yet",
      "builder.instance.note":
        "Runs the real ErisPulse framework in your browser via WebAssembly (first boot downloads the runtime and dependencies, ~20-40MB, cached afterwards). All message traffic goes through a local MockAdapter — no network access.",
      "builder.instance.needFiles":
        "No generated files yet. Ask the AI to generate module code first.",
      "builder.instance.bootFirst": "Please start the instance first.",
      "builder.instance.busy": "The instance is busy with another task.",
      "builder.instance.bootDone": "Instance ready, modules loaded.",
      "builder.instance.reloadDone": "Modules reloaded and restarted.",
      "builder.instance.stopped": "Instance stopped and environment released.",
      "builder.instance.eventSent": "Event injected.",
      "builder.instance.eventInvalid": "Invalid event JSON.",
      "builder.instance.bootFail": "Instance failed to start",
      "builder.instance.progress.space": "Allocating virtual disk and config…",
      "builder.instance.progress.runtime":
        "Downloading Python runtime (WebAssembly)…",
      "builder.instance.progress.pip":
        "Installing ErisPulse and dependencies (aiohttp / fastapi / rich …)…",
      "builder.instance.progress.sdk":
        "Initializing ErisPulse instance (loading modules & MockAdapter)…",
      "builder.instance.progress.deploy": "Deploying generated files and reloading…",
      "builder.instance.report.logs": "Logs",
      "builder.instance.report.errors": "Errors",
      "builder.instance.report.sent": "Messages sent by instance",
      "builder.instance.report.none": "(none)",
      "builder.instance.report.ok": "Finished with no exceptions",
      "builder.instance.report.fail": "Finished with exceptions",
      "builder.tool.run_module": "Test Run",
      "builder.tool.exec_python": "Exec in Instance",
      "builder.tool.install_packages": "Install Deps",
      // Onboarding
      "builder.onboarding.welcomeTitle": "Welcome to ErisPulse Builder",
      "builder.onboarding.welcomeDesc":
        "Describe what you need in plain language — the AI reads the official ErisPulse docs, generates complete module/adapter code, and can test-run it in a real in-browser ErisPulse instance. First, configure an OpenAI-compatible model API.",
      "builder.onboarding.configTitle": "Configure Model",
      "builder.onboarding.configDesc":
        "Fill in any OpenAI-compatible API (OpenAI / DeepSeek / Kimi / local Ollama, etc.). Keys stay in your browser only.",
      "builder.onboarding.next": "Get Started",
      "builder.onboarding.back": "Back",
      "builder.onboarding.finish": "Finish",
      "builder.onboarding.skip": "Later",
      "builder.onboarding.test": "Test Connection",
      "builder.onboarding.testing": "Testing…",
      "builder.onboarding.testOk": "Connected",
      "builder.onboarding.testFail": "Connection failed",
      "builder.onboarding.privacy":
        "All data stays in your browser's localStorage. Nothing is uploaded.",
      "common.loading": "Loading…",
      "nav.backHome": "Back to ErisPulse",
      "nav.openSource": "GitHub",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "builder.mcpServers": "MCP Services",
      "builder.mcpRestore": "Restore Defaults",
      "builder.mcpRestoreConfirm": "Restore MCP services to default (keep only ErisPulse docs)?",
      "builder.mcpRestoreDone": "Restored default MCP services",
      "builder.mcpAdd": "Add MCP Service",
      "builder.mcpName": "Service name",
      "builder.mcpUrlPlaceholder": "https://...",
      "builder.mcpDeleteConfirm": "Delete MCP service \"{name}\"?",
      "builder.mcpUntitled": "Unnamed service",
      "builder.knowledgeBase": "Knowledge Base",
      "builder.knowledgeBaseEmpty": "No entries yet",
      "builder.knowledgeBaseDeleteConfirm": "Delete knowledge entry \"{title}\"?",
      "builder.kbAddText": "Add Text",
      "builder.kbImportFile": "Import File",
      "builder.kbTitle": "Title",
      "builder.kbContent": "Content (paste text)",
      "builder.kbUntitled": "Untitled",
      "builder.undo": "Undo",
      "builder.redo": "Redo",
      "builder.undoDone": "Undone",
      "builder.redoDone": "Redone",
      "builder.configSection": "Settings",
    },

    "zh-TW": {
      "builder.config": "模型設定",
      "builder.apiUrl": "API 位址",
      "builder.apiUrlPlaceholder": "https://api.openai.com/v1",
      "builder.apiKey": "API Key",
      "builder.apiKeyPlaceholder": "sk-...",
      "builder.model": "模型",
      "builder.modelPlaceholder": "gpt-4o",
      "builder.persistKey": "記住金鑰（僅本機）",
      "builder.showKey": "顯示/隱藏金鑰",
      "builder.docsSource": "文檔快取",
      "builder.docsStatusReady": "已就緒",
      "builder.docsStatusEmpty": "未載入",
      "builder.docsStatusLoading": "載入中…",
      "builder.loadDocs": "載入/重新整理文檔",
      "builder.docsHint":
        "載入官方文檔後，AI 可透過檢索工具查閱 SDK 用法，生成更準確的程式碼。",
      "builder.docsLoaded": "已載入 {n} 篇文檔",
      "builder.generatedFiles": "已生成檔案",
      "builder.noFiles": "尚無生成檔案",
      "builder.viewAll": "檢視全部",
      "builder.downloadZip": "下載 ZIP",
      "builder.sessions": "會話",
      "builder.newSession": "新會話",
      "builder.newChat": "開啟新對話",
      "builder.themeToggle": "切換主題",
      "builder.noSessions": "暫無會話",
      "builder.exportSessions": "匯出會話",
      "builder.exportCurrent": "匯出目前會話",
      "builder.exportAll": "匯出全部會話",
      "builder.importSessions": "匯入會話",
      "builder.importSuccess": "已匯入 {n} 個會話",
      "builder.error.noActiveSession": "沒有可匯出的目前會話",
      "builder.error.importRead": "無法讀取檔案",
      "builder.error.importParse": "檔案不是有效的 JSON",
      "builder.error.importFormat": "檔案格式不正確",
      "builder.error.importEmpty": "檔案中未找到可匯入的會話",
      "builder.deleteSessionConfirm":
        "確定要刪除該會話？對話與生成檔案將一併清除。",
      "builder.session.today": "今天",
      "builder.session.yesterday": "昨天",
      "builder.session.withinWeek": "7 天內",
      "builder.session.earlier": "更早",
      "builder.renameSession": "重新命名會話",
      "builder.clearAllSessions": "清空全部會話",
      "builder.clearAllConfirm":
        "確定清空全部會話？所有對話與生成檔案將一併清除，且無法復原。",
      "builder.title": "AI 模組構建器",
      "builder.subtitle":
        "描述需求，AI 查閱文檔後生成完整 ErisPulse 模組程式碼並打包下載",
      "builder.clear": "清空",
      "builder.menu": "選單",
      "builder.inputPlaceholder": "描述你想構建的 ErisPulse 模組 / 配接器...",
      "builder.inputPlaceholderPlan": "描述需求或回答問題…",
      "builder.inputPlaceholderGenerate": "補充說明…",
      "builder.send": "發送",
      "builder.sending": "生成中…",
      "builder.writing": "正在寫入…",
      "builder.question.custom": "自訂答案…",
      "builder.question.ok": "確定",
      "builder.question.submitAll": "提交全部回答",
      "builder.confirmCancel": "取消",
      "builder.confirmOk": "確定",
      "builder.tool.ask_question": "提問",
      "builder.tool.confirm_start": "確認開始",
      "builder.tool.web_fetch": "網路請求",
      "builder.webFetch.confirm":
        "AI 請求存取外部網路位址（web_fetch）。允許本次請求嗎？",
      "builder.webFetch.remember": "記住選擇，不再詢問",
      "builder.webFetch.disabled": "網路請求已在設定中關閉。",
      "builder.webFetch.denied":
        "使用者拒絕了本次網路請求。請改用 search_docs 或請使用者提供相關內容。",
      "builder.webFetch.cors": "可能被瀏覽器 CORS 政策攔截",
      "builder.webFetch.fallback":
        "建議改用其他資料來源（如 search_docs），或請使用者貼上相關內容。",
      "builder.confirmStartMsg": "資料準備完畢，是否開始生成？",
      "builder.startCommand": "開始",
      "builder.docsInitHint": "正在初始化文檔清單，此階段可能較長，請耐心等候…",
      "builder.settingsTitle": "AI 模組構建器",
      "builder.settingsDesc":
        "設定構建器使用的 OpenAI 相容 API（位址可填域名，會自動補 /chat/completions）。",
      "builder.settingsPrivacy":
        "所有資料（設定、會話、生成檔案）保存在瀏覽器本機，不上傳任何伺服器。開源。",
      "builder.settingsConfigBtn": "設定",
      "builder.sendMode.enter": "Enter",
      "builder.sendMode.ctrlEnter": "Ctrl+Enter",
      "builder.sendModeTitle": "切換發送鍵位",
      "builder.phase.plan": "規劃",
      "builder.phase.generate": "生成",
      "builder.phaseSwitched": "已進入生成階段，AI 現在可以寫入檔案",
      "builder.phaseSwitchedToPlan": "已切換回規劃階段，AI 僅可查閱文檔，不能寫入檔案",
      "builder.welcome":
        "### AI 模組構建器\n\n我是**小eris**，ErisPulse 官方的 AI 模組構建助手。\n\n我會分兩步幫你構建模組：\n\n1. **規劃階段**——告訴我你想構建什麼，我會查閱官方文檔並與你討論方案\n2. **生成階段**——方案確定後，發送「**開始**」進入生成階段，我會生成完整原始碼\n\n請先點擊左下角「**設定**」填寫 API 位址與模型。",
      "builder.done": "生成完畢，可點擊「下載 ZIP」取得模組套件",
      "builder.error.noApiUrl": "請先填寫 API 位址",
      "builder.error.noApiKey": "請先填寫 API Key",
      "builder.error.noModel": "請先填寫模型名稱",
      "builder.error.noConfig": "請先在「設定模型」中填寫 API 位址與模型",
      "builder.error.network": "網路請求失敗",
      "builder.error.apiError": "API 呼叫失敗",
      "builder.error.docsLoad": "文檔載入失敗",
      "builder.error.zip": "打包失敗",
      "builder.error.clearConfirm": "確定要清空所有對話與已生成檔案嗎？",
      "builder.tool.search_docs": "檢索文檔",
      "builder.tool.read_document": "讀取文檔",
      "builder.tool.list_documents": "列出文檔",
      "builder.tool.write_file": "寫入檔案",
      "builder.tool.patch_file": "修改檔案",
      "builder.tool.read_file": "讀取檔案",
      "builder.tool.delete_file": "刪除檔案",
      "builder.tool.get_manifest": "檢視檔案清單",
      "builder.tool.finalize": "完成生成",
      "builder.question.multi": "多選",
      "builder.upload.title": "上傳文字檔（隨訊息發送給 AI）",
      "builder.upload.unsupported":
        "不支援的檔案類型：{name}（僅支援常見文字檔，如 md/txt/json/py）",
      "builder.upload.tooLarge": "{name} 超過 {max} 的單檔大小限制",
      "builder.upload.readFail": "讀取檔案失敗：{name}",
      "builder.progress.request": "請求參數",
      "builder.progress.result": "返回結果",
      // 主題
      "builder.theme.auto": "跟隨系統",
      "builder.theme.light": "淺色",
      "builder.theme.dark": "深色",
      "builder.oledToggle": "OLED 純黑模式（暗色主題下生效）",
      "builder.webFetch.toggle": "允許 AI 聯網請求（web_fetch）",
      // 歡迎頁
      "builder.welcomeTitle": "ErisPulse Builder",
      "builder.welcomeSubtitle":
        "我是小eris，告訴我你想構建的模組或適配器，我來查文件、寫程式碼，還能在瀏覽器裡的真實 ErisPulse 實例中直接試執行。",
      "builder.tip1": "做一個簽到模組，每天固定時間發一則訊息",
      "builder.tip2": "寫一個複讀機模組，收到什麼就回覆什麼",
      "builder.tip3": "幫我開發一個對接 OneBot v11 的適配器",
      "builder.tip4": "做一個關鍵字自動回覆模組，支援多關鍵字群組",
      // 複製
      "builder.copy": "複製",
      "builder.copied": "已複製",
      // 實例控制台（瀏覽器內 ErisPulse 沙箱）
      "builder.instance.title": "實例控制台",
      "builder.instance.openPanel": "實例控制台",
      "builder.instance.chipTitle":
        "瀏覽器內 ErisPulse 實例狀態，點擊開啟控制台",
      "builder.instance.state.off": "實例未啟動",
      "builder.instance.state.allocating": "正在分配空間",
      "builder.instance.state.downloading": "正在下載執行時",
      "builder.instance.state.installing": "正在安裝執行環境",
      "builder.instance.state.ready": "實例就緒",
      "builder.instance.state.running": "執行中",
      "builder.instance.state.busy": "執行中",
      "builder.instance.state.error": "實例錯誤",
      "builder.instance.boot": "啟動實例",
      "builder.instance.stop": "停止",
      "builder.instance.reload": "重載模組",
      "builder.instance.clearLogs": "清空日誌",
      "builder.instance.simulateTitle": "模擬使用者訊息（以 mock 平台私訊注入）",
      "builder.instance.eventPlaceholder": "輸入一則測試訊息，如：你好",
      "builder.instance.sendEvent": "注入",
      "builder.instance.logsTitle": "執行日誌",
      "builder.instance.emptyLogs": "暫無日誌",
      "builder.instance.sentTitle": "實例發出的訊息",
      "builder.instance.emptySent": "暫無訊息",
      "builder.instance.note":
        "瀏覽器內透過 WebAssembly 執行真實 ErisPulse 框架（首次啟動需下載執行時並安裝依賴，約 20-40MB，之後走瀏覽器快取）。模組收發訊息全部經由 MockAdapter 在本地完成，不存取任何網路。",
      "builder.instance.needFiles":
        "目前沒有已生成的檔案，請先讓 AI 生成模組程式碼。",
      "builder.instance.bootFirst": "請先啟動實例。",
      "builder.instance.busy": "實例正在執行其他任務，請稍候。",
      "builder.instance.bootDone": "實例已就緒，模組已載入。",
      "builder.instance.reloadDone": "模組已重載並重新執行。",
      "builder.instance.stopped": "實例已停止，環境已釋放。",
      "builder.instance.eventSent": "事件已注入。",
      "builder.instance.eventInvalid": "事件格式無效，請檢查 JSON。",
      "builder.instance.bootFail": "實例啟動失敗",
      "builder.instance.progress.space": "正在分配虛擬磁碟與設定目錄…",
      "builder.instance.progress.runtime":
        "正在下載 Python 執行時（WebAssembly）…",
      "builder.instance.progress.pip":
        "正在安裝 ErisPulse 及依賴（aiohttp / fastapi / rich …）…",
      "builder.instance.progress.sdk":
        "正在初始化 ErisPulse 實例（載入模組與 MockAdapter）…",
      "builder.instance.progress.deploy": "正在部署生成檔案並重載模組…",
      "builder.instance.report.logs": "執行日誌",
      "builder.instance.report.errors": "錯誤",
      "builder.instance.report.sent": "實例發出的訊息",
      "builder.instance.report.none": "（無）",
      "builder.instance.report.ok": "執行完成，未捕捉異常",
      "builder.instance.report.fail": "執行完成，捕捉到異常",
      "builder.tool.run_module": "實例試執行",
      "builder.tool.exec_python": "實例內執行",
      "builder.tool.install_packages": "安裝依賴",
      // 新手引導
      "builder.onboarding.welcomeTitle": "歡迎使用 ErisPulse Builder",
      "builder.onboarding.welcomeDesc":
        "用自然語言描述需求，AI 會查閱 ErisPulse 官方文件，生成完整的模組/適配器程式碼，還能在瀏覽器內的真實 ErisPulse 實例中直接試執行。開始之前，先設定一個 OpenAI 相容的模型 API。",
      "builder.onboarding.configTitle": "設定模型",
      "builder.onboarding.configDesc":
        "填寫任意 OpenAI 相容 API（OpenAI / DeepSeek / Kimi / 本地 Ollama 等）。金鑰僅儲存在本機瀏覽器。",
      "builder.onboarding.next": "開始設定",
      "builder.onboarding.back": "上一步",
      "builder.onboarding.finish": "完成",
      "builder.onboarding.skip": "稍後再說",
      "builder.onboarding.test": "測試連線",
      "builder.onboarding.testing": "測試中…",
      "builder.onboarding.testOk": "連線成功",
      "builder.onboarding.testFail": "連線失敗",
      "builder.onboarding.privacy":
        "全部資料僅存於瀏覽器 localStorage，不上傳任何伺服器。",
      "common.loading": "載入中…",
      "nav.backHome": "返回 ErisPulse 官網",
      "nav.openSource": "GitHub",
      "common.save": "儲存",
      "common.cancel": "取消",
      "builder.mcpServers": "MCP 服務",
      "builder.mcpRestore": "恢復預設",
      "builder.mcpRestoreConfirm": "將 MCP 服務列表恢復為預設（僅保留 ErisPulse 文件）？",
      "builder.mcpRestoreDone": "已恢復預設 MCP 服務",
      "builder.mcpAdd": "新增 MCP 服務",
      "builder.mcpName": "服務名稱",
      "builder.mcpUrlPlaceholder": "https://...",
      "builder.mcpDeleteConfirm": "確定刪除 MCP 服務「{name}」？",
      "builder.mcpUntitled": "未命名服務",
      "builder.knowledgeBase": "知識庫",
      "builder.knowledgeBaseEmpty": "尚未新增知識",
      "builder.knowledgeBaseDeleteConfirm": "確定刪除知識「{title}」？",
      "builder.kbAddText": "新增文字",
      "builder.kbImportFile": "匯入檔案",
      "builder.kbTitle": "知識標題",
      "builder.kbContent": "知識內容（貼上文字）",
      "builder.kbUntitled": "未命名知識",
      "builder.undo": "復原",
      "builder.redo": "重做",
      "builder.undoDone": "已復原",
      "builder.redoDone": "已重做",
      "builder.configSection": "設定",
    },

    ja: {
      "builder.config": "モデル設定",
      "builder.apiUrl": "API アドレス",
      "builder.apiUrlPlaceholder": "https://api.openai.com/v1",
      "builder.apiKey": "API Key",
      "builder.apiKeyPlaceholder": "sk-...",
      "builder.model": "モデル",
      "builder.modelPlaceholder": "gpt-4o",
      "builder.persistKey": "キーを記憶（ローカルのみ）",
      "builder.showKey": "キーの表示/非表示",
      "builder.docsSource": "ドキュメントキャッシュ",
      "builder.docsStatusReady": "準備完了",
      "builder.docsStatusEmpty": "未読込",
      "builder.docsStatusLoading": "読込中…",
      "builder.loadDocs": "ドキュメントを読込/更新",
      "builder.docsHint":
        "公式ドキュメントを読み込むと、AI が検索ツールで SDK の使い方を調べ、より正確なコードを生成できます。",
      "builder.docsLoaded": "{n} 件のドキュメントを読み込みました",
      "builder.generatedFiles": "生成ファイル",
      "builder.noFiles": "生成ファイルなし",
      "builder.viewAll": "すべて表示",
      "builder.downloadZip": "ZIP ダウンロード",
      "builder.sessions": "セッション",
      "builder.newSession": "新規セッション",
      "builder.newChat": "新しいチャット",
      "builder.themeToggle": "テーマ切替",
      "builder.noSessions": "セッションなし",
      "builder.exportSessions": "セッションをエクスポート",
      "builder.exportCurrent": "現在のセッションをエクスポート",
      "builder.exportAll": "すべてのセッションをエクスポート",
      "builder.importSessions": "セッションをインポート",
      "builder.importSuccess": "{n} 件のセッションをインポートしました",
      "builder.error.noActiveSession": "エクスポート対象のセッションがありません",
      "builder.error.importRead": "ファイルを読み込めません",
      "builder.error.importParse": "ファイルは有効な JSON ではありません",
      "builder.error.importFormat": "ファイル形式が正しくありません",
      "builder.error.importEmpty": "インポート可能なセッションが見つかりません",
      "builder.deleteSessionConfirm":
        "このセッションを削除しますか？会話と生成ファイルは消去されます。",
      "builder.session.today": "今日",
      "builder.session.yesterday": "昨日",
      "builder.session.withinWeek": "7 日以内",
      "builder.session.earlier": "より前",
      "builder.renameSession": "セッション名を変更",
      "builder.clearAllSessions": "全セッションを削除",
      "builder.clearAllConfirm":
        "すべてのセッションを削除しますか？会話と生成ファイルも削除され、元に戻せません。",
      "builder.title": "AI モジュールビルダー",
      "builder.subtitle":
        "要件を伝えると、AI がドキュメントを参照して完全な ErisPulse モジュールコードを生成・パッケージ化します",
      "builder.clear": "クリア",
      "builder.menu": "メニュー",
      "builder.inputPlaceholder": "構築したい ErisPulse モジュール / アダプタを記述...",
      "builder.inputPlaceholderPlan": "要件を説明するか質問に答えてください…",
      "builder.inputPlaceholderGenerate": "補足説明…",
      "builder.send": "送信",
      "builder.sending": "生成中…",
      "builder.stop": "停止",
      "builder.stopped": "生成を停止しました。",
      "builder.writing": "書き込み中…",
      "builder.question.custom": "自由入力…",
      "builder.question.ok": "OK",
      "builder.question.submitAll": "すべて回答を送信",
      "builder.confirmCancel": "キャンセル",
      "builder.confirmOk": "OK",
      "builder.tool.ask_question": "質問",
      "builder.tool.confirm_start": "開始確認",
      "builder.tool.web_fetch": "Web取得",
      "builder.webFetch.confirm":
        "AI が外部 URL へのリクエスト（web_fetch）を試みています。許可しますか？",
      "builder.webFetch.remember": "選択を記憶して今後確認しない",
      "builder.webFetch.disabled":
        "Webリクエストは設定で無効になっています。",
      "builder.webFetch.denied":
        "ユーザーがこのリクエストを拒否しました。search_docs を使うか、ユーザーに内容の提供を依頼してください。",
      "builder.webFetch.cors":
        "ブラウザの CORS ポリシーによりブロックされた可能性があります",
      "builder.webFetch.fallback":
        "別の情報源（search_docs など）を使うか、ユーザーに内容の貼り付けを依頼してください。",
      "builder.confirmStartMsg": "資料が整いました。生成を開始しますか？",
      "builder.startCommand": "開始",
      "builder.docsInitHint":
        "ドキュメントインデックスを初期化中です。時間がかかる場合があります…",
      "builder.settingsTitle": "AI モジュールビルダー",
      "builder.settingsDesc":
        "ビルダーが使用する OpenAI 互換 API を設定します（ドメインのみ可、/chat/completions は自動補完）。",
      "builder.settingsPrivacy":
        "すべてのデータ（設定、セッション、生成ファイル）はブラウザに保存され、サーバーには送信されません。オープンソース。",
      "builder.settingsConfigBtn": "設定",
      "builder.sendMode.enter": "Enter",
      "builder.sendMode.ctrlEnter": "Ctrl+Enter",
      "builder.sendModeTitle": "送信キー切替",
      "builder.phase.plan": "プラン",
      "builder.phase.generate": "生成",
      "builder.phaseSwitched":
        "生成フェーズに切り替わりました。AI がファイルを書き込めるようになりました",
      "builder.phaseSwitchedToPlan": "プランニングフェーズに切り替わりました。AI は文書の参照のみ可能です",
      "builder.welcome":
        "### AI モジュールビルダー\n\n**小eris**です。ErisPulse 公式の AI モジュール構築アシスタントです。\n\n2 ステップでモジュールを構築します：\n\n1. **プランニング**——作りたいものを教えてください。公式ドキュメントを参照し、プランをご提案します\n2. **生成**——プランが決まったら「**開始**」と送信してください。生成フェーズに切り替わり、完全なソースコードを生成します\n\n左下の「**設定**」アイコンから API アドレスとモデルを設定してください。",
      "builder.done": "生成完了。「ZIP をダウンロード」でモジュールパッケージを取得できます",
      "builder.error.noApiUrl": "API アドレスを入力してください",
      "builder.error.noApiKey": "API Key を入力してください",
      "builder.error.noModel": "モデル名を入力してください",
      "builder.error.noConfig": "先に「モデルを設定」で API アドレスとモデルを設定してください",
      "builder.error.network": "ネットワークエラー",
      "builder.error.apiError": "API エラー",
      "builder.error.docsLoad": "ドキュメント読込失敗",
      "builder.error.zip": "ZIP 作成失敗",
      "builder.error.clearConfirm": "すべての会話と生成ファイルを消去しますか？",
      "builder.tool.search_docs": "ドキュメント検索",
      "builder.tool.read_document": "ドキュメント読込",
      "builder.tool.list_documents": "ドキュメント一覧",
      "builder.tool.write_file": "ファイル書込",
      "builder.tool.patch_file": "ファイル修正",
      "builder.tool.read_file": "ファイル読込",
      "builder.tool.delete_file": "ファイル削除",
      "builder.tool.get_manifest": "ファイル一覧",
      "builder.tool.finalize": "生成完了",
      "builder.question.multi": "複数選択",
      "builder.upload.title": "テキストファイルをアップロード（メッセージと共に AI に送信）",
      "builder.upload.unsupported":
        "未対応のファイル形式：{name}（md/txt/json/py など一般的なテキストのみ対応）",
      "builder.upload.tooLarge": "{name} が {max} のサイズ上限を超えています",
      "builder.upload.readFail": "ファイルの読込に失敗しました：{name}",
      "builder.progress.request": "リクエスト",
      "builder.progress.result": "レスポンス",
      // テーマ
      "builder.theme.auto": "システムに従う",
      "builder.theme.light": "ライト",
      "builder.theme.dark": "ダーク",
      "builder.oledToggle": "OLED 純黒モード（ダークテーマ時有効）",
      "builder.webFetch.toggle": "AI の Web リクエストを許可（web_fetch）",
      // ウェルカム
      "builder.welcomeTitle": "ErisPulse Builder",
      "builder.welcomeSubtitle":
        "私は小eris。作りたいモジュールやアダプタを教えてください。ドキュメントを調べ、コードを書き、ブラウザ内の本物の ErisPulse インスタンスで直接テスト実行までできます。",
      "builder.tip1": "毎日決まった時間にメッセージを送るチェックインモジュール",
      "builder.tip2": "受け取った内容をそのまま返すエコーモジュール",
      "builder.tip3": "OneBot v11 対応アダプタの開発を手伝って",
      "builder.tip4": "複数キーワードグループ対応の自動応答モジュール",
      // コピー
      "builder.copy": "コピー",
      "builder.copied": "コピーしました",
      // インスタンスコンソール（ブラウザ内 ErisPulse サンドボックス）
      "builder.instance.title": "インスタンスコンソール",
      "builder.instance.openPanel": "インスタンスコンソール",
      "builder.instance.chipTitle":
        "ブラウザ内 ErisPulse インスタンスの状態。クリックでコンソールを開く",
      "builder.instance.state.off": "インスタンス未起動",
      "builder.instance.state.allocating": "スペースを割り当て中",
      "builder.instance.state.downloading": "ランタイムをダウンロード中",
      "builder.instance.state.installing": "環境をインストール中",
      "builder.instance.state.ready": "インスタンス準備完了",
      "builder.instance.state.running": "実行中",
      "builder.instance.state.busy": "処理中",
      "builder.instance.state.error": "インスタンスエラー",
      "builder.instance.boot": "インスタンス起動",
      "builder.instance.stop": "停止",
      "builder.instance.reload": "モジュール再読込",
      "builder.instance.clearLogs": "ログクリア",
      "builder.instance.simulateTitle":
        "ユーザーメッセージをシミュレート（mock プラットフォームの DM として注入）",
      "builder.instance.eventPlaceholder": "テストメッセージを入力（例：こんにちは）",
      "builder.instance.sendEvent": "注入",
      "builder.instance.logsTitle": "実行ログ",
      "builder.instance.emptyLogs": "ログはまだありません",
      "builder.instance.sentTitle": "インスタンスが送信したメッセージ",
      "builder.instance.emptySent": "メッセージはまだありません",
      "builder.instance.note":
        "WebAssembly により本物の ErisPulse フレームワークをブラウザ内で実行します（初回起動時はランタイムと依存関係をダウンロード、約 20-40MB、以後はブラウザキャッシュを使用）。メッセージの送受信はすべてローカルの MockAdapter 経由で、ネットワークにはアクセスしません。",
      "builder.instance.needFiles":
        "生成されたファイルがありません。先に AI にモジュールコードを生成させてください。",
      "builder.instance.bootFirst": "先にインスタンスを起動してください。",
      "builder.instance.busy": "インスタンスは他のタスクを実行中です。",
      "builder.instance.bootDone": "インスタンスの準備ができました。モジュール読込済み。",
      "builder.instance.reloadDone": "モジュールを再読込し、再起動しました。",
      "builder.instance.stopped": "インスタンスを停止し、環境を解放しました。",
      "builder.instance.eventSent": "イベントを注入しました。",
      "builder.instance.eventInvalid": "イベント JSON の形式が無効です。",
      "builder.instance.bootFail": "インスタンスの起動に失敗しました",
      "builder.instance.progress.space": "仮想ディスクと設定を準備中…",
      "builder.instance.progress.runtime":
        "Python ランタイム（WebAssembly）をダウンロード中…",
      "builder.instance.progress.pip":
        "ErisPulse と依存関係をインストール中（aiohttp / fastapi / rich …）…",
      "builder.instance.progress.sdk":
        "ErisPulse インスタンスを初期化中（モジュールと MockAdapter の読込）…",
      "builder.instance.progress.deploy": "生成ファイルを配置して再読込中…",
      "builder.instance.report.logs": "実行ログ",
      "builder.instance.report.errors": "エラー",
      "builder.instance.report.sent": "インスタンスが送信したメッセージ",
      "builder.instance.report.none": "（なし）",
      "builder.instance.report.ok": "実行完了、例外なし",
      "builder.instance.report.fail": "実行完了、例外を検出",
      "builder.tool.run_module": "テスト実行",
      "builder.tool.exec_python": "インスタンス内実行",
      "builder.tool.install_packages": "依存関係インストール",
      // オンボーディング
      "builder.onboarding.welcomeTitle": "ErisPulse Builder へようこそ",
      "builder.onboarding.welcomeDesc":
        "自然言語で要件を説明すると、AI が ErisPulse 公式ドキュメントを調べ、完全なモジュール/アダプタコードを生成し、ブラウザ内の本物の ErisPulse インスタンスでテスト実行まで行います。まずは OpenAI 互換のモデル API を設定してください。",
      "builder.onboarding.configTitle": "モデルを設定",
      "builder.onboarding.configDesc":
        "OpenAI 互換 API（OpenAI / DeepSeek / Kimi / ローカル Ollama など）を入力してください。キーはブラウザ内にのみ保存されます。",
      "builder.onboarding.next": "設定を始める",
      "builder.onboarding.back": "戻る",
      "builder.onboarding.finish": "完了",
      "builder.onboarding.skip": "後で",
      "builder.onboarding.test": "接続テスト",
      "builder.onboarding.testing": "テスト中…",
      "builder.onboarding.testOk": "接続成功",
      "builder.onboarding.testFail": "接続失敗",
      "builder.onboarding.privacy":
        "すべてのデータはブラウザの localStorage にのみ保存され、サーバーには送信されません。",
      "common.loading": "読込中…",
      "nav.backHome": "ErisPulse 公式サイトへ",
      "nav.openSource": "GitHub",
      "common.save": "保存",
      "common.cancel": "キャンセル",
      "builder.mcpServers": "MCP サービス",
      "builder.mcpRestore": "デフォルトに戻す",
      "builder.mcpRestoreConfirm": "MCP サービス一覧をデフォルトに戻しますか？（ErisPulse 文書のみ）",
      "builder.mcpRestoreDone": "デフォルトの MCP サービスを復元しました",
      "builder.mcpAdd": "MCP サービスを追加",
      "builder.mcpName": "サービス名",
      "builder.mcpUrlPlaceholder": "https://...",
      "builder.mcpDeleteConfirm": "MCP サービス「{name}」を削除しますか？",
      "builder.mcpUntitled": "無名サービス",
      "builder.knowledgeBase": "ナレッジベース",
      "builder.knowledgeBaseEmpty": "まだ知識がありません",
      "builder.knowledgeBaseDeleteConfirm": "知識「{title}」を削除しますか？",
      "builder.kbAddText": "テキストを追加",
      "builder.kbImportFile": "ファイルをインポート",
      "builder.kbTitle": "タイトル",
      "builder.kbContent": "内容（テキストを貼り付け）",
      "builder.kbUntitled": "無題",
      "builder.undo": "元に戻す",
      "builder.redo": "やり直し",
      "builder.undoDone": "元に戻しました",
      "builder.redoDone": "やり直しました",
      "builder.configSection": "設定",
    },

    ru: {
      "builder.config": "Настройки модели",
      "builder.apiUrl": "API-адрес",
      "builder.apiUrlPlaceholder": "https://api.openai.com/v1",
      "builder.apiKey": "API Key",
      "builder.apiKeyPlaceholder": "sk-...",
      "builder.model": "Модель",
      "builder.modelPlaceholder": "gpt-4o",
      "builder.persistKey": "Запомнить ключ (локально)",
      "builder.showKey": "Показать/скрыть ключ",
      "builder.docsSource": "Кэш документации",
      "builder.docsStatusReady": "Готово",
      "builder.docsStatusEmpty": "Не загружено",
      "builder.docsStatusLoading": "Загрузка…",
      "builder.loadDocs": "Загрузить/обновить документацию",
      "builder.docsHint":
        "После загрузки официальной документации AI сможет искать использование SDK и генерировать более точный код.",
      "builder.docsLoaded": "Загружено документов: {n}",
      "builder.generatedFiles": "Сгенерированные файлы",
      "builder.noFiles": "Файлов пока нет",
      "builder.viewAll": "Все",
      "builder.downloadZip": "Скачать ZIP",
      "builder.sessions": "Сессии",
      "builder.newSession": "Новая",
      "builder.newChat": "Новый чат",
      "builder.themeToggle": "Сменить тему",
      "builder.noSessions": "Нет сессий",
      "builder.exportSessions": "Экспорт сессий",
      "builder.exportCurrent": "Экспорт текущей сессии",
      "builder.exportAll": "Экспорт всех сессий",
      "builder.importSessions": "Импорт сессий",
      "builder.importSuccess": "Импортировано сессий: {n}",
      "builder.error.noActiveSession": "Нет активной сессии для экспорта",
      "builder.error.importRead": "Не удалось прочитать файл",
      "builder.error.importParse": "Файл не является корректным JSON",
      "builder.error.importFormat": "Неверный формат файла",
      "builder.error.importEmpty": "В файле нет сессий для импорта",
      "builder.deleteSessionConfirm":
        "Удалить эту сессию? Диалог и сгенерированные файлы будут удалены.",
      "builder.session.today": "Сегодня",
      "builder.session.yesterday": "Вчера",
      "builder.session.withinWeek": "За 7 дней",
      "builder.session.earlier": "Ранее",
      "builder.renameSession": "Переименовать сессию",
      "builder.clearAllSessions": "Очистить все сессии",
      "builder.clearAllConfirm":
        "Очистить все сессии? Все диалоги и созданные файлы будут удалены безвозвратно.",
      "builder.title": "Конструктор модулей",
      "builder.subtitle":
        "Опишите задачу; AI изучит документацию и сгенерирует полный модуль ErisPulse для скачивания",
      "builder.clear": "Очистить",
      "builder.menu": "Меню",
      "builder.inputPlaceholder": "Опишите модуль / адаптер ErisPulse, который хотите создать...",
      "builder.inputPlaceholderPlan": "Опишите задачу или ответьте на вопросы…",
      "builder.inputPlaceholderGenerate": "Дополните…",
      "builder.send": "Отправить",
      "builder.sending": "Генерация…",
      "builder.stop": "Стоп",
      "builder.stopped": "Генерация остановлена.",
      "builder.writing": "Запись…",
      "builder.question.custom": "Свой ответ…",
      "builder.question.ok": "OK",
      "builder.question.submitAll": "Отправить все ответы",
      "builder.confirmCancel": "Отмена",
      "builder.confirmOk": "OK",
      "builder.tool.ask_question": "Вопрос",
      "builder.tool.confirm_start": "Подтвердить старт",
      "builder.tool.web_fetch": "Веб-запрос",
      "builder.webFetch.confirm":
        "ИИ запрашивает доступ к внешнему URL (web_fetch). Разрешить этот запрос?",
      "builder.webFetch.remember": "Запомнить и больше не спрашивать",
      "builder.webFetch.disabled":
        "Веб-запросы отключены в настройках.",
      "builder.webFetch.denied":
        "Пользователь отклонил этот веб-запрос. Используйте search_docs или попросите пользователя предоставить содержимое.",
      "builder.webFetch.cors":
        "возможно, заблокировано политикой CORS браузера",
      "builder.webFetch.fallback":
        "Используйте другой источник (например search_docs) или попросите пользователя вставить содержимое.",
      "builder.confirmStartMsg": "Материалы готовы. Начать генерацию?",
      "builder.startCommand": "начать",
      "builder.docsInitHint":
        "Инициализация индекса документации, это может занять время…",
      "builder.settingsTitle": "Конструктор модулей",
      "builder.settingsDesc":
        "Настройте OpenAI-совместимый API для конструктора (можно указать домен, /chat/completions добавится автоматически).",
      "builder.settingsPrivacy":
        "Все данные (настройки, сессии, сгенерированные файлы) хранятся локально в браузере и не передаются на сервер. Открытый исходный код.",
      "builder.settingsConfigBtn": "Настройки",
      "builder.sendMode.enter": "Enter",
      "builder.sendMode.ctrlEnter": "Ctrl+Enter",
      "builder.sendModeTitle": "Выбор клавиши отправки",
      "builder.phase.plan": "План",
      "builder.phase.generate": "Генерация",
      "builder.phaseSwitched":
        "Переключено в режим генерации. AI теперь может записывать файлы.",
      "builder.phaseSwitchedToPlan": "Переключено в режим планирования. AI может только читать документацию.",
      "builder.welcome":
        "### Конструктор модулей\n\nЯ **Сяо-эрис**, официальный помощник ErisPulse по созданию модулей.\n\nЯ помогу собрать модуль в два шага:\n\n1. **Планирование**——расскажите, что хотите создать; я изучу документацию и предложу план\n2. **Генерация**——когда план готов, отправьте «**начать**», и я сгенерирую полный исходный код\n\nНажмите на значок «**Настройки**» в левом нижнем углу, чтобы указать API-адрес и модель.",
      "builder.done": "Готово. Нажмите «Скачать ZIP», чтобы получить пакет модуля",
      "builder.error.noApiUrl": "Укажите API-адрес",
      "builder.error.noApiKey": "Укажите API Key",
      "builder.error.noModel": "Укажите название модели",
      "builder.error.noConfig": "Сначала настройте API-адрес и модель в «Настроить модель»",
      "builder.error.network": "Ошибка сети",
      "builder.error.apiError": "Ошибка API",
      "builder.error.docsLoad": "Ошибка загрузки документации",
      "builder.error.zip": "Ошибка упаковки",
      "builder.error.clearConfirm": "Очистить все диалоги и сгенерированные файлы?",
      "builder.tool.search_docs": "Поиск в док.",
      "builder.tool.read_document": "Чтение док.",
      "builder.tool.list_documents": "Список док.",
      "builder.tool.write_file": "Запись файла",
      "builder.tool.patch_file": "Изменить файл",
      "builder.tool.read_file": "Чтение файла",
      "builder.tool.delete_file": "Удалить файл",
      "builder.tool.get_manifest": "Список файлов",
      "builder.tool.finalize": "Завершить",
      "builder.question.multi": "Мультивыбор",
      "builder.upload.title": "Загрузить текстовый файл (отправляется ИИ с сообщением)",
      "builder.upload.unsupported":
        "Неподдерживаемый тип файла: {name} (только распространённые текстовые файлы, например md/txt/json/py)",
      "builder.upload.tooLarge": "{name} превышает лимит размера файла {max}",
      "builder.upload.readFail": "Не удалось прочитать файл: {name}",
      "builder.progress.request": "Запрос",
      "builder.progress.result": "Результат",
      // Тема
      "builder.theme.auto": "Как в системе",
      "builder.theme.light": "Светлая",
      "builder.theme.dark": "Тёмная",
      "builder.oledToggle": "Чёрный режим OLED (действует в тёмной теме)",
      "builder.webFetch.toggle": "Разрешить веб-запросы ИИ (web_fetch)",
      // Приветствие
      "builder.welcomeTitle": "ErisPulse Builder",
      "builder.welcomeSubtitle":
        "Я Сяоэрис. Расскажите, какой модуль или адаптер нужно создать — я изучу документацию, напишу код и даже протестирую его в настоящем экземпляре ErisPulse прямо в браузере.",
      "builder.tip1": "Модуль ежедневной отметки с сообщением в фиксированное время",
      "builder.tip2": "Эхо-модуль, который отвечает тем, что получил",
      "builder.tip3": "Помоги разработать адаптер для OneBot v11",
      "builder.tip4": "Модуль автоответа по ключевым словам с несколькими группами",
      // Копирование
      "builder.copy": "Копировать",
      "builder.copied": "Скопировано",
      // Консоль экземпляра (песочница ErisPulse в браузере)
      "builder.instance.title": "Консоль экземпляра",
      "builder.instance.openPanel": "Консоль экземпляра",
      "builder.instance.chipTitle":
        "Состояние экземпляра ErisPulse в браузере — нажмите, чтобы открыть консоль",
      "builder.instance.state.off": "Экземпляр не запущен",
      "builder.instance.state.allocating": "Выделение пространства",
      "builder.instance.state.downloading": "Загрузка среды выполнения",
      "builder.instance.state.installing": "Установка окружения",
      "builder.instance.state.ready": "Экземпляр готов",
      "builder.instance.state.running": "Работает",
      "builder.instance.state.busy": "Выполняется",
      "builder.instance.state.error": "Ошибка экземпляра",
      "builder.instance.boot": "Запустить экземпляр",
      "builder.instance.stop": "Остановить",
      "builder.instance.reload": "Перезагрузить модули",
      "builder.instance.clearLogs": "Очистить журнал",
      "builder.instance.simulateTitle":
        "Симуляция сообщения пользователя (инъекция как ЛС платформы mock)",
      "builder.instance.eventPlaceholder": "Введите тестовое сообщение, напр. привет",
      "builder.instance.sendEvent": "Ввести",
      "builder.instance.logsTitle": "Журнал выполнения",
      "builder.instance.emptyLogs": "Журнал пуст",
      "builder.instance.sentTitle": "Сообщения, отправленные экземпляром",
      "builder.instance.emptySent": "Сообщений пока нет",
      "builder.instance.note":
        "Настоящий фреймворк ErisPulse выполняется в браузере через WebAssembly (при первом запуске загружаются среда выполнения и зависимости, ~20-40 МБ, далее используется кэш браузера). Весь обмен сообщениями идёт через локальный MockAdapter, без доступа к сети.",
      "builder.instance.needFiles":
        "Пока нет сгенерированных файлов. Сначала попросите ИИ создать код модуля.",
      "builder.instance.bootFirst": "Сначала запустите экземпляр.",
      "builder.instance.busy": "Экземпляр занят другой задачей.",
      "builder.instance.bootDone": "Экземпляр готов, модули загружены.",
      "builder.instance.reloadDone": "Модули перезагружены и перезапущены.",
      "builder.instance.stopped": "Экземпляр остановлен, окружение освобождено.",
      "builder.instance.eventSent": "Событие введено.",
      "builder.instance.eventInvalid": "Неверный формат JSON события.",
      "builder.instance.bootFail": "Не удалось запустить экземпляр",
      "builder.instance.progress.space": "Выделение виртуального диска и настройка…",
      "builder.instance.progress.runtime":
        "Загрузка среды Python (WebAssembly)…",
      "builder.instance.progress.pip":
        "Установка ErisPulse и зависимостей (aiohttp / fastapi / rich …)…",
      "builder.instance.progress.sdk":
        "Инициализация экземпляра ErisPulse (загрузка модулей и MockAdapter)…",
      "builder.instance.progress.deploy": "Развёртывание файлов и перезагрузка…",
      "builder.instance.report.logs": "Журнал",
      "builder.instance.report.errors": "Ошибки",
      "builder.instance.report.sent": "Отправленные экземпляром сообщения",
      "builder.instance.report.none": "(нет)",
      "builder.instance.report.ok": "Выполнено без исключений",
      "builder.instance.report.fail": "Выполнено, есть исключения",
      "builder.tool.run_module": "Тестовый запуск",
      "builder.tool.exec_python": "Exec в экземпляре",
      "builder.tool.install_packages": "Установить зависимости",
      // Онбординг
      "builder.onboarding.welcomeTitle": "Добро пожаловать в ErisPulse Builder",
      "builder.onboarding.welcomeDesc":
        "Опишите задачу обычным языком — ИИ изучит официальную документацию ErisPulse, сгенерирует полный код модуля/адаптера и протестирует его в настоящем экземпляре ErisPulse в браузере. Для начала настройте API совместимой с OpenAI модели.",
      "builder.onboarding.configTitle": "Настройка модели",
      "builder.onboarding.configDesc":
        "Укажите любой OpenAI-совместимый API (OpenAI / DeepSeek / Kimi / локальный Ollama и т.д.). Ключ хранится только в вашем браузере.",
      "builder.onboarding.next": "Начать настройку",
      "builder.onboarding.back": "Назад",
      "builder.onboarding.finish": "Готово",
      "builder.onboarding.skip": "Позже",
      "builder.onboarding.test": "Проверить соединение",
      "builder.onboarding.testing": "Проверка…",
      "builder.onboarding.testOk": "Соединение установлено",
      "builder.onboarding.testFail": "Ошибка соединения",
      "builder.onboarding.privacy":
        "Все данные хранятся только в localStorage браузера и никуда не отправляются.",
      "common.loading": "Загрузка…",
      "nav.backHome": "На сайт ErisPulse",
      "nav.openSource": "GitHub",
      "common.save": "Сохранить",
      "common.cancel": "Отмена",
      "builder.mcpServers": "MCP сервисы",
      "builder.mcpRestore": "Сброс по умолчанию",
      "builder.mcpRestoreConfirm": "Восстановить список MCP сервисов по умолчанию?",
      "builder.mcpRestoreDone": "MCP сервисы восстановлены по умолчанию",
      "builder.mcpAdd": "Добавить MCP сервис",
      "builder.mcpName": "Название сервиса",
      "builder.mcpUrlPlaceholder": "https://...",
      "builder.mcpDeleteConfirm": "Удалить MCP сервис «{name}»?",
      "builder.mcpUntitled": "Безымянный сервис",
      "builder.knowledgeBase": "База знаний",
      "builder.knowledgeBaseEmpty": "Пока нет записей",
      "builder.knowledgeBaseDeleteConfirm": "Удалить запись «{title}»?",
      "builder.kbAddText": "Добавить текст",
      "builder.kbImportFile": "Импорт файла",
      "builder.kbTitle": "Заголовок",
      "builder.kbContent": "Содержание (вставьте текст)",
      "builder.kbUntitled": "Без названия",
      "builder.undo": "Отменить",
      "builder.redo": "Повторить",
      "builder.undoDone": "Отменено",
      "builder.redoDone": "Повторено",
      "builder.configSection": "Настройки",
    },
  };

  /**
   * 获取翻译文本
   */
  function t(key, params) {
    const lang = currentLang;
    let text =
      (messages[lang] && messages[lang][key]) ||
      (messages["zh-CN"] && messages["zh-CN"][key]) ||
      key;

    if (params) {
      Object.keys(params).forEach((k) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
      });
    }

    return text;
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!messages[lang]) {
      console.warn(`Unsupported language: ${lang}`);
      return;
    }
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    applyTranslations();
    return true;
  }

  /**
   * 应用翻译到所有带 data-i18n 属性的元素
   */
  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = t(key);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.title = t(key);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      el.innerHTML = t(key);
    });
  }

  function getLanguageName(lang) {
    const names = {
      "zh-CN": "简体中文",
      en: "English",
      "zh-TW": "繁體中文",
      ja: "日本語",
      ru: "Русский",
    };
    return names[lang] || lang;
  }

  function getSupportedLanguages() {
    return [
      { code: "zh-CN", name: "简体中文" },
      { code: "en", name: "English" },
      { code: "zh-TW", name: "繁體中文" },
      { code: "ja", name: "日本語" },
      { code: "ru", name: "Русский" },
    ];
  }

  function init() {
    applyTranslations();
    document.documentElement.lang = currentLang;
  }

  return {
    t,
    getLang,
    setLang,
    applyTranslations,
    getLanguageName,
    getSupportedLanguages,
    init,
    STORAGE_KEY,
  };
})();
