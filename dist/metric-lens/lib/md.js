/*
 * 极简 Markdown 渲染器 —— 只覆盖知识库词条实际用到的语法。
 * 不引第三方库：一是 MV3 的 CSP 更省心，二是同学要能一眼读懂。
 * 支持：代码块 / 表格 / 无序列表 / 引用 / 分隔线 / 粗体 / 行内代码 / [[双链]]
 */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 行内：先把行内代码换成占位符，再转义、处理双链和粗体，最后还原
  function inline(text) {
    var codes = [];
    var s = String(text).replace(/`([^`]+)`/g, function (m, c) {
      codes.push(c);
      return '@@MLC' + (codes.length - 1) + '@@';
    });
    s = esc(s);
    s = s.replace(/\[\[(.+?)\]\]/g, function (m, name) {
      return '<a class="ml-link" data-term="' + esc(name) + '" href="#">' + esc(name) + '</a>';
    });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/@@MLC(\d+)@@/g, function (m, i) {
      return '<code>' + esc(codes[+i]) + '</code>';
    });
    return s;
  }

  function isTableSep(line) {
    return /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/.test(line) && line.indexOf('|') !== -1;
  }

  function splitRow(line) {
    var t = line.trim();
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function render(src) {
    if (!src) return '';

    // 1. 代码块先抽出来占位，避免内部内容被行级规则误伤
    var blocks = [];
    var text = String(src).replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, function (m, code) {
      blocks.push(code.replace(/\n+$/, ''));
      return '@@MLBLOCK' + (blocks.length - 1) + '@@';
    });

    var lines = text.split('\n');
    var out = [];
    var i = 0;

    function isSpecial(t) {
      return /^[-*]\s+/.test(t) || /^>\s?/.test(t) ||
             /^@@MLBLOCK\d+@@$/.test(t) || /^(-{3,}|\*{3,})$/.test(t);
    }

    while (i < lines.length) {
      var trimmed = lines[i].trim();

      if (!trimmed) { i++; continue; }

      var mb = trimmed.match(/^@@MLBLOCK(\d+)@@$/);
      if (mb) {
        out.push('<pre><code>' + esc(blocks[+mb[1]]) + '</code></pre>');
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // 表格：当前行含 | 且下一行是分隔行
      if (trimmed.indexOf('|') !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var head = splitRow(trimmed);
        var rows = [];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        var html = '<table><thead><tr>';
        head.forEach(function (c) { html += '<th>' + inline(c) + '</th>'; });
        html += '</tr></thead><tbody>';
        rows.forEach(function (r) {
          html += '<tr>';
          r.forEach(function (c) { html += '<td>' + inline(c) + '</td>'; });
          html += '</tr>';
        });
        out.push(html + '</tbody></table>');
        continue;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        var items = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
          i++;
        }
        out.push('<ul>' + items.map(function (t) {
          return '<li>' + inline(t) + '</li>';
        }).join('') + '</ul>');
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quote.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>');
        continue;
      }

      // 普通段落：连续非空且非特殊行合并
      var para = [];
      while (i < lines.length && lines[i].trim() && !isSpecial(lines[i].trim())) {
        para.push(lines[i].trim());
        i++;
      }
      if (para.length) out.push('<p>' + inline(para.join(' ')) + '</p>');
    }

    return out.join('');
  }

  root.MetricLensMD = { render: render, inline: inline, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
