






export const CONFIG = {
   
  SITE: {
    name: "ErisPulse Builder",
    description: "ErisPulse AI 模块构建器",
    version: "2.0.0",
     
    url: "https://www.erisdev.com",
    github: "https://github.com/ErisPulse",
  },

   
  ASSETS: {
     
    erisAvatar: "https://www.erisdev.com/assets/img/eris.png",
  },

   
   
  MCP: {
    url: "https://mcp.erisdev.com/",
  },

   
  SETTINGS_VERSION: "1.0",
  STORAGE_KEYS: {
    SETTINGS: "erispulse-builder-settings",
    THEME: "erispulse-builder-theme",
    OLED: "erispulse-builder-oled",
  },

   
  SANDBOX: {
     
    pyodideVersion: "v0.28.3",
    cdnCandidates: [
      "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
      "https://fastly.jsdelivr.net/pyodide/v0.28.3/full/",
      "https://gcore.jsdelivr.net/pyodide/v0.28.3/full/",
    ],
    bootTimeoutMs: 600000,  
    opTimeoutMs: 90000,  
    maxLogLines: 600,
  },

   
  DEFAULT_USER_SETTINGS: {
    version: "1.0",
    theme: "auto",
     
    builder: {
      api_url: "",
      api_key: "",
      model: "",
      persistKey: true,
      sendMode: "enter",
      onboarded: false,  
       
      webTool: true,
      webToolConsent: false,
       
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
