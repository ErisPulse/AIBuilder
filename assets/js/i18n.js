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
      "builder.writing": "正在写入…",
      "builder.question.custom": "自定义答案...",
      "builder.question.ok": "确定",
      "builder.question.submitAll": "提交全部回答",
      "builder.confirmCancel": "取消",
      "builder.confirmOk": "确定",
      "builder.tool.ask_question": "提问",
      "builder.tool.confirm_start": "确认开始",
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
        "### AI 模块构建器\n\n我是**小eris**，ErisPulse 官方的 AI 模块构建助手。\n\n我会分两步帮你构建模块：\n\n1. **规划阶段**——告诉我你想构建什么，我会查阅官方文档并与你讨论方案\n2. **生成阶段**——方案确定后，发送「**开始**」进入生成阶段，我会生成完整源码\n\n请先点击右上角「**配置模型**」填写 API 地址与模型。",
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
      "builder.writing": "Writing…",
      "builder.question.custom": "Custom answer...",
      "builder.question.ok": "OK",
      "builder.question.submitAll": "Submit all answers",
      "builder.confirmCancel": "Cancel",
      "builder.confirmOk": "OK",
      "builder.tool.ask_question": "Ask",
      "builder.tool.confirm_start": "Confirm start",
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
        "### AI Module Builder\n\nI'm **Xiao-eris**, the official ErisPulse AI module builder assistant.\n\nI'll help you build a module in two steps:\n\n1. **Planning**—tell me what you want to build; I'll consult the docs and discuss a plan with you\n2. **Generation**—once the plan is settled, send “**start**” to enter the generation phase and I'll produce the full source\n\nClick “**Configure model**” in the top-right to set the API URL and model.",
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
        "### AI 模組構建器\n\n我是**小eris**，ErisPulse 官方的 AI 模組構建助手。\n\n我會分兩步幫你構建模組：\n\n1. **規劃階段**——告訴我你想構建什麼，我會查閱官方文檔並與你討論方案\n2. **生成階段**——方案確定後，發送「**開始**」進入生成階段，我會生成完整原始碼\n\n請先點擊右上角「**設定模型**」填寫 API 位址與模型。",
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
      "builder.writing": "書き込み中…",
      "builder.question.custom": "自由入力…",
      "builder.question.ok": "OK",
      "builder.question.submitAll": "すべて回答を送信",
      "builder.confirmCancel": "キャンセル",
      "builder.confirmOk": "OK",
      "builder.tool.ask_question": "質問",
      "builder.tool.confirm_start": "開始確認",
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
        "### AI モジュールビルダー\n\n**小eris**です。ErisPulse 公式の AI モジュール構築アシスタントです。\n\n2 ステップでモジュールを構築します：\n\n1. **プランニング**——作りたいものを教えてください。公式ドキュメントを参照し、プランをご提案します\n2. **生成**——プランが決まったら「**開始**」と送信してください。生成フェーズに切り替わり、完全なソースコードを生成します\n\n右上の「**モデルを設定**」で API アドレスとモデルを設定してください。",
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
      "builder.writing": "Запись…",
      "builder.question.custom": "Свой ответ…",
      "builder.question.ok": "OK",
      "builder.question.submitAll": "Отправить все ответы",
      "builder.confirmCancel": "Отмена",
      "builder.confirmOk": "OK",
      "builder.tool.ask_question": "Вопрос",
      "builder.tool.confirm_start": "Подтвердить старт",
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
        "### Конструктор модулей\n\nЯ **Сяо-эрис**, официальный помощник ErisPulse по созданию модулей.\n\nЯ помогу собрать модуль в два шага:\n\n1. **Планирование**——расскажите, что хотите создать; я изучу документацию и предложу план\n2. **Генерация**——когда план готов, отправьте «**начать**», и я сгенерирую полный исходный код\n\nНажмите «**Настроить модель**» в правом верхнем углу, чтобы указать API-адрес и модель.",
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
