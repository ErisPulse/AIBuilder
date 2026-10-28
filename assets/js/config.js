/**
 * ErisPulse Builder — 独立站点配置
 *
 * 文档检索通过 ErisPulse 官方 MCP Server（mcp.erisdev.com）完成，
 * 不再在客户端本地缓存/索引文档。
 */

export const CONFIG = {
  // 站点信息
  SITE: {
    name: "ErisPulse Builder",
    description: "ErisPulse AI 模块构建器",
    version: "2.0.0",
    // 官网地址，用于“返回官网”与图片等静态资源引用
    url: "https://www.erisdev.com",
    github: "https://github.com/ErisPulse",
  },

  // 静态资源（头像/图标）直接引用官网，避免在本仓库复制二进制
  ASSETS: {
    // builder 头像（小eris 看板娘）
    erisAvatar: "https://www.erisdev.com/assets/img/eris.png",
  },

  // MCP 文档检索服务（Streamable HTTP）
  // 同 IP 限速 50 次/分钟
  MCP: {
    url: "https://mcp.erisdev.com/",
  },

  // 设置版本与存储键（独立命名空间，避免与官网 localStorage 冲突）
  SETTINGS_VERSION: "1.0",
  STORAGE_KEYS: {
    SETTINGS: "erispulse-builder-settings",
    THEME: "erispulse-builder-theme",
    OLED: "erispulse-builder-oled",
  },

  // 浏览器内 ErisPulse 实例（Pyodide 沙箱）
  SANDBOX: {
    // Pyodide 固定版本；依次尝试多个 CDN（主站不可达时回退）
    pyodideVersion: "v0.28.3",
    cdnCandidates: [
      "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
      "https://fastly.jsdelivr.net/pyodide/v0.28.3/full/",
      "https://gcore.jsdelivr.net/pyodide/v0.28.3/full/",
    ],
    bootTimeoutMs: 600000, // 首次启动（下载运行时 + micropip 安装，慢网络可能数分钟）
    opTimeoutMs: 90000, // 单次操作（运行/执行/注入）
    maxLogLines: 600,
  },

  // 默认用户设置（仅保留 builder 相关 + 主题）
  DEFAULT_USER_SETTINGS: {
    version: "1.0",
    theme: "auto",
    // AI 模块构建器配置
    builder: {
      api_url: "",
      api_key: "",
      model: "",
      persistKey: true,
      sendMode: "enter",
      onboarded: false, // 新手引导是否已完成/跳过
      // 联网请求（web_fetch）：开关 + 用户授权记忆
      webTool: true,
      webToolConsent: false,
      // MCP 服务列表（可多个，用户可增删启停）
      mcpServers: [
        {
          id: "builtin-erispulse",
          name: "ErisPulse Docs",
          url: "https://mcp.erisdev.com/",
          enabled: true,
        },
      ],
    },
  },
};
