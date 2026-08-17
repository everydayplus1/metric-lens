#!/bin/bash
# 更新词库并发布：重新构建 -> 提交 -> 推到 GitHub
# 推上去之后，所有装了 MetricLens 的人下次同步（最多 6 小时，或在面板点「检查更新」）
# 就会自动拿到新词条，不用重装扩展。
set -e
cd "$(dirname "$0")"

python3 build.py

if git diff --quiet -- data/ extension/data/; then
  echo "词库没有变化，无需发布"
  exit 0
fi

COUNT=$(python3 -c "import json;print(len(json.load(open('data/terms.json'))['terms']))")
git add -A
git commit -m "更新词库：${COUNT} 条词条"
git push

echo
echo "已发布。同学的插件会在下次同步时自动更新到 ${COUNT} 条。"
echo "raw 地址：https://raw.githubusercontent.com/everydayplus1/metric-lens/main/data/terms.json"
