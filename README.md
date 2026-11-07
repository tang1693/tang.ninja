# tang.ninja

Yang Tang 的科研主页，加上孩子们做的浏览器游戏。

推送到 GitHub 后，Cloudflare 会自动运行 `build.mjs` 并上线，**本地不需要运行任何东西**，一两分钟后网站就更新了。

## 哪个网址对应哪个文件夹

| 网址 | 内容在哪里 |
| --- | --- |
| tang.ninja | `home/index.html`（科研主页） |
| chizi.tang.ninja | `kids/chizi/games/` |
| mozi.tang.ninja | `kids/mozi/games/` |
| liangzi.tang.ninja | `kids/liangzi/games/` |

孩子们的页面是根据 `games/` 文件夹里的 `.html` 自动生成的。主页和孩子们的页面互相不放链接，工作和家里的分开。

## 加一个新游戏

1. 在 GitHub 网页上打开 `kids/<名字>/games/`，点 **Add file → Upload files**，把游戏的 `.html` 拖进去，点 **Commit changes**。
2. 等一两分钟，游戏会出现在这个孩子页面的最前面，并在 14 天内显示 “New”。

可选：
- **封面图**：上传一张和游戏同名的图片（比如 `Gearstorm-Arena.html` 配 `Gearstorm-Arena.jpg`）。
- **简介、日期和顺序**：编辑同一层的 `games.json`。写在列表最上面的排在最前。

## 更新一个已有的游戏

上传同名文件覆盖就行。

## 修改主页

- 文字、论文列表和 CV：都直接写在 `home/index.html` 里（荣誉、教育、经历、学术服务），网站上不提供 CV 下载。要改什么，编辑这个文件，或者直接告诉 Claude。
- 引用数据（总引用、h-index、每年引用）也写在 `home/index.html` 里，需要更新时告诉 Claude。
- 05 Service 里每本期刊旁边的影响因子是 JCR 2025（2026 年 6 月发布）的数据，每年 7 月新的 JCR 出来后，告诉 Claude 更新一下。
- 顶部的插画：`home/hero/` 里的图层和动画小件，全部由 `tools/hero.py` 画出来（运行 `python3 tools/hero.py`）。想改画面，告诉 Claude。白色的正文紧接在插画下面，往下滚时整页一起走，不会盖住插画；插画的图层只跟着鼠标轻轻移动。
- 以后要加“项目”板块，告诉 Claude 放在哪一节后面就行。
- 开场的“搭建”动画：每个浏览器会话第一次打开主页时，先是一个终端开机画面和 24 个代理的点名，黑幕像卷帘门一样升起，每个名牌变成一个光标，先像一群鱼一样在夜空中间绕圈（两圈反着转），再一个接一个拖着尾巴散开，飞到自己的岗位。开头的城市像摄影测量重建一样一步步出来（控制点、相机对齐、点云、网格、贴图、开灯），画家给怪兽上色、机械师让机器人出拳。开头的城市建完之前页面不能滚动（右下角的 “Skip the build” 随时可以跳过）。开头建完、往下滚到正文时，正文才开始建：滚到哪里建到哪里，屏幕上的部分一起开工，一次最多铺开 1.3 屏；上面一块快建完时（最后 8 秒左右），紧挨着的下一块就提前开工，不等上面全部完成（比如 Education and experience 还没建完，Service 已经开始了），等你滚到那里它已经在建了；还没建的地方是空白的，但随时都能往下滚，往下滚也不会让施工变快或变慢。每一块都先画草图：铅笔虚线一条边一条边画出方框并标上尺寸、灰色横条占住文字的位置，然后描成实线、给有颜色的卡片刷上颜色，接着才填内容，再润色、修改、调整，最后把方框对齐网格、擦掉草图。光标像鱼群一样游：飞得远的会走一道弧线，飞得快的身后拖着一串渐隐的小箭头；每一块开工时，这一块的光标从屏幕一侧成群游进来，再各自散开去画草图。光标数量是动态的：哪部分准备好了、负责它的光标还在忙，就当场生成新的光标（writer-4、eval-3……）接手，不让任何东西干等；整页大约两分钟。光标分散在屏幕各处，每人负责草图的一片；没活干的光标一律退到屏幕外，下一个活马上要开始时才提前走到那儿，用的时候再飞回来。所有文字都是光标自己打出来的，而且会先写草稿再改（“Yang Tnag”改成 “Yang Tang”、标题从 Awards 改成 Honors、论文标题打错字再改回来等等，只改措辞，不改事实），作者名单里的 Yang Tang 由 researcher 一个个加粗；期刊先打乱再排好；光标会冒出自己的“想法”。red-team 一路搞破坏（把三角形倒过来、把黄色方块弄歪、把引用数 453 改成 4,530、把邮箱改成 0su……），每次都有人修好或拦下。点一下或按键加速，右下角 “Skip the build” 直接显示全部；带 #锚点 的链接不播放。代码在 `home/swarm/`（`crew.js` 是剧本，`swarm-build.js` 是开源库）。想再看一遍：页面最底下的 “Watch the crew build this page again”，或者开一个新的无痕窗口。

## 每个孩子的页面风格

在 `site.json` 里，每个孩子有一个 `theme`：

- `hazard`：黑黄警示条纹（Chizi）
- `comic`：漫画风（Mozi）
- `dossier`：档案袋风（Liangzi）

样式文件在 `shared/themes/`。想换风格或加新风格，告诉 Claude。

## 加一个新的子域名

1. 在 `site.json` 里加一项：`id` 是子域名，`name` 是页面上显示的名字，`theme` 选一个风格。
2. 建文件夹 `kids/<id>/games/`，放进游戏。
3. 在 Cloudflare 的 tang-ninja 这个 Worker 里，**Settings → Domains & Routes** 加上 `<id>.tang.ninja`。

## Cloudflare 设置（只需要做一次）

Workers & Pages → Create → 从 GitHub 导入 `tang1693/tang.ninja`：

- Build command：`node build.mjs`
- Deploy command：`npx wrangler deploy`（仓库里的 `wrangler.jsonc` 会把 `dist/` 当静态文件发布，把 `dist/_worker.js` 当路由）
- 部署完成后，Settings → Domains & Routes → Add → Custom domain，加上 `tang.ninja`、`www.tang.ninja`、`chizi.tang.ninja`、`mozi.tang.ninja`、`liangzi.tang.ninja`（域名的 DNS 要托管在 Cloudflare）
