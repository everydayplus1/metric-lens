#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MetricLens 数据构建脚本

把知识库里的 *.md 解析成扩展用的 terms.json。

用法：
    python3 build.py                 # 默认读 ~/knowledge
    python3 build.py --src <dir>     # 指定知识库目录
    python3 build.py --check         # 只校验不写文件

    知识库路径也可以用环境变量 METRICLENS_SRC 指定。

安全约定：
    md 里单独一行的 <!-- private --> 会让紧随其后的段落（到下一个空行为止）
    被剔除，不进入公开数据。<!-- private-term --> 放在词条标题下方则整条剔除。
"""
import argparse
import io
import json
import os
import re
import sys
from datetime import date

DEFAULT_SRC = os.environ.get('METRICLENS_SRC', os.path.expanduser('~/knowledge'))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATHS = [
    os.path.join(HERE, 'data', 'terms.json'),
    os.path.join(HERE, 'extension', 'data', 'terms.json'),
]
VERSION = '1.0.3'

# 这些标题是概览/串讲，不是可划词的名词，只在面板里出现
OVERVIEW_PREFIXES = ('先看全局', '实战', '目录')


def strip_private(body):
    """剔除 <!-- private --> 标记的段落（标记行之后到下一个空行）"""
    lines = body.split('\n')
    out, i, removed = [], 0, 0
    while i < len(lines):
        if lines[i].strip() == '<!-- private -->':
            i += 1
            while i < len(lines) and lines[i].strip() != '':
                i += 1
            removed += 1
            continue
        out.append(lines[i])
        i += 1
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip(), removed


def split_title(raw):
    """'eCPM — 有效千次展示收益' -> ('eCPM', '有效千次展示收益')"""
    for sep in ('—', '——', ' - '):
        if sep in raw:
            head, _, tail = raw.partition(sep)
            return head.strip(), tail.strip()
    return raw.strip(), ''


def normalize(s):
    """归一化用于匹配：小写 + 去掉空白和常见标点"""
    s = s.lower().strip()
    s = re.sub(r'[\s　]+', '', s)
    s = re.sub(r'[()（）\[\]【】,，.。:：/、_\-]+', '', s)
    return s


def extract_english_fullname(summary):
    """从「**一句话**：effective Cost Per Mille，开发者…」里抓英文全称"""
    m = re.match(r'^([A-Za-z][A-Za-z\s\-]{4,60}?)[，,、]', summary.strip())
    return m.group(1).strip() if m else None


def parse_file(path, manual_aliases):
    text = io.open(path, encoding='utf-8').read()
    lines = text.split('\n')
    domain = lines[0].lstrip('# ').strip() if lines and lines[0].startswith('# ') else \
        os.path.splitext(os.path.basename(path))[0]

    # 按 ## 切分（只认行首的两级标题）
    chunks = re.split(r'\n(?=## )', text)
    terms = []
    for chunk in chunks:
        if not chunk.startswith('## '):
            continue
        head, _, body = chunk.partition('\n')
        raw_title = head[3:].strip()

        if body.lstrip().startswith('<!-- private-term -->'):
            continue

        name, subtitle = split_title(raw_title)
        is_overview = any(raw_title.startswith(p) for p in OVERVIEW_PREFIXES)
        if raw_title.strip() == '目录':
            continue

        body, _ = strip_private(body)

        m = re.search(r'\*\*一句话\*\*[：:]\s*(.+)', body)
        if m:
            summary = m.group(1).strip()
        else:
            # 概览类没有「一句话」，退而取正文第一个普通段落，
            # 否则面板列表里会拿标题当摘要、显示成重复的两行
            summary = ''
            in_code = False
            for ln in body.split('\n'):
                ln = ln.strip()
                if ln.startswith('```'):
                    in_code = not in_code
                    continue
                if in_code or not ln:
                    continue
                # 跳过引用/标题/表格/注释/列表项，但 **粗体** 开头的正文要留下
                if ln.startswith(('>', '#', '|', '<!--')) or re.match(r'^[-*]\s', ln):
                    continue
                summary = ln
                break

        # 第一个不超过 8 行的代码块当公式
        formula = ''
        for blk in re.findall(r'```\n(.*?)```', body, re.S):
            blk = blk.strip()
            if blk and len(blk.split('\n')) <= 8:
                formula = blk
                break

        m = re.search(r'\*\*相关\*\*[：:]\s*(.+)', body)
        related = re.findall(r'\[\[(.+?)\]\]', m.group(1)) if m else []

        # 别名：标题里 / 分隔的部分 + 副标题 + 英文全称 + 手工表
        aliases = {name}
        if '/' in name:
            aliases.update(p.strip() for p in name.split('/') if p.strip())
        if subtitle:
            aliases.add(subtitle)
        en = extract_english_fullname(summary)
        if en:
            aliases.add(en)
        aliases.update(manual_aliases.get(name, []))
        aliases = sorted(a for a in aliases if a)

        terms.append({
            'id': normalize(name) or normalize(raw_title),
            'name': name,
            'title': raw_title,
            'subtitle': subtitle,
            'domain': domain,
            'type': 'overview' if is_overview else 'term',
            'summary': summary,
            'formula': formula,
            'related': related,
            'aliases': aliases,
            'full': body.strip(),
        })
    return terms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=DEFAULT_SRC)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()

    manual, reviewed = {}, {}
    apath = os.path.join(HERE, 'aliases.json')
    if os.path.exists(apath):
        _raw = json.load(io.open(apath, encoding='utf-8'))
        manual = {k: v for k, v in _raw.items() if not k.startswith('_')}
        reviewed = {k: set(v) for k, v in _raw.get('_reviewed', {}).items()
                    if not k.startswith('_')}

    files = sorted(f for f in os.listdir(args.src)
                   if f.endswith('.md') and f != 'README.md')
    all_terms = []
    for f in files:
        all_terms.extend(parse_file(os.path.join(args.src, f), manual))

    # 校验
    problems = []
    seen_alias = {}
    for t in all_terms:
        if t['type'] == 'term' and not t['summary']:
            problems.append('缺少 **一句话**: %s' % t['name'])
        for a in t['aliases']:
            key = normalize(a)
            if not key:
                continue
            if key in seen_alias and seen_alias[key] != t['id']:
                problems.append('别名冲突 "%s"：%s vs %s' % (a, seen_alias[key], t['id']))
            seen_alias[key] = t['id']
    # 别名防呆：把「相关但不同的概念」错写成别名，是最容易犯又最难发现的错
    # （曾把 IPM 当成 CVR 的别名，于是选中 IPM 弹出的是 CVR 的卡片）。
    # 判据：该别名在正文里是以「缩写（English Full Name，…）」的形式被介绍的，
    # 说明它自带完整定义，是个独立概念而非同一个词的另一种写法。
    # 另一半防线是下面已有的别名冲突检查——别名撞上任何已存在词条的主名即报错。
    for t in all_terms:
        for a in manual.get(t['name'], []):
            if a.lower() == t['name'].lower() or a in reviewed.get(t['name'], ()):
                continue
            if re.search(re.escape(a) + r'\s*[（(]\s*[A-Za-z][A-Za-z\s\-]{4,}', t['full']):
                problems.append(
                    '别名可疑："%s" 被列为 %s 的别名，但正文里给了它独立的英文全称 —— '
                    '它多半该单独建一个词条' % (a, t['name']))

    # 泄漏兜底检查
    BANNED = ['arrowdoodle', 'arrowflow', 'skyloop', 'liuchengxiang']
    for t in all_terms:
        low = (t['full'] + t['summary']).lower()
        for b in BANNED:
            if b in low:
                problems.append('⚠️ 疑似私有内容未标记 <!-- private -->：%s 含 "%s"' % (t['name'], b))

    payload = {
        'version': VERSION,
        'generated': date.today().isoformat(),
        'source': 'personal knowledge base',
        'domains': sorted({t['domain'] for t in all_terms}),
        'terms': all_terms,
    }

    n_term = sum(1 for t in all_terms if t['type'] == 'term')
    n_alias = len(seen_alias)
    print('解析 %d 个文件 → %d 条词条（可划词 %d 条）+ %d 个别名'
          % (len(files), len(all_terms), n_term, n_alias))
    for p in problems:
        print('  ! ' + p)
    if any(p.startswith('⚠️') for p in problems):
        print('构建中止：存在疑似私有内容')
        return 1
    if args.check:
        return 0

    blob = json.dumps(payload, ensure_ascii=False, indent=1)
    for out in OUT_PATHS:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        io.open(out, 'w', encoding='utf-8').write(blob)
        print('写入 %s (%.1f KB)' % (out, len(blob.encode('utf-8')) / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
