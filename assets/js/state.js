/**
 * ErisPulse Builder — 精简版共享状态
 *
 * 从原 erispulse.github.io/assets/js/core/state.js 移植而来。
 * 仅保留 builder 需要的部分：用户设置（含 builder 配置）的加载与持久化。
 * 裁掉了与 builder 无关的模块市场数据、版本提示等共享状态。
 */

import { CONFIG } from "./config.js";

// 用户设置（builder 配置存放于此）
export const state = {
  userSettings: { ...CONFIG.DEFAULT_USER_SETTINGS },
};

/**
 * 从 localStorage 读取用户设置并合并到 state.userSettings
 */
export function loadUserSettings() {
  try {
    const savedSettings = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);

      if (
        !parsedSettings.version ||
        parsedSettings.version !== CONFIG.SETTINGS_VERSION
      ) {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SETTINGS);
        state.userSettings = { ...CONFIG.DEFAULT_USER_SETTINGS };
        return;
      }

      state.userSettings = {
        ...CONFIG.DEFAULT_USER_SETTINGS,
        ...parsedSettings,
      };
    }
  } catch (e) {
    console.warn("Failed to load user settings:", e);
    state.userSettings = { ...CONFIG.DEFAULT_USER_SETTINGS };
  }
}

/**
 * 将 state.userSettings 写入 localStorage
 */
export function saveUserSettings() {
  try {
    state.userSettings.version = CONFIG.SETTINGS_VERSION;
    localStorage.setItem(
      CONFIG.STORAGE_KEYS.SETTINGS,
      JSON.stringify(state.userSettings),
    );
  } catch (e) {
    console.warn("Failed to save user settings:", e);
  }
}
