# 八字解读卡（bazi-reading-card）

一个可复用的 WorkBuddy 技能：根据出生年月日时生成八字「解读卡」，输出可打印的 A4 PDF。含**家长版**（未成年人）与**职业版**（成年人）两种版式，内置独立排盘引擎，不依赖任何外部排盘软件。

## 它做什么

1. **独立排盘**：`scripts/paipan.js` 自算四柱十神、藏干、星运、旺衰、格局、喜忌、起运时间与八步大运（顺逆）、神煞、地支关系、称骨（男女版歌诀）、八宅命卦与八方表。可做真太阳时校正。
2. **卡片渲染**：`scripts/render_card.py` 把「卡片 JSON」渲染成宋式配色 HTML。
3. **导出 PDF**：`scripts/export_pdf.py` 用 Edge headless 生成 A4 PDF，并做页数与铺满度自检。

## 目录结构

```
bazi-reading-card/
├── SKILL.md                      技能主文件（触发条件 + 五步工作流 + 红线）
├── README.md                     本文件
├── scripts/
│   ├── paipan.js                 排盘引擎（node）
│   ├── render_card.py            JSON → HTML
│   ├── export_pdf.py             HTML → A4 PDF + 版式自检
│   └── lib/
│       ├── bazi_data.js          干支/称骨/命卦等常量表
│       └── README.md             lunar.js 依赖获取说明
├── references/
│   ├── 卡片写作规范.md            家长版 / 职业版板块清单与语气
│   └── 命理口径与常见坑.md        大运顺逆、称骨男女版、配色、方位冲突处理等
├── assets/template.html          卡片模板
└── examples/                     两份可复用范例 JSON
```

## 快速开始

```bash
# 1) 安装依赖（日历库）
npm install lunar-javascript

# 2) 排盘
node scripts/paipan.js --date 1996-06-01 --hour 9 --sex m [--lng 115.9] --pretty

# 3) 写卡片 JSON（参考 examples/），然后渲染 + 导出
python scripts/render_card.py 卡片.json -o 输出.html --pdf
```

> 说明：`scripts/lib/lunar.js` 未随仓提交（约 426 KB 的开源日历库），引擎已内置回退逻辑，装了 `lunar-javascript`（npm）即可运行，详见 `scripts/lib/README.md`。

## 隐私与口径

- 卡片不写客户姓名与出生日期原文，姓名处留空手写，只用干支与农历简称。
- 命理属传统文化参考视角，看倾向不作定论；健康写「请遵医嘱」，财务写「请咨询专业人士」。
- 所有判断尽量标注依据或可复核公式；存疑处明确标「存疑」。
