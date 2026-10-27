# Genesis Rhapsody Arena

静态网页战棋原型，包含 Arena 游戏、开发后台和角色 ID 编辑器，可发布到 GitHub Pages，无需数据库或游戏服务器。

## 入口与整理情况

| 文件 | 用途 |
| --- | --- |
| `studio.html` | 开发后台：角色库、布阵、战役选择和游戏测试 |
| `Arena game.html` | 唯一 Arena 引擎，游戏修改以此为准 |
| `index.html` | 旧网址兼容跳转 |
| `game.html` | 玩家菜单原型 |
| `Downbeat_ID_Card_Studio.html` | 角色动作、外观、数值和招式编辑器 |

已统一 Arena 引擎，移除旧副本和无用压缩包。`Pic/` 和 `角色卡/` 保存角色资源。地图尺寸、碰撞障碍、默认布阵及背景图已独立到 `campaigns/arena-001/`；后台和游戏通过同一加载器读取它们。战斗规则仍由引擎负责。

修改或增加地图参见 [地图开发说明](campaigns/README.md)。直接双击开发版引擎需要的外部 JSON 可能被浏览器拦截，请使用本地预览；游戏中的“导出完整游戏 HTML”会生成不依赖外部文件的离线版本。

角色可以在 Studio 或在线角色编辑器中点击“发布到 GitHub”。首次需要在网页弹窗连接 GitHub，之后当前页面内一键发布。操作方式见 [角色发布说明](docs/PUBLISHING.md)。

## 给 Codex、GPT 和开发者

先读 [AGENTS.md](AGENTS.md) 与 [开发指南](docs/DEVELOPMENT.md)。不要恢复已删除的旧游戏副本，也不要把 Arena 复制回 `index.html`。

首次准备（Node.js 22 或更新版本）：

```sh
npm ci
npx playwright install chromium
```

常用命令：

```sh
npm run dev       # 后台：http://127.0.0.1:4173/studio.html
npm run check     # 页面脚本、JSON、链接和全部战役检查
npm test          # 验证发布包：拖图、切换、Jay 近战和远程攻击
npm run build     # 生成 _site/，不包含开发工具和 Git 文件
npm run inspect   # 显示大 HTML 内部模块的位置
```

运行游戏不需要安装开发依赖。修改、测试和发布由开发者或 AI 完成，使用者只需描述希望实现的行为。

预览、校验和 Pages 构建共用发布文件清单。PR 自动运行浏览器测试，失败时提供截图。测试包含地图切换、碰撞、重开和断网导出。地图资源已移出引擎，角色编辑器仍是大 HTML；后续拆分继续由测试保护。
