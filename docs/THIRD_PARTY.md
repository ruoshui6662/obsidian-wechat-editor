# 第三方依赖与参考

运行包使用 markdown-it（MIT）、yaml（ISC）和 ws（MIT），及 markdown-it 的传递依赖。准确版本由 pnpm-lock.yaml 锁定。打包脚本从已安装依赖收集原始许可证，生成插件包内 THIRD_PARTY_LICENSES.txt；不会将开发依赖一并发布。

Obsidian API 是宿主提供的运行接口，obsidian 类型包只供开发；esbuild、TypeScript、Vitest、jsdom 只用于开发和构建。浏览器助手没有远程脚本，也不包含 Node 运行时依赖。

本项目自行实现解析集成、排版渲染、桥接与上传适配，没有复制以下项目的源码片段：

- [doocs/md](https://github.com/doocs/md/tree/f8d91268237bf34c026b91c04586f7daf5fc1f13)：参考内联排版与复制流程，WTFPL。
- [Wechat Converter](https://github.com/DavidLam-oss/obsidian-wechat-converter/tree/f18c26916af663d581eb381898623f2143be9528)：参考 Obsidian 图片解析和通信分工，MIT。
- [Wechatsync 微信适配器](https://github.com/wechatsync/Wechatsync/blob/a98e42865387285afcc027c61836488748f3b30f/packages/core/src/adapters/platforms/weixin.ts)：研究后台同源 multipart 上传路径和响应字段，GPL-3.0；未引入其 SDK 或实现代码。若未来采用上游代码，需重新核对相应许可证义务。
- [NoteToMP](https://github.com/sunbooshi/note-to-mp)：仅作功能调查，未引入其核心子模块或付费素材。
- [Qiaomu Publish](https://github.com/joeseesun/qiaomu-publish/tree/e0ce43cd7a09278341d0a1977aaf8d06881cf525)：MIT；参考资源完整性检查、内联排版、目录重命名处理，以及主题色条选择、主题基础与手动覆盖分层，未采用其实现片段或资源。

UI 和测试图片由本项目生成；用户提供的参考资料不进入公开仓库或安装包。壹伴名称仅指用户提出的交互参考，本项目与其没有关联。


原生编辑区图片入口使用 Obsidian 宿主提供的 `@codemirror/state`、`@codemirror/view` 和 `editorInfoField`。CodeMirror 在开发依赖中显式声明，生产构建保持 external，未额外打包编辑器运行时。
