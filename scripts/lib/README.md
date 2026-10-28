# lib 目录说明

`paipan.js` 依赖两个文件：

- `bazi_data.js` —— 本技能自有的命理常量表（已随仓提交）。
- `lunar.js` —— 开源日历库 `lunar-javascript`（约 426 KB），**未随仓提交**。

## 如何获取 lunar.js

任选其一：

1. 直接 npm 安装（推荐）：
   ```bash
   npm install lunar-javascript
   ```
   `paipan.js` 已内置回退：`lib/lunar.js` 不存在时会自动 `require('lunar-javascript')`。

2. 手动放置：
   从 [github.com/6tail/lunar-javascript](https://github.com/6tail/lunar-javascript) 下载 `lunar.js`，放到本目录并命名为 `lunar.js`。

3. 在线 CDN（临时验证用）：
   ```bash
   curl -o lunar.js https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js
   ```
