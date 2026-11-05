/**
 * ErisPulse Builder — 入口脚本
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
    const welcome = document.getElementById("builder-welcome");
    if (welcome) {
      const { renderWelcome } = _builderInternals();
      renderWelcome();
    }
  });
}

function _builderInternals() {
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
  // 主题已在 index.html 内联脚本中提前设置到 <html data-theme>
  // 预留：如需主题切换按钮可在此扩展
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
  setupBuilder();

  // 6. 首次应用静态文案翻译
  refreshStaticI18n();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
