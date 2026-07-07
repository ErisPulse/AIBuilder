











import { CONFIG } from "./config.js";
import { I18n } from "./i18n.js";
import { loadUserSettings } from "./state.js";
import { setupBuilder } from "./builder.js";




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




function initTheme() {
   
   
}




function refreshStaticI18n() {
  I18n.applyTranslations();
}

function init() {
   
  loadUserSettings();

   
  I18n.init();

   
  initTheme();

   
  initLangSwitcher();

   
   
  setupBuilder();

   
  refreshStaticI18n();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
