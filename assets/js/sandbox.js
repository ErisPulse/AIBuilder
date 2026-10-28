












import { CONFIG } from "./config.js";

const SB = CONFIG.SANDBOX;

const logListeners = new Set();
const statusListeners = new Set();

const Sandbox = {
  state: "off",  
  stageText: "",
  logs: [],  
  sent: [],  
  booted: false,

  _worker: null,
  _seq: 0,
  _pending: new Map(),  

   
  onLog(fn) {
    logListeners.add(fn);
    return () => logListeners.delete(fn);
  },
  onStatus(fn) {
    statusListeners.add(fn);
    fn(this._snapshot());
    return () => statusListeners.delete(fn);
  },
  _snapshot() {
    return {
      state: this.state,
      stageText: this.stageText,
      booted: this.booted,
    };
  },
  _emitStatus() {
    const snap = this._snapshot();
    for (const fn of statusListeners) {
      try {
        fn(snap);
      } catch (_) {}
    }
  },
  _setState(state, stageText) {
    this.state = state;
    if (stageText !== undefined) this.stageText = stageText;
    this._emitStatus();
  },

   
  _pushLog(stream, text) {
    const entry = { stream, text, t: Date.now() };
    this.logs.push(entry);
    if (this.logs.length > SB.maxLogLines)
      this.logs.splice(0, this.logs.length - SB.maxLogLines);
    for (const fn of logListeners) {
      try {
        fn(entry);
      } catch (_) {}
    }
  },
  clearLogs() {
    this.logs = [];
    for (const fn of logListeners) {
      try {
        fn({ stream: "clear" });
      } catch (_) {}
    }
  },
  pushSent(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    this.sent.push(...items);
    if (this.sent.length > 200) this.sent.splice(0, this.sent.length - 200);
  },
  clearSent() {
    this.sent = [];
  },

   
  _spawnWorker() {
    this._terminateWorker();
    const url = new URL("./sandbox-worker.js?v=5", import.meta.url);
    const worker = new Worker(url, { type: "classic" });
    worker.onmessage = (e) => this._onMessage(e.data);
    worker.onerror = (e) => {
      this._pushLog("err", "Worker 错误: " + (e.message || "unknown"));
    };
    this._worker = worker;
    return worker;
  },
  _terminateWorker() {
    if (this._worker) {
      try {
        this._worker.terminate();
      } catch (_) {}
      this._worker = null;
    }
     
    for (const [, p] of this._pending) {
      clearTimeout(p.timer);
      p.reject(new Error("worker 已终止"));
    }
    this._pending.clear();
    this.booted = false;
  },
  _onMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "log") {
      this._pushLog(msg.stream, msg.text);
      return;
    }
    if (msg.type === "progress") {
      this.stageText = msg.message || "";
      this._setState(this._stageToState(msg.stage));
      return;
    }
    if (msg.type === "state") {
      this._setState(msg.state);
      if (msg.state === "ready") this.booted = true;
      return;
    }
     
    if (msg.id != null && this._pending.has(msg.id)) {
      const p = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.result);
      else {
        const err = new Error(msg.error || "沙箱操作失败");
        err.stack = msg.stack || err.stack;
        p.reject(err);
      }
    }
  },
  _stageToState(stage) {
    if (["allocating", "downloading", "installing"].includes(stage))
      return stage;
    return this.state === "busy" ? "busy" : this.state;
  },
  _call(op, payload, timeoutMs) {
    const worker = this._worker || this._spawnWorker();
    const id = ++this._seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
         
        this._pushLog("err", op + " 超时（" + Math.round(timeoutMs / 1000) + "s），已终止 worker");
        this._terminateWorker();
        this._setState("error", "超时");
        reject(new Error(op + " 超时，沙箱已重置"));
      }, timeoutMs || SB.opTimeoutMs);
      this._pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, op, payload });
    });
  },

   

  


  async boot() {
    if (this.booted && this._worker) return { ok: true, cached: true };
    if (
      typeof Worker === "undefined" ||
      typeof WebAssembly === "undefined"
    ) {
      throw new Error("当前浏览器不支持 WebAssembly / Web Worker，无法启动实例");
    }
    this.clearSent();
    try {
      await this._call(
        "boot",
        { cdns: SB.cdnCandidates },
        SB.bootTimeoutMs,
      );
      this.booted = true;
      this._setState("ready", "");
      return { ok: true };
    } catch (e) {
      this._setState("error", e.message);
      throw e;
    }
  },

   
  async ensureBooted() {
    if (!this.booted) await this.boot();
  },

  




  async runTest(files, events) {
    await this.ensureBooted();
    const evs = this.normalizeEvents(events);
    this._setState("busy", "部署并运行…");
    const report = await this._call("run", {
      files,
      events: evs,
      waitSeconds: 1.5,
    });
    this.pushSent(report.sent);
    this._setState("running", "");
    return report;
  },

   
  async sendUserEvent(textOrEvent) {
    await this.ensureBooted();
    const evs = this.normalizeEvents(textOrEvent);
    this._setState("busy", "注入事件…");
    const result = await this._call("event", {
      event: evs[0],
      waitSeconds: 1.5,
    });
    this.pushSent(result.sent);
    this._setState("running", "");
    return result;
  },

   
  async exec(code) {
    await this.ensureBooted();
    this._setState("busy", "执行 Python…");
    const r = await this._call("exec", { code });
    this._setState("running", "");
    return r;
  },

   
  async install(packages) {
    await this.ensureBooted();
    this._setState("busy", "安装依赖…");
    const r = await this._call("install", { packages });
    this._setState("running", "");
    return r;
  },

   
  stop() {
    this._terminateWorker();
    this._setState("off", "");
    this.stageText = "";
  },

  





  normalizeEvents(input) {
    const fill = (ev) => {
      const now = Math.floor(Date.now() / 1000);
      const base = {
        id: "evt_" + now + "_" + Math.random().toString(36).slice(2, 8),
        time: now,
        self_id: "mock_bot",
        user_id: "sandbox_user",
        platform: "ep_mock",
        type: "message",
        detail_type: "private",
        sub_type: "friend",
        message: [{ type: "text", data: { text: "" } }],
      };
      if (typeof ev === "string") {
        base.message[0].data.text = ev;
        return base;
      }
      if (ev && typeof ev === "object") {
        const merged = { ...base, ...ev };
        if (typeof merged.message === "string") {
          merged.message = [{ type: "text", data: { text: merged.message } }];
        }
        if (Array.isArray(merged.message) && merged.message.length === 0) {
          merged.message = [{ type: "text", data: { text: "" } }];
        }
        return merged;
      }
      base.message[0].data.text = String(ev);
      return base;
    };
    if (Array.isArray(input)) return input.map(fill);
    return [fill(input ?? "你好")];
  },
};

export { Sandbox };
