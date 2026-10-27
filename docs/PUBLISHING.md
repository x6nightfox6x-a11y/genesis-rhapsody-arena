# 一键发布角色到 GitHub

## 平时使用

1. 在 Studio 的 ID 编辑器做好角色，点击 **↑ 发布到 GitHub**。
2. 第一次使用先按弹窗连接 GitHub；在当前页面中连接有效，之后点击发布会直接上传。
3. 出现“已发布”和 GitHub 提交链接后，角色已进入仓库。网站自动检查与部署完成后，其他设备也会在角色库发现它。

角色库每张卡也有 **↑ 发布** 按钮，可发布已经保存的草稿。独立打开在线角色编辑器时，同样提供发布按钮；嵌入 Studio 时使用外层按钮即可。

发布前会保存本地草稿。网络、授权或分支保护导致失败时，不会显示成功，也不会删除草稿。角色和角色库索引在同一次提交中更新。

## 第一次连接

当前项目使用 GitHub Pages 静态托管，没有保存账户凭据的服务器，因此使用 GitHub 官方的细粒度访问令牌连接，不是 OAuth 自动登录。

1. 在弹窗点击 **打开 GitHub 授权设置**，登录拥有目标仓库写权限的账户。
2. **Repository access** 选择 **Only select repositories**，仅勾选 `genesis-rhapsody-arena`。
3. 名称、30 天有效期和 **Contents: Read and write** 已预填。检查目标账户是 `x6nightfox6x-a11y`，点击 **Generate token**。
4. 把 GitHub 显示的令牌复制到编辑器弹窗，点击 **连接 GitHub**。不要发到聊天或写入角色卡。

依据：[GitHub 访问令牌及预填授权设置说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。令牌创建页仍需手动选择唯一仓库；GitHub 不支持在这个预填链接中固定仓库选择。

令牌只保留在当前页面的内存里。刷新、关闭或点“断开连接”后需要重新连接；不会保存到 localStorage、sessionStorage、IndexedDB 或仓库。GitHub 上的令牌可以在账户设置里撤销。“断开连接”只清除本页连接，不撤销 GitHub 上的令牌。

## 更新与冲突

- 编辑同一个本地角色会更新同一 GitHub 文件；改名时其稳定角色 ID 不变。
- 如果云端角色已有其他修改，会保留本地草稿，要求明确点击“确认用本地角色覆盖云端版本”才继续。
- 其他人同时发布另一角色时，会重新合并最新角色清单；不会强制覆盖整个分支。
- 重复发布相同版本不创建重复提交。
- 目标固定为 `x6nightfox6x-a11y/genesis-rhapsody-arena` 的默认分支。分支保护不允许直接写入时，会给出错误，不绕过保护。

## 给开发者

`角色卡/library.json` 是已发布角色的入口。新增角色文件也要更新索引；检查命令会检测遗漏、坏路径及重复条目。索引中的 sha 指向角色 Git blob，供草稿版本检查使用。

`studio/github-client.js` 使用 GitHub Git Data API 创建 blob、tree、commit，最后以非强制 fast-forward 更新默认分支；文件和索引原子提交。`studio/publish-ui.js` 负责授权/进度界面，`character-library.js` 提供共享格式验证。凭据只存在私有实例字段，不暴露给 Studio 数据接口。

Studio 的本地编辑与发布版本记录相互独立。远端更新只自动替换未修改过的本地副本，旧的未标记存档保守地当作草稿保留。

浏览器与单元测试使用拦截的 GitHub API 验证成功、失败、并发、冲突和凭据生命周期，不向真实仓库创建测试角色。发布请求限制为本站固定仓库的 GitHub API；未部署任何凭据代理服务。
