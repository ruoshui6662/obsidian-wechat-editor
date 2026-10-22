# 公众号图文排版 · Obsidian WeChat Editor

在 Obsidian 写作、调整图文排版，通过配套浏览器助手，把包含图片的文章复制到微信公众号后台。

**当前版本：v0.0.3** · 桌面版 Obsidian 1.8.0+ · Chrome / Edge 等 Chromium 116+ 浏览器

[下载安装包](https://github.com/ruoshui6662/obsidian-wechat-editor/releases/tag/v0.0.3) · [完整安装教程](docs/INSTALL.md) · [浏览器配置](docs/BROWSER.md) · [使用说明](docs/USAGE.md) · [常见问题](docs/TROUBLESHOOTING.md)

## 可以做什么

- 原生笔记编辑区写 Markdown，插件顶部「编辑｜预览」切换排版和阅读。
- 全文字体、字号、行距、字距、段距、缩进、两侧留白一次设置；提供五套文章主题和个人方案。
- 点击笔记中的图片单独调整；支持文章默认、全文统一与撤销。
- 图片提供左／居中／右／两端对齐；日常两端对齐默认与正文同宽，再选择无阴影或轻阴影。
- 阴影直接附在图片边缘，不合成外圈白边；圆角、边框和底色可生成同尺寸副本，GIF 保留动画。
- 网络图片先下载为本地附件，再上传至当前登录的公众号，减少直接引用外链造成的丢图。
- 浏览器助手一键申请连接，Obsidian 首次允许；后续自动尝试恢复，无需粘贴长串配对文本。

## 下载什么

| 文件 | 用途 |
| --- | --- |
| [wechat-layout-v0.0.3.zip](https://github.com/ruoshui6662/obsidian-wechat-editor/releases/download/v0.0.3/wechat-layout-v0.0.3.zip) | 安装到你的 Obsidian 笔记库 |
| [wechat-layout-extension-v0.0.3.zip](https://github.com/ruoshui6662/obsidian-wechat-editor/releases/download/v0.0.3/wechat-layout-extension-v0.0.3.zip) | 在浏览器加载图片助手，图文复制需要它 |
| [test-vault-v0.0.3.zip](https://github.com/ruoshui6662/obsidian-wechat-editor/releases/download/v0.0.3/test-vault-v0.0.3.zip) | 独立示例笔记库，含插件与测试图片 |
| [SHA256SUMS.txt](https://github.com/ruoshui6662/obsidian-wechat-editor/releases/download/v0.0.3/SHA256SUMS.txt) | 安装包完整性校验 |

Release 尚在生成或下载不可用时，可从仓库 [downloads 目录](downloads/)下载相同的三个 ZIP（打开文件后点 **Download raw file**）。GitHub 的 **Code → Download ZIP** 是源代码，需要构建后才能安装。

## 五步开始

1. 解压 Obsidian 插件包，将 `wechat-layout` 文件夹放入 `你的笔记库/.obsidian/plugins/`，在「设置 → 第三方插件」启用「公众号图文排版」。
2. 解压浏览器助手包。Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`，开启开发者模式，点「加载已解压的扩展程序」，选中包含 `manifest.json` 的 `extension` 文件夹。
3. 保持 Obsidian 打开，在同一浏览器正常登录 [微信公众号后台](https://mp.weixin.qq.com/)。打开助手，点「连接 Obsidian」，回到 Obsidian 点「允许连接」。
4. 在 Obsidian 打开一篇笔记，按 `⌘P` / `Ctrl+P` 搜索「公众号图文排版」，打开工作区。选择主题，调整文字与图片，在「预览」检查。
5. 点「复制图文」，等待图片处理上传完成，到公众号编辑器**正文区域**用 `⌘V` / `Ctrl+V` 普通粘贴。检查后保存草稿，再用微信手机预览。

首次安装、多个笔记库、浏览器重启与更新步骤见[完整教程](docs/INSTALL.md)。

## 常用默认值

正文默认16px、行距1.8、两侧留白16px；正文段落与图片相邻空白默认28px。三级标题默认18px，可选蓝色分段装饰。图片两端对齐默认沿正文边线，手动左右留白表示相对当前内容区域的实际空白，不是向外延伸量。

同段自动折行属于行距，不是28px段距；标题前后默认28／12px。[排版规则与作用范围](docs/USAGE.md)

## 浏览器与数据

- 需要两个组件运行在**同一台电脑**：Obsidian 插件负责排版，浏览器助手使用你已经登录的公众号页面上传图片。
- 只使用本机 `127.0.0.1:17836–17845` 通信，首次需在 Obsidian 允许。无需 AppID、AppSecret 或手动复制 Cookie。
- 微信登录由你在后台完成；助手不会代替扫码或绕过登录。多个不同公众号同时打开时，先切到目标后台再检查连接。
- 点击「复制图文」会将文章图片上传到当前识别的公众号；正文由你手动粘贴、保存与发布。不会自动创建、覆盖或发布草稿。
- 包内不含个人笔记、配对令牌、账号登录态或 `data.json`。详见[浏览器配置与权限](docs/BROWSER.md)。

## 当前边界

这是首次公开版本的修正版，尚未上架 Obsidian 社区插件市场或浏览器扩展商店，使用手动安装。支持 PNG、JPEG、GIF、静态 WebP；本地处理限制为每张10 MiB、2400万像素。移动端 Obsidian、Safari、Firefox 不在此版本支持范围。

微信可能清理部分样式或调整上传接口，最终请以后台粘贴、草稿重开和手机预览为准。思源宋体可免费商用，但插件不附带字体；读者设备不具备该字体时会回退。[字体与排版说明](docs/USAGE.md#字体)

## 开发与反馈

[开发构建](docs/DEVELOPMENT.md) · [第三方依赖与参考](docs/THIRD_PARTY.md) · [更新记录](CHANGELOG.md)

反馈问题请在 [Issues](https://github.com/ruoshui6662/obsidian-wechat-editor/issues) 提供两个组件的版本、Obsidian／浏览器／系统版本、复现步骤，以及脱敏截图或最小示例。连接问题可附助手「诊断与设置 → 复制诊断」的内容；不要提交 Cookie、密钥或私人文章。
