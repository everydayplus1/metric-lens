#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成扩展图标：圆角深蓝底 + 放大镜，镜片里是三根递增的柱子。
按 4 倍画再缩小，得到抗锯齿边缘。"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'extension', 'icons')
S = 512          # 工作画布
BG1 = (34, 78, 158)
BG2 = (47, 111, 208)
FG = (255, 255, 255)


def make():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角底 + 竖直渐变
    radius = int(S * 0.22)
    grad = Image.new('RGBA', (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        f = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=(
            int(BG1[0] + (BG2[0] - BG1[0]) * f),
            int(BG1[1] + (BG2[1] - BG1[1]) * f),
            int(BG1[2] + (BG2[2] - BG1[2]) * f), 255))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    # 放大镜：镜圈
    cx, cy, r = int(S * 0.44), int(S * 0.42), int(S * 0.26)
    ring = int(S * 0.055)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=FG, width=ring)

    # 手柄
    hw = int(S * 0.055)
    d.line([(cx + int(r * 0.72), cy + int(r * 0.72)),
            (int(S * 0.80), int(S * 0.79))], fill=FG, width=hw)
    d.ellipse([int(S * 0.80) - hw // 2, int(S * 0.79) - hw // 2,
               int(S * 0.80) + hw // 2, int(S * 0.79) + hw // 2], fill=FG)

    # 镜片里的三根柱子（递增，暗示指标上升）
    bw = int(r * 0.28)
    gap = int(r * 0.13)
    base = cy + int(r * 0.52)
    heights = [int(r * 0.45), int(r * 0.75), int(r * 1.05)]
    total = 3 * bw + 2 * gap
    x = cx - total // 2
    for h in heights:
        d.rounded_rectangle([x, base - h, x + bw, base], radius=int(bw * 0.28), fill=FG)
        x += bw + gap

    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    big = make()
    for size in (16, 48, 128):
        big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, 'icon%d.png' % size))
        print('写入 icons/icon%d.png' % size)
    big.resize((256, 256), Image.LANCZOS).save(os.path.join(HERE, 'icon-preview.png'))
    print('写入 icon-preview.png（预览用）')


if __name__ == '__main__':
    main()
