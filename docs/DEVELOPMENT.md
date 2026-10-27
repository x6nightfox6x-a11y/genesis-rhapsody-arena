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
| 地图尺寸、障碍、默认队伍、背景 | `campaigns/<campaign>/map.json` 和 `background.png` |
| 地图加载、路径解析、错误处理 | `campaigns/map-runtime.js` |
| 地图数据格式与验证 | `campaigns/map-schema.js`（Node 与浏览器共用） |
| 启动、检查、发布文件清单 | `tools/` |

## 本地测试

Windows 便携开发包使用 `START-STUDIO.cmd`，内附 Node.js，只需解压即可启动完整 Studio。`node tools/portable.mjs` 自动选择 4173–4193 中空闲端口并打开浏览器；`GRA_NO_OPEN=1` 用于独立验证，服务器仍仅监听本机。

迁移电脑前在 Studio 使用“迁移备份”，新电脑通过“恢复备份”导入。`studio/transfer.js` 迁移角色库、编辑器自动存档和当前地图布阵，只读取明确允许的本地存储键，排除登录凭证。备份不包含战斗动作、临时 HP/AP。源码文件、浏览器草稿和 GitHub 发布是不同的保存位置，复制源码不会自动复制浏览器草稿。

Windows x64 上运行 `node tools/package-studio.mjs 新输出目录 对应Node许可证文件` 重建便携开发文件夹，再压缩整个目录。目录包含源码、说明、测试和当前官方 Node 运行程序，排除 `.git`、个人凭证、`node_modules` 和生成输出。Mac/Linux 需要自行安装 Node 22+ 后启动同一源码。

`npm test` 先检查内联 JavaScript 语法、全部 JSON、静态链接、战役 ID/入口一致性及角色招式的动作绑定，再以临时端口测试实际发布包。

浏览器检查战役入口、80vw 固定战场、中键平移不改变单位位置、后台/游戏切换不丢队伍，以及 Jay 近战和枪击进入瞄准并造成伤害。测试准备明确的双方位置，避免默认站位不在射程内影响结果；使用独立浏览器，不读取或覆盖日常存档。

测试截图在 `test-results/`；CI 失败时通过 Actions 下载。新增功能应补充真正验证行为的测试，不为简单文案或颜色调整编写重复测试。

特殊环境可以设置 `BROWSER_CHANNEL=msedge` 使用 Edge，或设置 `PLAYWRIGHT_MODULE` 指定已有 Playwright 模块路径。普通环境不需要这些变量。预览端口冲突时设置 `PORT` 环境变量。

## 鼠标与镜头性能

`npm run benchmark` 在独立浏览器中，以同一缩放和三秒持续拖动比较后台与游戏的帧间隔，输出 P50/P95。结果受机器负载、浏览器和 GPU 影响，不作为 CI 的固定帧率门槛。

游戏只绘制可见区域和少量平移缓冲；编辑时绘制完整地图，以保留后台的纯 CSS 平移。鼠标攻击使用浏览器原生十字光标，目标/路线预览仍单独限频；触屏及按住按钮瞄准保留地图内光标。手动中键或 Shift 平移期间，自动镜头不能开始新的跟随。修改这些路径时，验证取消捕获、恢复瞄准以及普通点击的战斗行为。

ID 编辑器隐藏时停止预览 RAF，重新打开后恢复。不要通过降低战斗时钟、攻击速度或模拟更新频率来掩盖绘制开销。

## 发布边界与后续拆分

`tools/site.mjs` 是预览与构建的共用文件清单。新增资源目录时更新它；PR 与 Pages 使用同一构建命令。不要提交 `_site/`、`node_modules/`、截图或个人存档。

`campaigns/` 现已提供独立地图。入口由 manifest 指向 campaign.json，再由描述文件的 map 字段指向 map.json。共享加载器读取几何、默认布阵和背景后才启动引擎；后台等待 ArenaCampaignReady，不再依赖固定轮询次数。详见 campaigns/README.md。

浏览器测试还覆盖：只修改地图 JSON 即改变游戏几何与碰撞、重开保留所选地图、切换战役读取对应描述文件、地图缺失时显示错误，以及完整 HTML 在断网时启动并再次导出。提取更多脚本或图片时继续验证离线导出，避免两套实现漂移。
