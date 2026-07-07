/**
 * ErisPulse MCP 客户端（支持多 MCP 服务）
 *
 * 从用户配置的 mcpServers 中选取已启用的服务，按顺序尝试调用工具。
 * 每个 URL 维护独立的 MCP 会话与速率控制。
 */

import { CONFIG } from "./config.js";

// 每个 URL 的连接状态
const connections = new Map(); // url → {sessionId, initialized, initPromise, recentTimestamps}
const RATE_LIMIT = 45;
const RATE_WINDOW = 60_000;
let rpcId = 0;

/**
 * 获取当前已启用的 MCP 服务 URL 列表
 */
function getEnabledServers() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
    if (!raw) return [CONFIG.MCP.url];
    const data = JSON.parse(raw);
    const servers = (data.builder && data.builder.mcpServers) || [];
    const enabled = servers.filter((s) => s.enabled !== false);
    return enabled.length ? enabled.map((s) => s.url) : [];
  } catch (e) {
    return [CONFIG.MCP.url];
  }
}

function getConnection(url) {
  if (!connections.has(url)) {
    connections.set(url, {
      sessionId: null,
      initialized: false,
      initPromise: null,
      timestamps: [],
    });
  }
  return connections.get(url);
}

async function waitForRateLimit(conn) {
  for (;;) {
    const now = Date.now();
    while (conn.timestamps.length && conn.timestamps[0] <= now - RATE_WINDOW) {
      conn.timestamps.shift();
    }
    if (conn.timestamps.length < RATE_LIMIT) {
      conn.timestamps.push(now);
      return;
    }
    const wait = conn.timestamps[0] + RATE_WINDOW - now + 100;
    await new Promise((r) => setTimeout(r, Math.max(wait, 200)));
  }
}

async function parseResponse(resp) {
  const text = await resp.text();
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error.message || "MCP error");
    return data.result ?? data;
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr || jsonStr === "[DONE]") continue;
    try {
      const data = JSON.parse(jsonStr);
      if (data.error) throw new Error(data.error.message || "MCP error");
      if (data.result !== undefined) return data.result;
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
  throw new Error("MCP 响应解析失败");
}

async function rpc(url, method, params, { notification = false } = {}) {
  const conn = getConnection(url);
  await waitForRateLimit(conn);

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (conn.sessionId) headers["Mcp-Session-Id"] = conn.sessionId;

  const payload = { jsonrpc: "2.0", method, params };
  if (!notification) payload.id = ++rpcId;

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error("MCP 网络请求失败：" + (e.message || e));
  }

  if (!resp.ok && resp.status !== 202) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`MCP HTTP ${resp.status}: ${detail.slice(0, 200)}`);
  }

  const sid = resp.headers.get("Mcp-Session-Id");
  if (sid) conn.sessionId = sid;

  if (notification) return null;
  return await parseResponse(resp);
}

async function ensureInitialized(url) {
  const conn = getConnection(url);
  if (conn.initialized) return;
  if (conn.initPromise) return conn.initPromise;

  conn.initPromise = (async () => {
    await rpc(url, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ErisPulse-AIBuilder", version: "1.0.0" },
    });
    try {
      await rpc(url, "notifications/initialized", {}, { notification: true });
    } catch (e) { /* ok */ }
    conn.initialized = true;
  })();
  return conn.initPromise;
}

/**
 * 调用工具：按顺序尝试所有已启用的 MCP 服务器
 */
async function callTool(name, args = {}) {
  const servers = getEnabledServers();
  if (servers.length === 0) {
    throw new Error("没有已启用的 MCP 服务");
  }

  let lastError;
  for (const url of servers) {
    try {
      await ensureInitialized(url);
      const result = await rpc(url, "tools/call", { name, arguments: args });
      if (!result) continue;
      if (result.isError) {
        const texts = extractText(result.content);
        throw new Error(texts || `工具 ${name} 执行出错`);
      }
      return extractText(result.content);
    } catch (e) {
      lastError = e;
      // 继续尝试下一个服务器
    }
  }
  throw lastError || new Error("所有 MCP 服务器均不可用");
}

function extractText(content) {
  if (!Array.isArray(content)) return String(content || "");
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block.type === "text") return block.text;
      return "";
    })
    .join("\n");
}

export const MCP = {
  callTool,
  ensureInitialized() {
    const servers = getEnabledServers();
    return Promise.all(servers.map((u) => ensureInitialized(u).catch(() => {})));
  },
  get ready() {
    const servers = getEnabledServers();
    return servers.length > 0;
  },
  get url() {
    return getEnabledServers()[0] || CONFIG.MCP.url;
  },
};
