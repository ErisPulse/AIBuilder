# Pyodide v0.28.3 精简自托管发行版

来源：[pyodide/pyodide v0.28.3 官方 Release](https://github.com/pyodide/pyodide/releases/tag/0.28.3)
（`pyodide-0.28.3.tar.bz2`，未做任何修改）。

本目录只保留 Builder 沙箱启动必需的文件，替代 jsDelivr `/pyodide/` 路径
（完整 dist 仅 jsDelivr 一家公共 CDN 承载，为消除供应链依赖改为自托管）：

- **核心运行时（5 件）**：`pyodide.js`、`pyodide.asm.js`、`pyodide.asm.wasm`、
  `python_stdlib.zip`、`pyodide-lock.json`
- **lockfile 依赖闭包（26 个文件）**：从 `pyodide-lock.json` 出发收集两部分的并集：
  ① 启动清单内 lockfile 包（`micropip`、`aiohttp`、`pydantic`、`rich`、`sqlite3`、
  `pygments`）沿 `depends` 边的全部传递依赖；② PyPI 来源包（fastapi/uvicorn 等）
  的依赖中被 lockfile 解析的版本（`anyio`、`click`、`h11`、`sniffio`、`ssl`、
  `libopenssl`，其中 `libopenssl` 为 .zip）。fastapi/uvicorn/websockets 本体不在
  Pyodide lockfile 内，运行时由 micropip 直接从 PyPI 安装，无需镜像。
  包名归一化注意：`pydantic-core` 等带连字符依赖在 `depends` 中以下划线出现。

未收录的 lockfile 包（如 matplotlib、numpy）无法在沙箱内通过
`loadPackage`/micropip 安装。

## 升级 Pyodide 版本时

1. 下载新版官方 tarball，替换核心 5 件；
2. 以新版 `pyodide-lock.json` 重算依赖闭包（含包名 PEP503 归一化，
   注意 `pydantic-core` 这类带连字符依赖的归一化）；
3. 更新 `assets/js/config.js` 中 `SANDBOX.pyodideVersion` 与
   `cdnCandidates` 路径。
