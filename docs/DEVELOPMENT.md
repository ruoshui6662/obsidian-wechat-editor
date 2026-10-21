# v0.0.1 开发与构建

需要 Node.js 22+、pnpm 10.11.0、系统 zip/unzip。运行时用户无需安装这些工具。源码按 core（解析与内联渲染）、plugin（Obsidian工作区／本机桥接）、extension（浏览器连接／公众号上传）分层。

```sh
git clone https://github.com/ruoshui6662/obsidian-wechat-editor.git
cd obsidian-wechat-editor
corepack enable
corepack prepare pnpm@10.11.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm package
```

构建输出：

- `dist/obsidian/wechat-layout/`：安装到笔记库的插件文件夹。
- `dist/extension/`：浏览器可直接加载的编译后扩展。
- `release/`：两个组件ZIP、独立示例库ZIP、SHA256。
- 根目录 `manifest.json`：从插件清单同步，便于Obsidian工具读取；`versions.json`记录最低宿主要求。

`fixtures/vault`只含合成示例图与测试笔记。`scripts/generate-fixtures.mjs`是可选的测试资源生成器；正常构建使用已提交的fixtures。测试中使用模拟宿主，不代表真实Obsidian或微信像素验收。

## 版本与公开发布

用户可见版本、标签与安装包名称为 **v0.0.1**。Obsidian与Chrome清单以及package.json按各自格式要求存为 `0.0.1`，不带v。修改版本需同步三个清单与versions.json，再构建打包。

仓库 `downloads/` 保存已验证的首发安装包作为下载备用；不含配对令牌、data.json或个人笔记。GitHub Actions对main上的发布改动安装依赖、测试、类型检查和构建，通过后校验已提交安装包并创建Release，附两个组件与测试库ZIP及Obsidian三文件。若同名Release已存在，不自动覆盖它。

提交源码时不要加入真实笔记库、浏览器登录态、上传响应中的会话字段、配对凭据、构建sourcemap或node_modules。第三方运行依赖许可由打包脚本收集到插件包内，见[第三方说明](THIRD_PARTY.md)。
