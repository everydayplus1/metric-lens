#!/bin/bash
# 打包成可分发的 zip：解压后得到一个 metric-lens 文件夹，直接加载到 Chrome
set -e
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
STAGE=".stage/metric-lens"
OUT="dist/metric-lens-v${VERSION}.zip"

python3 build.py

rm -rf .stage && mkdir -p "$STAGE" dist
cp -R extension/. "$STAGE"/
cp README.md "$STAGE"/README.md
find "$STAGE" -name '.DS_Store' -delete

rm -f "$OUT"
(cd .stage && zip -qr "../$OUT" metric-lens)
rm -rf .stage

echo "打包完成: $OUT ($(du -h "$OUT" | cut -f1))"
unzip -Z1 "$OUT" | sed 's/^/  /'
