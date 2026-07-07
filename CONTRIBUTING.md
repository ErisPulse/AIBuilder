# 贡献指南

欢迎为 ErisPulse AIBuilder 贡献代码！🎉

## 如何贡献

### 报告问题

发现 Bug 或有功能建议？请先到 [Issues](https://github.com/ErisPulse/AIBuilder/issues) 搜索是否已有人提出，没有的话欢迎新建 Issue，并尽量附上：

- 复现步骤 / 预期行为 / 实际行为
- 浏览器与系统环境
- 控制台报错截图或文本

### 提交代码

1. Fork 本仓库
2. 创建分支：`git checkout -b feat/your-feature`（功能）或 `fix/your-bugfix`（修复）
3. 本地预览验证（见下方）
4. 提交：`git commit -m "feat: 简短描述"`（建议遵循 [Conventional Commits](https://www.conventionalcommits.org/)）
5. 推送并创建 Pull Request 到 `main` 分支

### 本地预览

本仓库无需构建步骤，使用任意静态服务器即可（ES Modules 必须经 HTTP 访问）：

```bash
python -m http.server 8000
# 或
npx serve -p 8000
```

打开 `http://localhost:8000`。

## 代码约定

- **原生 ES Modules**：不引入打包工具 / 框架，保持零构建。
- 一个功能尽量内聚在 `assets/js/` 下的单个模块中。
- 新增用户可见文案须走 `assets/js/i18n.js`（支持多语言）。
- 样式优先复用 `assets/css/base.css` 中的 CSS 变量（主题色、间距等）。
- 不硬编码密钥、不引入新的外部跟踪脚本。

## 目录速览

```
assets/js/
├── app.js          # 入口
├── builder.js      # 核心逻辑（对话、工具、打包）
├── mcp.js          # MCP 客户端（文档检索 + 限速）
├── config.js       # MCP 端点 / 默认设置
├── i18n.js         # 多语言文案
├── state.js        # 设置持久化
└── notify.js       # 提示
```

## 行为准则

请保持友善、尊重，聚焦技术讨论。对新手友好 🤝

感谢你的贡献！
