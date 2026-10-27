# 开发与验证

## 接手顺序

1. 读取 `AGENTS.md`，确认分支、用户修改和远端最新状态。
2. 运行 `npm run check`。用代码索引定位相关部分，避免输出整段内嵌图片。
3. 修改唯一源文件；一项任务使用一个独立分支，不恢复用户删除的功能。
4. 运行 `npm test`，验证 `_site/` 中真正将要发布的文件。
5. 更新相关说明并提交 PR，报告结果和实际限制。技术实现由开发者决定，不要求使用者做编程选择。

## 代码定位

Arena HTML 内的 `src/...ts` 是现有打包模块的标签，**仓库中并没有这些独立 TypeScript 文件**，也没有对应的原始编译工程。通过工具定位：

```sh
npm run inspect -- --find "DBDeployment"
npm run inspect -- --module inputRouter
npm run inspect -- --module sim/combat
npm run inspect -- --studio --find "campaign"
npm run inspect -- --id --find "function animate"
```

工具只读原文件，屏蔽过长的内嵌资源行，不生成第二套源码。

| 修改目标 | 起点 |
| --- | --- |
| 鼠标、键盘、触屏 | Arena 的 `src/input/inputRouter.ts` 标签 |
| 选人、模式、回合、布阵 API | Arena 的 `src/host/game.ts`、`window.DBDeployment` |
| 地图、人物、瞄准与特效绘制 | Arena 的 `src/render/canvasRenderer.ts` |
| 路径与 AP | Arena 的 `src/sim/movement.ts` |
| 命中与伤害 | Arena 的 `src/sim/combat.ts` |
| 角色卡绑定、动画、招式数值 | Arena 的 `ArenaRuntime` / `ArenaID` 与角色卡 JSON |
| 战斗 HUD | Arena 的 `src/ui/hud.ts` 及对应 CSS |
| 后台、角色库、iframe、战役选择 | `studio.html` |
| 角色动作制作 | `Downbeat_ID_Card_Studio.html` |
| 战役列表 | `campaigns/manifest.json` 与各战役描述 |
| 启动、检查、发布文件清单 | `tools/` |

## 本地测试

`npm test` 先检查内联 JavaScript 语法、全部 JSON、静态链接、战役 ID/入口一致性及角色招式的动作绑定，再以临时端口测试实际发布包。

浏览器检查战役入口、80vw 固定战场、中键平移不改变单位位置、后台/游戏切换不丢队伍，以及 Jay 近战和枪击进入瞄准并造成伤害。测试准备明确的双方位置，避免默认站位不在射程内影响结果；使用独立浏览器，不读取或覆盖日常存档。

测试截图在 `test-results/`；CI 失败时通过 Actions 下载。新增功能应补充真正验证行为的测试，不为简单文案或颜色调整编写重复测试。

特殊环境可以设置 `BROWSER_CHANNEL=msedge` 使用 Edge，或设置 `PLAYWRIGHT_MODULE` 指定已有 Playwright 模块路径。普通环境不需要这些变量。预览端口冲突时设置 `PORT` 环境变量。

## 发布边界与后续拆分

`tools/site.mjs` 是预览与构建的共用文件清单。新增资源目录时更新它；PR 与 Pages 使用同一构建命令。不要提交 `_site/`、`node_modules/`、截图或个人存档。

`campaigns/` 描述的是内嵌战役，增加一项清单不会自动实现地图加载。提取内联脚本、图片或地图之前，必须同时验证“导出完整游戏 HTML”后独立打开仍可使用。后续拆分要先约定源文件与生成文件，避免两套实现漂移。
