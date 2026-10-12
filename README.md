# tang.ninja

Yang Tang 的科研主页，加上孩子们做的浏览器游戏。

推送到 GitHub 后，Cloudflare Pages 会自动运行 `build.mjs` 并上线，**本地不需要运行任何东西**，一两分钟后网站就更新了。

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
- 顶部的插画：`home/hero/` 里的图层和动画小件，全部由 `tools/hero.py` 画出来（运行 `python3 tools/hero.py`）。想改画面，告诉 Claude。
- 以后要加“项目”板块，告诉 Claude 放在哪一节后面就行。

## 每个孩子的页面风格

在 `site.json` 里，每个孩子有一个 `theme`：

- `hazard`：黑黄警示条纹（Chizi）
- `comic`：漫画风（Mozi）
- `dossier`：档案袋风（Liangzi）

样式文件在 `shared/themes/`。想换风格或加新风格，告诉 Claude。

## 加一个新的子域名

1. 在 `site.json` 里加一项：`id` 是子域名，`name` 是页面上显示的名字，`theme` 选一个风格。
2. 建文件夹 `kids/<id>/games/`，放进游戏。
3. 在 Cloudflare 的 Pages 项目里，**Custom domains** 加上 `<id>.tang.ninja`。

## Cloudflare Pages 设置（只需要做一次）

- Build command：`node build.mjs`
- Build output directory：`dist`
- Custom domains：`tang.ninja`、`www.tang.ninja`、`chizi.tang.ninja`、`mozi.tang.ninja`、`liangzi.tang.ninja`
