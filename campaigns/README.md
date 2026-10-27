# 独立地图与战役

使用者不需要手改代码。描述想改变的地图，由 Codex/GPT 修改数据、运行测试并提交即可。

## 唯一数据源

```text
manifest.json → arena-001/campaign.json → arena-001/map.json
                                                └→ background.png
```

- `manifest.json` 列出战役，`engine` 和 `data` 相对站点根目录。
- `campaign.json` 的 `map` 相对该描述文件，例如 `map.json`；`engine` 也相对描述文件。
- `map.json` 保存地图 ID、名称、尺寸、碰撞矩形、可选危险区和默认布阵。背景路径相对地图 JSON。
- `background.png` 是原始教堂图片，已从大 HTML 中原样提取。
- `map-schema.js` 是浏览器与 `npm run check` 共用的验证器。
- `map-runtime.js` 读取选中的战役、验证地图并加载背景，完成后引擎才创建战场。

后台和游戏共用 Arena 引擎与当前战场，不会再各保留一份地图定义。

## 修改地图

编辑 `arena-001/map.json`：

| 字段 | 用途 |
| --- | --- |
| `id` | 地图稳定 ID；同时用于存档与布阵文件引用 |
| `arena.width` / `arena.height` | 游戏世界单位；保持与图片比例、碰撞位置一致 |
| `arena.artMap` | 必须与地图 ID 相同 |
| `arena.obstacles` | 碰撞矩形 `{id,x,y,w,h}`；保留已有障碍的可破坏等附加属性 |
| `arena.hazards` | 可选，沿用引擎的矩形危险区格式 |
| `initialCampaign.units` | 默认人物 ID、模板、阵营、名称和坐标 |
| `background` | 本地 PNG/JPEG/WebP 路径；设为 `null` 时使用引擎基础地面 |

默认人物最多 40 人，须位于地图内，不能与碰撞障碍或其他人物重叠。模板为 `leon`（我方）、`grunt` / `slicer`（敌方）。角色技能、数值和动作仍由角色卡及战斗模板定义。

尺寸每边为 1–128 世界单位，并限制逻辑画布在约 1677 万像素内；背景图不超过 25 MB。开发文件引用应在站点内，不能使用外部网址。加载失败会停止启动并显示原因，不会悄悄换成旧地图。

## 增加战役

1. 复制一个战役目录并赋予新的战役 ID。
2. 更新 `campaign.json` 的 ID、名称和 `map` 路径。
3. 更新地图的 ID、`arena.artMap` 与 `initialCampaign.map`，放入对应背景。
4. 在 manifest 添加条目，仍使用同一个 `Arena game.html` 引擎。
5. 运行 `npm test`，再通过 Studio 的战役菜单检查新地图。

直接游戏入口可以用 `Arena%20game.html?campaign=战役ID`；没有参数时使用清单的 defaultCampaign。未知 ID 会显示错误。新增目录会随 `campaigns/` 自动进入发布包，无需复制新引擎。

## 存档与离线版本

教堂默认战役沿用原存档键，已有本地布阵继续可用；其他战役的存档互相隔离。浏览器里保存过的布阵可能覆盖默认队伍，测试新默认站位时请用隔离浏览器或导入新布阵。

“导出地图战役”保存的是当前地图 ID 与队伍布阵，导入时要求处于同一地图。“导出完整游戏 HTML”则把当前几何、背景图片、队伍和角色卡一起嵌入文件，可断网打开并再次导出。开发版 HTML 依赖 campaigns/ 文件，建议通过 npm run dev 使用。

不要手工维护第二份内嵌地图或背景。离线快照只在导出时生成，不是另一套开发源码。
