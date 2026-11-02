# Meedee · 钢琴练习室

为 iPad 放在琴架上跟练而做的 MIDI 播放器。纯 HTML、CSS、JavaScript，无后端、无账号、无运行时 CDN 依赖，可部署到 GitHub Pages。

## 可以做什么

- 真实钢琴采样播放，与下落音符和亮键同步。
- 左手绿色、右手杏色；可以单独关闭一只手的声音，对应音符会变淡。
- 播放、暂停、拖动进度、前后跳转 5 秒。
- 0.25×–1.50× 调速，保持音高。
- 最多升降 12 个半音，声音、音符位置、键盘和调名同步变化。
- 按小节选 A–B 循环，也能用当前位置设置精确端点。
- 原声部左右手分配；单声部 MIDI 可以按音高分手。
- 导入 `.mid` / `.midi`，保存在当前设备的浏览器里，不上传。
- iPad 横屏优先，同时支持竖屏、手机、电脑和专注模式。
- 从头播放可预备 3 秒；网页进入后台时自动暂停。
- 页面、内置曲目和钢琴采样缓存完成后可离线使用。Safari 可将网页添加到主屏幕。

## 内置曲目

**Canon in D — Johann Pachelbel**：Noctave 完整钢琴编曲，57 小节，原速 56 BPM，约 4 分 04 秒，963 个音符；右手 513 个，左手 450 个。左右手按原版钢琴谱的上下谱表分配，交叉音区也保留原声部。

《卡农》有多种钢琴改编。这里使用的版本完整保留该钢琴编曲的全部 57 小节，并将许可明确的 MusicXML 转为双声部 MIDI。若想学某个特定演奏者的版本，可以导入对应 MIDI。

曲目与采样的来源及署名见 [CREDITS.md](CREDITS.md)。

## 本地打开

安装 Node.js 22 或更新版本后：

```sh
npm run dev
```

打开 `http://localhost:5173`，无需安装依赖。请通过 HTTP 打开，浏览器直接打开 `index.html` 的 `file://` 地址不支持所需的模块与文件读取。

同一局域网内，iPad 可通过运行电脑的局域网 IP 加 `:5173` 访问；正式使用推荐 GitHub Pages 的 HTTPS 地址。

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。在 GitHub 仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**。推送到 `main` 后，先运行验证，再自动部署静态文件。所有资源采用相对地址，兼容 `https://用户名.github.io/Meedee/` 这样的仓库子路径。

也可以选择 **Deploy from a branch → main → / (root)**，整站无需构建。默认使用 Actions，以便先检查再发布。

## 验证

```sh
npm test
npm run check
```

核心测试覆盖完整曲目与主题音符、手部分配、移调、黑白键对齐、变速与变拍号、延音踏板、音频时钟、暂停与跳转、倒计时和循环边界。

## 技术说明

- 使用 Web Audio 的音频时钟统一控制声音与画面；音符提前排程，循环下一轮也提前安排。
- 调速只改变事件时间和按键时长；移调才改变采样的播放音高。
- 暂停、跳转、调速和移调都会取消旧排程，避免旧音符继续发声。
- MIDI 支持通常的 PPQ 格式 0 / 1、速度和拍号变化，以及 CC64 延音；忽略打击乐。暂不支持 SMPTE 时间格式。导入限制为 8 MB、10 万个音符、6 小时。
- 导入 MIDI 若没有可靠的左右手声部，自动分色只是练习辅助；可在设置里调整分界。内置曲目使用明确标注的左右手。
- 本版面向看画面跟练，不连接电钢琴。iPad Safari 目前不原生支持 Web MIDI；在支持 Web MIDI 的电脑浏览器中，可进一步加入实时键盘输入。
- JavaScript 模块位于 `src/`，MIDI 解析器已固定为 `@tonejs/midi 2.0.28`，随站点保存在 `vendor/`。

## 重建内置 MIDI（仅维护时需要）

MusicXML 源文件已保存在 `assets/source/`。使用 Python 3 标准库和 Node.js：

```sh
python scripts/convert-canon.py
node scripts/build-canon.mjs
npm test
```

`scripts/fetch-assets.mjs` 可以重新获取署名来源的采样和源文件。网站运行无需这些维护步骤。

本项目原创代码使用 MIT 许可；第三方曲目、采样和解析器遵循各自许可。
