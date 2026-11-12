# 双水村 · 黄土地上的岁月

以《平凡的世界》中的双水村为灵感的三维文学场景。沿东拉河与哭咽河，探索窑洞院落、村落地标与陕北乡村生活。

## 场景内容

- 可旋转、缩放的 Three.js 村落模型
- 孙玉厚家、田福堂家、金家湾等地标导览
- 村落漫游与日照时间切换
- 地理格局、窑洞院落、四时日常场景手记
- 可选的风声与流水声
- 桌面端与移动端布局

建筑尺寸、人物位置和部分陈设为三维表达的合理推演；场景并非实测地理地图。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

## 构建

```sh
npm run build
npm run preview
```

部署到子路径时使用 `npm run build -- --base=./`。本项目无数据库和服务端依赖。

## 发布

`main` 分支更新后，GitHub Actions 自动构建并发布到 GitHub Pages。

线上地址：https://songxiaopeng529.github.io/shuangshui-village/

源代码：https://github.com/songxiaopeng529/shuangshui-village
