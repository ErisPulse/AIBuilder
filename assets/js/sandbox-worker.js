/**
 * ErisPulse Builder — 浏览器内 ErisPulse 实例（Web Worker）
 *
 * 在 Pyodide (WebAssembly Python) 中运行真实的 ErisPulse 框架：
 *   1. 下载 Pyodide 运行时（多 CDN 回退）
 *   2. micropip 安装 ErisPulse 及其纯 Python 依赖；
 *      aiohttp / websockets / pydantic 使用 Pyodide 内置包
 *   3. 在虚拟文件系统 /builder 下布置 config/config.toml（禁用 uvicorn
 *      自启动）与 plugins/ 目录，MockAdapter 以插件形式注册（平台名 ep_mock）
 *   4. await sdk.init() 一步完成模块加载与适配器启动
 *   5. 通过 sdk.adapter.emit() 注入 OneBot12 事件驱动模块，
 *      MockAdapter 捕获模块发出的消息
 *
 * 协议（main → worker）：{id, op, payload}
 * 协议（worker → main）：{id, ok, result|error} 与广播 {type: "log"|"progress"|"state"}
 */

/* global loadPyodide */

let pyodide = null;
let booted = false;
let booting = null; // 并发 boot 去重
let logBuffer = [];
let deployedPkgs = []; // 已部署的生成包名（用于重载前清理 sys.modules）

const MAX_LOGS = 600;
const BOOT_TIMEOUT_NOTE = "（首次启动需下载约 20-40MB 运行时与依赖）";

const CONFIG_TOML = [
  "# ErisPulse Builder 沙箱自动生成配置",
  "[ErisPulse.server]",
  "auto_start = false",
  "",
  "[ErisPulse.framework]",
  'plugins_dir = "plugins"',
  "",
].join("\n");

const MOCK_ADAPTER_PY = [
  "import time",
  "",
  "from ErisPulse.Core.Bases import BaseAdapter",
  "from ErisPulse.Core.Bases.adapter import SendDSL",
  "",
  "SENT_MESSAGES = []",
  "",
  "",
  "class Main(BaseAdapter):",
  '    """沙箱专用 MockAdapter：不联网，仅捕获发送"""',
  "",
  "    class Send(SendDSL):",
  '        """捕获实例发出的所有标准消息（Text/Image/... 最终都走 Raw_ob12）"""',
  "",
  "        async def Raw_ob12(self, message, **kwargs):",
  "            import ep_mock",
  "            ep_mock.SENT_MESSAGES.append({",
  '                "time": time.time(),',
  '                "message": message,',
  '                "kwargs": {k: str(v)[:200] for k, v in kwargs.items()},',
  "            })",
  "",
  "    async def call_api(self, endpoint, **params):",
  '        return {"status": "ok", "endpoint": endpoint,',
  '                "params": {k: str(v)[:200] for k, v in params.items()}}',
  "",
  "    async def start(self):",
  "        try:",
  "            self.logger.info(",
  '                "[MockAdapter] ready (platform=%s)"',
  "                % getattr(self, ",
  '                    "_platform", "ep_mock"))',
  "        except Exception:",
  "            pass",
  "",
  "    async def shutdown(self):",
  "        pass",
  "",
].join("\n");

// Python 辅助函数（注入 pyodide 全局命名空间）
const HELPERS_PY = [
  "import asyncio, importlib, inspect, json, sys, threading",
  "",
  "",
  "def _ep_patch_threads():",
  '    """',
  "    Pyodide 单线程适配（必须先于框架导入执行）：",
  "    - config-watcher 线程静默跳过（配置写入仅保留内存缓存）",
  "    - ErisPulse-StorageBridge 线程跳过（预补丁 _ep_patch_storage 已使桥接",
  "      永不实例化，此分支仅为防御性兜底：解开 _ready 等待避免死锁）",
  "    - 其余线程快速抛错，避免静默死锁",
  '    """',
  "",
  "    def _sandbox_start(self, *args, **kwargs):",
  '        name = getattr(self, "name", "")',
  '        if name == "config-watcher":',
  "            return None",
  '        if name == "ErisPulse-StorageBridge":',
  "            # 防御性兜底：若桥接仍被创建，解开 _ready 等待避免死锁",
  '            bridge = getattr(getattr(self, "_target", None), "__self__", None)',
  "            if bridge is not None:",
  "                try:",
  "                    bridge._loop = asyncio.get_running_loop()",
  "                except RuntimeError:",
  "                    bridge._loop = None",
  "                bridge._ready.set()",
  "            self._ep_suppressed = True",
  "            return None",
  '        raise RuntimeError(',
  '            "Pyodide 沙箱不支持原生线程（线程: %s）。" % name',
  "        )",
  "",
  "    threading.Thread.start = _sandbox_start",
  "",
  "",
  "# 内存 KV 存储（沙箱内 aiosqlite 不可用，BaseStorage 全部 KV 接口改走本字典）",
  "_EP_KV = {}",
  "",
  "",
  "def _ep_patch_storage():",
  '    """把 BaseStorage 的全部 KV 接口替换为内存字典实现（须在 create_storage 前调用）"""',
  '    mod = sys.modules.get("ErisPulse.Core.Bases.storage")',
  "    if mod is None:",
  "        return False",
  "    base_cls = getattr(mod,",
  '        "BaseStorage", None)',
  "    if base_cls is None or getattr(base_cls,",
  '        "_ep_patched", False):',
  "        return True",
  "    data = _EP_KV",
  "",
  '    def _get(self, key, default=None, **kw):',
  "        return data.get(key, default)",
  "",
  '    def _set(self, key, value, **kw):',
  "        data[key] = value",
  "        return True",
  "",
  '    def _delete(self, key, **kw):',
  "        return data.pop(key, None) is not None",
  "",
  '    def _keys(self, **kw):',
  "        return list(data.keys())",
  "",
  '    def _clear(self, **kw):',
  "        data.clear()",
  "        return True",
  "",
  '    def _multi_get(self, keys, **kw):',
  "        return {k: data.get(k) for k in keys}",
  "",
  '    def _multi_set(self, items, **kw):',
  "        data.update(items)",
  "        return True",
  "",
  '    def _multi_delete(self, keys, **kw):',
  "        n = 0",
  "        for k in keys:",
  "            if data.pop(k, None) is not None:",
  "                n += 1",
  "        return n",
  "",
  '    def _nosql(self, *a, **kw):',
  "        raise RuntimeError(",
  '            "Pyodide 沙箱仅支持内存 KV 存储（self.state / sdk.storage 的 get/set）。SQL/ORM/事务接口不可用。"',
  "        )",
  "",
  "    for n in ('get', 'aget'):",
  "        setattr(base_cls, n, _get)",
  "    for n in ('set', 'aset'):",
  "        setattr(base_cls, n, _set)",
  "    for n in ('delete', 'adelete'):",
  "        setattr(base_cls, n, _delete)",
  "    for n in ('get_all_keys', 'aget_all_keys'):",
  "        setattr(base_cls, n, _keys)",
  "    for n in ('clear', 'aclear'):",
  "        setattr(base_cls, n, _clear)",
  "    for n in ('get_multi', 'aget_multi'):",
  "        setattr(base_cls, n, _multi_get)",
  "    for n in ('set_multi', 'aset_multi'):",
  "        setattr(base_cls, n, _multi_set)",
  "    for n in ('delete_multi', 'adelete_multi'):",
  "        setattr(base_cls, n, _multi_delete)",
  "    for n in ('Execute', 'aExecute', 'ExecuteOne', 'aExecuteOne',",
  "              'Count', 'aCount', 'Exists', 'aExists',",
  "              'CreateTable', 'aCreateTable', 'DropTable', 'aDropTable',",
  "              'HasTable', 'aHasTable', 'transaction', 'atransaction',",
  "              'close', 'aclose', 'getConfig', 'setConfig'):",
  "        setattr(base_cls, n, _nosql)",
  "    if '_bridge_run' in getattr(base_cls,",
  '        "__dict__", {}):',
  '        def _bridge_run(inner_self, coro, timeout=None):',
  "            coro.close()",
  "            return None",
  "        base_cls._bridge_run = _bridge_run",
  "    base_cls._ep_patched = True",
  "    return True",
  "",
  "",
  "def _ep_install_import_hook():",
  '    """',
  "    在 ErisPulse.Core.storage（后端包，其导入期即执行 create_storage）真正",
  "    exec 之前，确保 ErisPulse.Core.Bases.storage 已加载并完成内存存储补丁。",
  "    必须在任何 ErisPulse 导入之前安装本钩子。",
  '    """',
  "    import importlib.abc",
  "    import importlib.util",
  "",
  "    TARGET = 'ErisPulse.Core.storage'",
  "",
  "    class _HookLoader(importlib.abc.Loader):",
  "        def __init__(self, real):",
  "            self._real = real",
  "",
  "        def create_module(self, spec):",
  "            return self._real.create_module(spec)",
  "",
  "        def exec_module(self, module):",
  "            importlib.import_module(",
  '                "ErisPulse.Core.Bases.storage")',
  "            _ep_patch_storage()",
  "            self._real.exec_module(module)",
  "",
  "    class _HookFinder(importlib.abc.MetaPathFinder):",
  "        def find_spec(self, fullname, path=None, target=None):",
  "            if fullname != TARGET:",
  "                return None",
  "            sys.meta_path.remove(self)",
  "            spec = importlib.util.find_spec(fullname)",
  "            if spec is None:",
  "                return None",
  "            spec.loader = _HookLoader(spec.loader)",
  "            return spec",
  "",
  "    sys.meta_path.insert(0, _HookFinder())",
  "",
  "",
  "_ep_patch_threads()",
  "_ep_install_import_hook()",
  "",
  "",
  "def _ep_verify_imports():",
  '    """导入框架与依赖并验证（导入钩子已安装）→ JSON 报告"""',
  "    import importlib",
  "    _r = {}",
  '    for _m in ("rich", "fastapi", "uvicorn", "tomlclass", "aiosqlite",',
  '               "websockets", "aiohttp", "pydantic"):',
  "        try:",
  "            importlib.import_module(_m)",
  "            _r[_m] = True",
  "        except Exception:",
  "            _r[_m] = False",
  "    try:",
  "        from ErisPulse import sdk as _sdk",
  "        _r[",
  '            "ErisPulse"] = True',
  "    except Exception:",
  "        _r[",
  '            "ErisPulse"] = False',
  "    return json.dumps(_r)",
  "",
  "",
  "",
  "def _ep_drain_sent():",
  '    """取出 MockAdapter 捕获的发送记录（JSON 字符串）并清空"""',
  "    try:",
  "        import ep_mock",
  "        data = ep_mock.SENT_MESSAGES[:]",
  "        del ep_mock.SENT_MESSAGES[:]",
  "    except Exception:",
  "        data = []",
  "    return json.dumps(data, ensure_ascii=False, default=str)",
  "",
  "",
  "async def _ep_force_load_modules():",
  '    """强制初始化懒加载模块，使命令/事件处理器即时注册"""',
  "    from ErisPulse import sdk",
  "    try:",
  "        names = list(sdk.module._module_classes.keys())",
  "    except Exception:",
  "        return 0",
  "    count = 0",
  "    for n in names:",
  "        try:",
  "            if await sdk.load_module(n):",
  "                count += 1",
  "        except Exception:",
  "            pass",
  "    return count",
  "",
  "",
  "async def _ep_boot():",
  '    """初始化 ErisPulse（加载 plugins 目录下的模块 + 启动适配器）"""',
  "    import os",
  '    os.chdir("/builder")',
  '    if "/builder/plugins" not in sys.path:',
  '        sys.path.insert(0, "/builder/plugins")',
  "    from ErisPulse import sdk",
  "    ok = await sdk.init()",
  "    if ok:",
  "        await _ep_force_load_modules()",
  "    return bool(ok)",
  "",
  "",
  "async def _ep_redeploy():",
  '    """框架原生热重载管线：卸载全部 → 清理 sys.modules → 重新发现/注册/初始化"""',
  "    from ErisPulse import sdk",
  "    results = await sdk.reload_all_modules()",
  "    await _ep_force_load_modules()",
  "    if isinstance(results, dict):",
  "        return bool(results) and all(bool(v) for v in results.values())",
  "    return bool(results)",
  "",
  "",
  "async def _ep_emit(events_json, wait_seconds):",
  '    """注入 OneBot12 事件并等待处理器执行"""',
  "    from ErisPulse import sdk",
  "    events = json.loads(events_json)",
  "    for ev in events:",
  "        await sdk.adapter.emit(ev)",
  "    await asyncio.sleep(float(wait_seconds))",
  "    return True",
  "",
  "",
  "async def _ep_install(packages_json):",
  '    """micropip 安装依赖（带重试：PyPI JSON API 突发请求可能被限流）"""',
  "    import asyncio, json, micropip",
  "    packages = json.loads(packages_json)",
  "    last = None",
  "    for attempt in range(3):",
  "        try:",
  "            await micropip.install(packages, keep_going=True)",
  "            return True",
  "        except Exception as e:",
  "            last = e",
  "            await asyncio.sleep(2 * (attempt + 1))",
  "    raise last",
  "",
].join("\n");

function post(msg) {
  self.postMessage(msg);
}

function log(stream, text) {
  const entry = { stream, text: String(text), t: Date.now() };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS)
    logBuffer.splice(0, logBuffer.length - MAX_LOGS);
  post({ type: "log", ...entry });
}

function progress(stage, message) {
  post({ type: "progress", stage, message });
}

function state(name) {
  post({ type: "state", state: name });
}

/* ================= Pyodide 加载（多 CDN 回退） ================= */

async function loadRuntime(cdns) {
  let lastErr = null;
  for (const base of cdns) {
    try {
      progress("downloading", "Pyodide: " + base);
      self.importScripts(base + "pyodide.js");
      if (typeof loadPyodide !== "function") {
        throw new Error("loadPyodide unavailable from " + base);
      }
      pyodide = await loadPyodide({
        indexURL: base,
        // 内置包（aiohttp/pydantic 等）与 lockfile 也从同一镜像拉取，
        // 避免默认 CDN 不可达时内置包加载失败
        packageBaseUrl: base,
        lockFileURL: base + "pyodide-lock.json",
      });
      return;
    } catch (e) {
      lastErr = e;
      log("err", "CDN 加载失败 " + base + " : " + (e && e.message));
    }
  }
  throw lastErr || new Error("所有 Pyodide CDN 均不可达");
}

/** 真正验证某个顶层包可导入（loadPackage 失败不抛错，须主动检查） */
async function packageImportable(name) {
  try {
    return pyodide.runPython(
      "import importlib.util; importlib.util.find_spec('" + name + "') is not None",
    );
  } catch (_) {
    return false;
  }
}

/* ================= Boot ================= */

async function doBoot(payload) {
  if (booted) return { alreadyBooted: true };
  if (booting) return booting;
  booting = (async () => {
    try {
      state("allocating");
      progress("space", "分配虚拟文件系统…");
      // 预留：真正的目录创建在 pyodide 就绪后进行

      state("downloading");
      if (pyodide) {
        // 重试场景：复用已下载的运行时，避免重复下载数十 MB
        log("sys", "复用已下载的 Pyodide 运行时");
      } else {
        await loadRuntime((payload && payload.cdns) || []);
      }
      log("sys", "Pyodide 运行时就绪（Python " + pyodide.runPython("import sys; sys.version.split()[0]") + "）");

      // stdout/stderr 重定向 → 日志流
      pyodide.setStdout({ batched: (s) => log("out", s) });
      pyodide.setStderr({ batched: (s) => log("err", s) });

      // 虚拟磁盘与配置目录
      state("allocating");
      progress("space", "创建虚拟磁盘与配置目录…");
      const FS = pyodide.FS;
      try {
        FS.mkdirTree("/builder/config");
        FS.mkdirTree("/builder/plugins");
      } catch (_) {}
      FS.writeFile("/builder/config/config.toml", CONFIG_TOML);
      FS.writeFile("/builder/plugins/ep_mock.py", MOCK_ADAPTER_PY);

      // 注入辅助函数：必须先于任何 _ep_* 调用（线程补丁与导入钩子也随之生效）
      pyodide.runPython(HELPERS_PY);

      // 安装依赖：全部交给 micropip —— 发行版内的包（aiohttp/pydantic/rich/anyio/ssl…）
      // 由 micropip 自动委托 loadPackage 从镜像加载，websockets 等不在发行版内的
      // 走 PyPI 纯 Python wheel。切勿手动预加载 aiohttp/pydantic：
      // 预加载会让 micropip 的事务解析出现"已安装版本冲突"而整体失败（已实测复现）。
      state("installing");
      progress("pip", "准备 micropip…");
      await pyodide.loadPackage("micropip");
      progress(
        "pip",
        "从 PyPI 安装 ErisPulse 及依赖 " + BOOT_TIMEOUT_NOTE,
      );
      // 分两步装：纯依赖先行，ErisPulse 本体最后（此时其依赖已全部满足，
      // 降低组合解析事务的失败面）
      const depList = [
        "fastapi",
        "uvicorn",
        "rich",
        "tomlclass<0.4", // ErisPulse 约束 tomlclass<0.4,>=0.3.2；不锁会装上 0.4.0 导致冲突
        "aiosqlite",
        "websockets",
        "typing-inspection",
        "sqlite3", // lockfile 包（stdlib zip 不含，需 loadPackage 委托）
        "pygments", // lockfile 包（rich 的 lockfile depends 为空，需显式拉取）
      ];
      await pyodide.runPythonAsync(
        "await _ep_install(" + JSON.stringify(JSON.stringify(depList)) + ")",
      );
      log("sys", "纯依赖安装完成");
      await pyodide.runPythonAsync('await _ep_install("ErisPulse")');
      log("sys", "ErisPulse 安装完成");

      // 导入验证（导入钩子已在注入 helpers 时安装，框架首次导入在此发生）
      const importCheck = await pyodide.runPythonAsync(
        "_ep_verify_imports()",
      );
      const mods = JSON.parse(importCheck);
      const failedMods = Object.entries(mods)
        .filter(([, ok]) => !ok)
        .map(([m]) => m);
      if (failedMods.length > 0) {
        throw new Error("依赖导入失败: " + failedMods.join(", "));
      }
      log("sys", "依赖导入验证通过（含 ErisPulse 框架）");

      // 初始化框架
      state("installing");
      progress("sdk", "初始化 ErisPulse（加载模块与 MockAdapter）…");
      const ok = await pyodide.runPythonAsync("await _ep_boot()");
      if (!ok) {
        const tail = logBuffer
          .slice(-40)
          .map((l) => l.text)
          .join("\n");
        throw new Error("sdk.init() 失败。\n" + tail);
      }

      deployedPkgs = [];
      booted = true;
      state("ready");
      return { ok: true };
    } catch (e) {
      state("error");
      log("err", "启动失败: " + (e && (e.stack || e.message)));
      throw e;
    } finally {
      booting = null;
    }
  })();
  return booting;
}

/* ================= 部署与运行 ================= */

function pyIdent(name) {
  return (
    String(name || "GeneratedModule")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/^_+/, "") || "GeneratedModule"
  );
}

function extractPkgName(files) {
  const pyproject = files["pyproject.toml"] || "";
  const m = pyproject.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return pyIdent(m ? m[1] : "");
}

function writeDeployFiles(files) {
  const FS = pyodide.FS;
  const pkg = extractPkgName(files);
  const root = "/builder/plugins/" + pkg;
  try {
    FS.mkdirTree(root);
  } catch (_) {}

  for (const [path, content] of Object.entries(files)) {
    const norm = String(path)
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .replace(/^\//, "");
    if (norm.includes("..")) continue; // 防目录穿越
    const target = root + "/" + norm;
    const dir = target.slice(0, target.lastIndexOf("/"));
    try {
      FS.mkdirTree(dir);
    } catch (_) {}
    FS.writeFile(target, String(content));
  }

  // 保证 __init__.py 存在（模板默认包含；缺失时兜底生成）
  try {
    FS.stat(root + "/__init__.py");
  } catch (_) {
    const fallback = files["Core.py"]
      ? "from .Core import *  # noqa\nfrom .Core import Main  # noqa\n"
      : "";
    FS.writeFile(root + "/__init__.py", fallback);
  }

  if (!deployedPkgs.includes(pkg)) deployedPkgs.push(pkg);
  return { pkg, root };
}

function drainSent() {
  try {
    const drain = pyodide.globals.get("_ep_drain_sent");
    const json = drain();
    drain.destroy && drain.destroy();
    return JSON.parse(json);
  } catch (e) {
    return [];
  }
}

async function doRun(payload) {
  if (!booted) throw new Error("实例未启动");
  state("busy");
  const started = Date.now();
  try {
    const files = (payload && payload.files) || {};
    if (Object.keys(files).length === 0) {
      throw new Error("没有可部署的文件");
    }
    progress("sdk", "部署生成文件…");
    const { pkg } = writeDeployFiles(files);

    drainSent(); // 清空旧记录
    const logStart = logBuffer.length;

    const ok = await pyodide.runPythonAsync(
      "await _ep_redeploy()",
    );
    if (!ok) {
      throw new Error("模块重载失败（详见日志）");
    }

    const events = (payload && payload.events) || [];
    const waitSeconds =
      typeof (payload && payload.waitSeconds) === "number"
        ? payload.waitSeconds
        : 1.5;
    if (events.length > 0) {
      await pyodide.runPythonAsync(
        "await _ep_emit(" +
          JSON.stringify(JSON.stringify(events)) +
          ", " +
          waitSeconds +
          ")",
      );
    }

    const sent = drainSent();
    const logs = logBuffer.slice(logStart).map((l) => ({
      stream: l.stream,
      text: l.text,
    }));
    const errors = logs.filter((l) => {
      const t = l.text;
      return (
        l.stream === "err" ||
        /Traceback|ERROR|错误|异常|Exception|FAILED/i.test(t)
      );
    });
    booted = true;
    state("running");
    return {
      ok: errors.length === 0,
      pkg,
      durationMs: Date.now() - started,
      logs,
      errors,
      sent,
    };
  } catch (e) {
    state("error");
    throw e;
  }
}

async function doEvent(payload) {
  if (!booted) throw new Error("实例未启动");
  state("busy");
  try {
    const waitSeconds =
      typeof (payload && payload.waitSeconds) === "number"
        ? payload.waitSeconds
        : 1.5;
    const logStart = logBuffer.length;
    drainSent();
    await pyodide.runPythonAsync(
      "await _ep_emit(" +
        JSON.stringify(JSON.stringify([payload.event])) +
        ", " +
        waitSeconds +
        ")",
    );
    const sent = drainSent();
    const logs = logBuffer.slice(logStart).map((l) => ({
      stream: l.stream,
      text: l.text,
    }));
    state("running");
    return { ok: true, logs, sent };
  } catch (e) {
    state("error");
    throw e;
  }
}

async function doExec(payload) {
  if (!booted) throw new Error("实例未启动");
  state("busy");
  try {
    const logStart = logBuffer.length;
    let result = await pyodide.runPythonAsync(String((payload && payload.code) || ""));
    let text = "";
    if (result !== undefined && result !== null) {
      try {
        text = typeof result.toString === "function" ? result.toString() : String(result);
      } catch (_) {
        text = "";
      }
      try {
        result.destroy && result.destroy();
      } catch (_) {}
    }
    const logs = logBuffer.slice(logStart).map((l) => ({
      stream: l.stream,
      text: l.text,
    }));
    state("running");
    return { ok: true, result: text, logs };
  } catch (e) {
    state("error");
    throw e;
  }
}

async function doInstall(payload) {
  if (!booted) throw new Error("实例未启动");
  state("busy");
  try {
    const packages = (payload && payload.packages) || [];
    await pyodide.runPythonAsync(
      "await _ep_install(" + JSON.stringify(JSON.stringify(packages)) + ")",
    );
    state("running");
    return { ok: true, packages };
  } catch (e) {
    state("error");
    throw e;
  }
}

/* ================= 消息分发 ================= */

const OPS = {
  boot: doBoot,
  run: doRun,
  event: doEvent,
  exec: doExec,
  install: doInstall,
};

self.onmessage = async (e) => {
  const { id, op, payload } = e.data || {};
  if (!op) return;
  const handler = OPS[op];
  if (!handler) {
    if (id != null) post({ id, ok: false, error: "未知操作: " + op });
    return;
  }
  try {
    const result = await handler(payload);
    if (id != null) post({ id, ok: true, result });
  } catch (err) {
    if (id != null)
      post({
        id,
        ok: false,
        error: (err && err.message) || String(err),
        stack: err && err.stack,
      });
  }
};
