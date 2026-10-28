#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""render_card.py — 把「卡片 JSON」渲染成解读卡 HTML（并可选直接导出 PDF）。

用法：
    python render_card.py card.json -o 输出.html [--pdf]

卡片 JSON 结构（全部字段说明见 examples/example_career.json）：
{
  "title": "八字命盘 · 职业版解读",
  "sub": "乾造 · 1996 年 · 农历四月十六 酉时",
  "right": "印旺身强 · 食神生财",
  "fills": [{"k": "命主", "w": 110}, {"k": "现职", "w": 110}, {"k": "解读日期", "w": 100}],
  "pillars": [{"lab":"年","gan":"丙","ganWx":"火","zhi":"子","zhiWx":"水","sm":"正印 · 偏财"}, ...],
  "chips": ["己土日主 · 巳月巳日双帝旺", ...],
  "quote": "<带 <b> 强调的一句话总评>",
  "footnote": "底部免责与隐私说明",
  "sections": [
     {"type":"cards","t":"命局底子","cols":2,"items":[{"t":"标题","d":"正文"}, ...]},
     {"type":"svg","t":"结构图标题","svg":"<svg viewBox=\"0 0 680 300\" ...>...</svg>"},
     {"type":"table","t":"表格标题","head":["阶段","大运","职业含义","怎么做"],"rows":[["22–32 岁","丙申","...","..."]]},
     {"type":"note","t":null,"html":"<说明文字，可含标签>"},
     {"type":"html","html":"<任意 HTML 片段>"},
     {"type":"break"}
  ]
}
"""
import argparse, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "assets", "template.html")


def build_pillars(pillars):
    out = []
    for p in pillars:
        out.append(
            '<div class="col"><div class="lab">%s</div>'
            '<div class="gz"><span style="color:var(--%s)">%s</span><span style="color:var(--%s)">%s</span></div>'
            '<div class="sm">%s</div></div>'
            % (p.get("lab", ""), p.get("ganWx", "土"), p.get("gan", ""),
               p.get("zhiWx", "土"), p.get("zhi", ""), p.get("sm", ""))
        )
    return "".join(out)


def build_fills(fills):
    return "　".join('%s：<span style="min-width:%dpx"></span>' % (f.get("k", ""), int(f.get("w", 110))) for f in fills)


def render_cards(sec):
    cols = sec.get("cols", 2)
    items = "".join(
        '<div class="card"><div class="t">%s</div><div class="d">%s</div></div>' % (i.get("t", ""), i.get("d", ""))
        for i in sec.get("items", [])
    )
    style = "" if cols == 2 else ' style="grid-template-columns:1fr;"'
    return '<div class="grid2"%s>%s</div>' % (style, items)


def render_table(sec):
    head = "".join('<th style="padding:6px 8px; text-align:left; border:1px solid var(--line);">%s</th>' % h for h in sec.get("head", []))
    rows = []
    for r in sec.get("rows", []):
        cells = "".join('<td style="padding:6px 8px; border:1px solid var(--line);">%s</td>' % c for c in r)
        rows.append("<tr>%s</tr>" % cells)
    return ('<table style="width:100%%; border-collapse:collapse; font-size:11.5px; background:#fff;">'
            '<thead><tr style="background:var(--sage-l); color:#4E5A44;">%s</tr></thead><tbody>%s</tbody></table>'
            % (head, "".join(rows)))


def render_svg(sec):
    return ('<svg viewBox="0 0 680 300" width="100%%" role="img" '
            'style="background:#fff;border:1px solid var(--line);border-radius:6px;">%s</svg>'
            % sec.get("svg", ""))


def render_section(sec):
    t = sec.get("type", "")
    if t == "break":
        return '<div style="page-break-before:always;"></div>'
    body = ""
    if t == "cards":
        body = render_cards(sec)
    elif t == "table":
        body = render_table(sec)
    elif t in ("note", "html"):
        cls = "note" if t == "note" else ""
        html = sec.get("html", "")
        if cls:
            body = '<div class="note">%s</div>' % html
        else:
            body = html
    elif t == "svg":
        body = sec.get("svg", "") if "<svg" in sec.get("svg", "") else render_svg(sec)
    elif t == "olist":
        body = "<ol>%s</ol>" % "".join("<li>%s</li>" % x for x in sec.get("items", []))
    if sec.get("t"):
        head = '<h2>%s</h2>' % sec["t"]
    else:
        head = ""
    pre = sec.get("pre", "")
    return head + pre + body


def render(data, template_path=TEMPLATE):
    tpl = io.open(template_path, encoding="utf-8").read()
    mapping = {
        "{{TITLE}}": data.get("title", "八字命盘 · 解读卡"),
        "{{SUB}}": data.get("sub", ""),
        "{{RIGHT}}": data.get("right", ""),
        "{{FILLS}}": build_fills(data.get("fills", [])),
        "{{PILLARS}}": build_pillars(data.get("pillars", [])),
        "{{CHIPS}}": "".join('<span class="chip">%s</span>' % c for c in data.get("chips", [])),
        "{{QUOTE}}": data.get("quote", ""),
        "{{SECTIONS}}": "".join(render_section(s) for s in data.get("sections", [])),
        "{{FOOTNOTE}}": data.get("footnote", ""),
    }
    for k, v in mapping.items():
        tpl = tpl.replace(k, v)
    return tpl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path")
    ap.add_argument("-o", "--out", default=None, help="输出 HTML 路径（默认与 JSON 同名同目录）")
    ap.add_argument("--pdf", action="store_true", help="同时调用 export_pdf.py 导出 PDF")
    args = ap.parse_args()

    data = json.load(io.open(args.json_path, encoding="utf-8"))
    html = render(data)
    out = args.out or os.path.splitext(args.json_path)[0] + ".html"
    io.open(out, "w", encoding="utf-8").write(html)
    print("已生成 HTML：%s（%.0f KB）" % (out, os.path.getsize(out) / 1024))
    if args.pdf:
        import subprocess
        exp = os.path.join(HERE, "export_pdf.py")
        r = subprocess.run([sys.executable, exp, out])
        if r.returncode != 0:
            print("[提示] PDF 导出未自动完成，可手动执行：python export_pdf.py \"%s\"" % out)


if __name__ == "__main__":
    main()
