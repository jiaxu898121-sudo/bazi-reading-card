#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""export_pdf.py — HTML 解读卡 → A4 PDF，并做版式自检（页数 + 内容高度）。

用法：
    python export_pdf.py 卡片.html [-o 输出.pdf] [--target 2]
默认目标 2 页；超出时自动输出诊断（内容高度、建议压缩项）。

注意：需要本机 Edge（默认路径）与可选 Pillow（用于精确测量）。
可通过环境变量 EDGE_PATH 指定浏览器路径。
"""
import argparse, io, os, re, subprocess, sys, tempfile

EDGE = os.environ.get("EDGE_PATH", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
AVAILABLE_H = 1063  # A4 减去 8mm 上下边距后，每页可用高度（96dpi px）


def to_pdf(html_path, pdf_path):
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
           '--print-to-pdf=%s' % os.path.abspath(pdf_path), "file:///" + os.path.abspath(html_path).replace("\\", "/")]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if not os.path.exists(pdf_path):
        raise RuntimeError("PDF 生成失败，请检查 Edge 路径：%s" % EDGE)
    return pdf_path


def page_count(pdf_path):
    data = open(pdf_path, "rb").read()
    return len(re.findall(rb"/Type\s*/Page[^s]", data))


def measure(html_path, width=734):
    """把 @media print 临时换成 @media screen 后截图，测量内容底部 y 值。"""
    try:
        from PIL import Image
    except Exception:
        return None
    src = io.open(html_path, encoding="utf-8").read()
    tmp_html = os.path.join(tempfile.gettempdir(), "_measure_card.html")
    tmp_png = os.path.join(tempfile.gettempdir(), "_measure_card.png")
    io.open(tmp_html, "w", encoding="utf-8").write(
        src.replace("@media print{", "@media screen{").replace('<button class="btn"', '<button class="btn" style="display:none"'))
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--screenshot=%s" % tmp_png,
                    "--window-size=%d,3200" % width, "--virtual-time-budget=6000",
                    "file:///" + tmp_html.replace("\\", "/")],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if not os.path.exists(tmp_png):
        return None
    im = Image.open(tmp_png).convert("L")
    w, h = im.size
    px = im.load()
    last = 0
    for y in range(h):
        if min(px[x, y] for x in range(0, w, 4)) < 235:
            last = y
    return last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html_path")
    ap.add_argument("-o", "--out", default=None)
    ap.add_argument("--target", type=int, default=2, help="期望页数，默认 2")
    args = ap.parse_args()

    pdf_path = args.out or os.path.splitext(args.html_path)[0] + ".pdf"
    to_pdf(args.html_path, pdf_path)
    n = page_count(pdf_path)
    size = os.path.getsize(pdf_path) / 1024
    print("PDF：%s | %d 页 | %.0f KB" % (pdf_path, n, size))

    if n > args.target:
        h = measure(args.html_path)
        print("[版式警告] 超出目标页数 %d → %d 页" % (args.target, n))
        if h:
            print("  打印态内容总高约 %d px（每页可用 %d，目标 %d 页共 %d）" % (h, AVAILABLE_H, args.target, AVAILABLE_H * args.target))
        print("  建议：① 打印态 svg 宽度降到 34%%；② table 字号降到 9.5px、padding 2px；"
              "③ 删除一段 note 或把 cards 由 4 张压成 2 张；④ 检查是否有意外插入的空 div。")
    elif h_ok := (n <= args.target):
        h = measure(args.html_path)
        if h:
            fill = 100.0 * min(h, AVAILABLE_H * n) / (AVAILABLE_H * n)
            print("  版式自检：内容 %.0f%% 铺满 %d 页，留白正常" % (fill, n))


if __name__ == "__main__":
    main()
