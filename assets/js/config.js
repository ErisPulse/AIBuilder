






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
  },

   
  DEFAULT_USER_SETTINGS: {
    version: "1.0",
    theme: "dark",
     
    builder: {
      api_url: "",
      api_key: "",
      model: "",
      persistKey: true,
      sendMode: "enter",
       
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
