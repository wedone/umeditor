UMEditor Quick Injector — 本地开发与 Tampermonkey 自动更新说明

目的
- 在本地迭代修改 `scripts/um-inject.user.js` 并让 Tampermonkey 自动拉取更新，避免每次手动复制粘贴到浏览器。

整体思路
1. 在本地启动一个静态 HTTP 服务器（例如 Python 或 http-server），将项目目录作为站点根。
2. 在 userscript 头部设置 `@updateURL` / `@downloadURL` 指向该本地 URL（脚本中已设为 `http://127.0.0.1:8000/scripts/um-inject.user.js`）。
3. 修改脚本后使用 `tools/bump-userscript-version.ps1` 更新头部的 `@version`（为时间戳），触发 Tampermonkey 认为脚本有新版本。
4. 在 Tampermonkey 仪表盘手动或自动检查更新，脚本会从 `@updateURL` 下载新脚本并替换安装版本。

快速上手（Windows PowerShell）
1) 启动静态服务器（项目根为 d:\VC\umeditor）
```powershell
cd /d d:\VC\umeditor
python -m http.server 8000
# 或（如无 python）
# npx http-server . -p 8000
```
2) 首次安装脚本
- 在浏览器中打开： http://127.0.0.1:8000/scripts/um-inject.user.js
- 点击 Tampermonkey 的“Install”安装脚本。

3) 修改脚本并触发更新
- 编辑并保存 `scripts/um-inject.user.js`。
- 运行：
```powershell
pwsh .\tools\bump-userscript-version.ps1
```
这会把 `@version` 更新为当前时间戳，例如 `2025.10.13.230102`。
- 在 Tampermonkey 仪表盘选择该脚本，点击“检查更新（Update）”或等待自动更新，Tampermonkey 会从 `@updateURL` 下载并替换。

故障排查
- 如果 Tampermonkey 没有更新：
  - 确认静态服务器在运行，`http://127.0.0.1:8000/scripts/um-inject.user.js` 在浏览器可访问。
  - 确认浏览器或扩展没有拦截 localhost 请求。
  - 确认脚本头中的 `@updateURL` 指向你希望的地址。
  - 确认 `@version` 已改变（Tampermonkey 默认使用版本号判断）。

安全与注意事项
- 在生产/线上请勿把本地 `@updateURL` 暴露给不信任的网络环境。
- 如果你希望多人共享可用脚本，建议把脚本放到 GitHub/Gist，使用 raw URL 作为 `@updateURL`。

---
如果你需要，我可以：
- 把 `pwsh` 脚本改为 cross-platform 的 Node.js 脚本（JS），或
- 自动在脚本修改后触发 `curl` 到 Tampermonkey（不可行，Tampermonkey 需要手动/内部触发），或
- 把 `@updateURL` 改为指向 GitHub raw URL 并自动提交到一个仓库（需要你授权）。
