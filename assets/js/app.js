/**
 * ErisPulse Builder — 入口脚本
 *
 * 负责：
 *  1. 加载用户设置（含 builder 配置）
 *  2. 初始化 i18n + 填充语言切换器
 *  3. 启动 builder（setupBuilder）
 *  4. 绑定本站独有的导航交互（语言切换、主题切换）
 *
 * 对应原 erispulse.github.io 主入口中与 builder 相关的初始化逻辑。
 */

import { CONFIG } from "./config.js";
import { I18n } from "./i18n.js";
import { loadUserSettings } from "./state.js";
import { setupBuilder } from "./builder.js";

/**
 * 初始化语言切换下拉框
 */
function initLangSwitcher() {
  const select = document.getElementById("builder-lang-select");
  if (!select) return;

  const langs = I18n.getSupportedLanguages();
  select.innerHTML = "";
  for (const l of langs) {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = l.name;
    select.appendChild(opt);
  }
  select.value = I18n.getLang();

  select.addEventListener("change", () => {
    I18n.setLang(select.value);
    // 切换语言后，重新渲染欢迎消息与会话标题等动态文案
    // setupBuilder 内部已绑定的输入框 placeholder 会由 applyTranslations 更新；
    // 这里额外刷新欢迎消息与文档状态显示。
    const welcome = document.getElementById("builder-welcome");
    if (welcome) {
      // 重新渲染欢迎消息（renderMarkdown 依赖 window.marked）
      const { renderWelcome } = _builderInternals();
      renderWelcome();
    }
  });
}

/**
 * 切换语言后需要刷新的部分动态 UI（欢迎消息、文档状态、阶段标签）。
 * 这些函数定义在 builder.js 的模块作用域内，未导出；
 * 这里通过重新调用 setupBuilder 不合适，因此采用最小化方案：
 * 仅刷新可由 i18n 直接驱动的静态文案。
 */
function _builderInternals() {
  // builder.js 未导出 renderWelcome，这里用一个兜底实现：
  // 找到欢迎气泡，用当前 i18n 文本重新渲染。
  return {
    renderWelcome: () => {
      const el = document.getElementById("builder-welcome");
      if (!el) return;
      const md = I18n.t("builder.welcome");
      if (window.marked && typeof window.marked.parse === "function") {
        el.innerHTML = window.marked.parse(md);
      } else {
        el.textContent = md;
      }
    },
  };
}

/**
 * 初始化主题（默认深色；尊重本地保存的偏好）
 */
function initTheme() {
  // 主题已在 index.html 内联脚本中提前设置到 <html data-theme>，这里无需重复。
  // 预留：如需主题切换按钮可在此扩展。
}

/**
 * 重新应用 i18n 翻译到当前页面所有静态元素
 */
function refreshStaticI18n() {
  I18n.applyTranslations();
}

function init() {
  // 1. 加载设置
  loadUserSettings();

  // 2. 初始化 i18n（应用翻译 + 设置 html lang）
  I18n.init();

  // 3. 主题
  initTheme();

  // 4. 语言切换器
  initLangSwitcher();

  // 5. 启动 builder
  //    setupBuilder 内部会绑定配置输入、聊天、会话、文件、上传等全部交互
  setupBuilder();

  // 6. 首次应用静态文案翻译（确保导航栏等 data-i18n 元素被翻译）
  refreshStaticI18n();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
