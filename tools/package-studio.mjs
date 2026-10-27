import { cp, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, pages, folders } from './site.mjs';

const output=process.argv[2],license=process.argv[3];
if(!output||!license)throw Error('Usage: node tools/package-studio.mjs NEW_OUTPUT_DIRECTORY NODE_LICENSE_FILE');
if(process.platform!=='win32'||process.arch!=='x64')throw Error('This package bundles the current Windows x64 Node runtime; build on Windows x64.');
const destination=path.resolve(output);
try{await stat(destination);throw Error('Output directory already exists; choose a new name.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(destination,{recursive:true});
for(const entry of [...pages,...folders,'tools','docs','tests','.github','AGENTS.md','README.md','package.json','package-lock.json','.gitignore'])await cp(path.join(root,entry),path.join(destination,entry),{recursive:true});
await mkdir(path.join(destination,'runtime'));
await cp(process.execPath,path.join(destination,'runtime','node.exe'));
await cp(license,path.join(destination,'runtime','Node-LICENSE.txt'));
await writeFile(path.join(destination,'START-STUDIO.cmd'),'@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\n"%~dp0runtime\\node.exe" "%~dp0tools\\portable.mjs"\r\nif errorlevel 1 pause\r\n');
await writeFile(path.join(destination,'START-STUDIO.command'),'#!/bin/sh\ncd "$(dirname "$0")"\nnode tools/portable.mjs\n');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await writeFile(path.join(destination,'PACKAGE.json'),JSON.stringify({name:'GRA Studio portable development workspace',repository:'https://github.com/x6nightfox6x-a11y/genesis-rhapsody-arena',revision,createdAt:new Date().toISOString(),runtime:process.version,platform:'Windows x64',containsCredentials:false},null,2));
await writeFile(path.join(destination,'开始使用.txt'),`GRA STUDIO 便携开发包

一、在另一台 Windows 64 位电脑启动
1. 完整解压整个文件夹，不要在 ZIP 压缩包内启动。
2. 双击 START-STUDIO.cmd。浏览器会自动打开完整 GRA Studio。
3. 保持启动窗口开启；关闭该窗口即可停止 Studio。
不用安装 Node、npm 或 Python，第一次启动也不需要联网。电脑需要已有 Edge 或 Chrome 浏览器。
若没有自动打开，在浏览器输入启动窗口显示的网址。

二、带走你的角色和地图
浏览器里的草稿不会因为复制源码而自动搬走。
离开旧电脑前，在 Studio 顶部点“↓ 迁移备份”，把下载的 JSON 放进这个文件夹一起带走。
到新电脑启动后，点“↑ 恢复备份”，选择该 JSON。
备份包含：角色草稿、角色编辑器自动存档、当前地图人物及站位、地图存档、界面语言。
它保留布阵，不保存战斗中临时的 HP/AP 或动作进度。
恢复会更新同编号角色和对应地图；其它角色保留。恢复前也可以先导出新电脑自己的备份。
每次换电脑前再次导出备份。仅复制文件夹不会迁移后来新增的浏览器草稿。
若本包包含“我的工作备份.json”，请先恢复这个文件。

三、继续开发
此文件夹包含可编辑的完整源码、地图、角色卡、测试、开发说明和 GitHub 自动检查配置。
可以直接把整个文件夹交给 Codex/GPT，先读 AGENTS.md 和 docs/DEVELOPMENT.md。
无需安装依赖即可编辑、测试游戏；运行自动化浏览器测试时才需要联网安装开发依赖。
源码修改直接保存到这个文件夹，刷新 Studio 即生效。
角色编辑器的“保存”保存在当前浏览器；用“迁移备份”带走，或用“发布”同步 GitHub。
一键 GitHub 发布角色仍可用，新电脑需要自行重新连接。GitHub 登录凭证不包含在包内。
项目仓库：https://github.com/x6nightfox6x-a11y/genesis-rhapsody-arena
本包是源码快照，不含 .git 历史。GitHub 上后来的更新不会自动覆盖此副本。

四、其它系统
本包内置运行程序仅适用于 Windows x64。
Mac / Linux 可使用同一份源码：安装官方 Node.js 22 或更新版本后，在此文件夹运行 node tools/portable.mjs。

五、端口
默认本地地址是 http://127.0.0.1:4173/studio.html。
端口占用时自动使用 4174–4193；地址不同会使用独立浏览器存档，可用“恢复备份”迁移。
服务器只监听本机，不会开放给局域网。
`,'utf8');
console.log('Portable Studio created:',destination);
