# MetricLens 指标速查

在 GA4 / AppsFlyer / Meta 广告后台等**任意网页上划词**，即时看到这个指标是什么意思、公式怎么算、哪里容易搞混。

![icon](icon-preview.png)

---

## 安装（约 1 分钟）

1. 下载 `metric-lens-v1.0.2.zip` 并解压，得到一个 `metric-lens` 文件夹
2. Chrome 地址栏打开 `chrome://extensions`
3. 打开右上角的 **开发者模式**
4. 点 **加载已解压的扩展程序**，选中刚才解压出来的 `metric-lens` 文件夹
5. 建议点一下工具栏的拼图图标，把 MetricLens **固定**出来

> Chrome 会时不时提示"停用开发者模式扩展程序"，点忽略即可，不影响使用。
> 如果嫌烦，可以走 Chrome 商店 unlisted 上架（见文末）。

## 怎么用

| 操作 | 效果 |
|---|---|
| 选中 `eCPM` | 弹出卡片：一句话定义 + 公式 + 相关词 |
| 选中一整句话 | 列出句子里出现的**所有**已收录指标，点任意一条看详情 |
| 点卡片里的「相关」标签 | 跳到那个词条，可以一路点下去 |
| 点「展开全文」 | 看完整词条（解决什么问题 / 例子 / 易混淆点） |
| 点浏览器工具栏图标 | 搜索框 + 按领域浏览全部词条 |
| `Esc` 或点卡片外 | 关闭 |

**选中的文字没命中词库时，什么都不会弹** —— 不会打扰正常的复制粘贴。

面板底部有两个开关：

- **划词即查** —— 总开关，关掉后完全不响应选区
- **自动高亮页面名词**（默认关）—— 打开后会给页面上已收录的名词加虚线下划线，鼠标点一下出卡片。报表页面开这个会有点花，按需使用。

## 隐私说明

这个扩展需要"读取您在所有网站上的数据"权限，因为**划词功能必须能读到你选中的那段文字**。除此之外：

- **不采集、不上报任何页面内容**，选中的文字只在你自己的浏览器内存里查词典
- **没有任何统计、埋点、第三方 SDK**
- 唯一可能发起的网络请求，是从 GitHub 拉取词条数据文件 `terms.json`。当前版本 `REMOTE_URL` 为空，**完全不联网**
- 全部代码是未压缩、未混淆的明文 JS，加起来不到 900 行，可以自己翻一遍：
  - `content.js` —— 划词和卡片
  - `lib/dict.js` —— 查词匹配
  - `lib/md.js` —— Markdown 渲染
  - `background.js` —— 词库更新
  - `popup.js` —— 面板

## 词库

当前 **26 条词条**，覆盖三个领域：

- **买量与变现** —— CPM、eCPM、CVR、CPI、CAC、ARPU、ARPPU、IPU、LTV、LT30/LT180、ROAS、ROAS0/ROAS1、Cohort、ABO/CBO
- **素材与创意** —— Hook rate、Thruplay、CTR、CPC、IPM
- **数据分析与归因** —— Firebase、GA4、AppsFlyer

匹配支持别名和常见误拼：`ECPM`/`千次展示收益`、`ROAS D1`/`次日回收`、`AppFlyer`（少个 s）都能查到。

## 词库怎么更新

词条来源是一个 Markdown 知识库，`build.py` 负责把它编译成 `terms.json`：

```bash
python3 build.py          # 重新生成 data/terms.json 和 extension/data/terms.json
python3 build.py --check  # 只校验不写文件
```

想让所有人自动拿到新词条，把 `data/terms.json` push 到一个 public 仓库，然后把
`extension/background.js` 顶部的 `REMOTE_URL` 填成该文件的 raw 地址即可。
插件每 6 小时同步一次，面板里也能手动点「检查更新」。远程拉取失败时自动沿用内置词库，不会白屏。

## 想加词条？

在知识库 md 里按这个格式写一段，重跑 `build.py` 就行：

```markdown
## 名词 — 一句话副标题

**一句话**：最短的定义。

**解决什么问题**：……

**例子**：……

**易混淆**：……

**相关**：[[其他词条]]
```

- 第一个不超过 8 行的代码块会被当成**公式**显示在卡片上
- 缩写、中文名、常见误拼写进 `aliases.json`。**只写「同一个概念的不同写法」** ——
  相关但不同的概念（IPM 之于 CVR、ARPPU 之于 ARPU、Adjust 之于 AppsFlyer）必须各自建词条，
  否则选中它会弹出另一个词的卡片。`build.py` 有两道防呆检查会拦住这种错
- 涉及内部数据的段落前加一行 `<!-- private -->`，**构建时会自动剔除，不会进入公开数据**（`build.py` 还会扫描项目代号做兜底，命中就直接中止构建）

## 上架 Chrome 商店（可选）

开发者模式加载的扩展每次开浏览器都会被提示。如果要给组里长期用，可以：

1. 交一次性 $5 注册开发者账号
2. 上传 zip，**可见性选 Unlisted（不公开）** —— 不会出现在商店搜索里，只有拿到链接的人能装
3. 审核通过后，同学点链接一键安装，且扩展本体也能自动更新

## 目录结构

```
metric-lens/
├── build.py            知识库 md → terms.json
├── aliases.json        手工维护的别名表
├── make_icons.py       生成图标
├── package.sh          打包 zip
├── data/terms.json     构建产物（将来 push 到 public 仓给大家自动更新）
├── extension/          ← 加载到 Chrome 的就是这个目录
│   ├── manifest.json
│   ├── content.js      划词与卡片
│   ├── background.js   词库同步
│   ├── popup.html/js/css
│   ├── lib/dict.js     查词匹配
│   ├── lib/md.js       Markdown 渲染
│   └── data/terms.json 内置词库（离线兜底）
└── test/               单元测试与本地 demo 页
```

## 测试

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
  test/fixture.js extension/lib/dict.js extension/lib/md.js test/test_dict.js
```

覆盖大小写/中文别名/误拼、词边界（`CPIA` 不会误报成 `CPI`）、长别名优先（`LT30` 不被 `LT` 抢）、
Markdown 表格与转义、别名不得指向相关但不同的概念，以及全部词条整篇渲染不报错。
