/*
 * MetricLens content script —— 划词即查。
 *
 * 只做三件事：监听选区、在词典里查、用 Shadow DOM 弹一张卡片。
 * 不读取、不上报页面上的任何内容（唯一的网络请求由 background.js 发起，
 * 目标是词条数据文件本身）。
 */
(function () {
  'use strict';

  var CARD_CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    '.ml-card{',
    '  position:absolute;width:380px;max-width:92vw;',
    '  font:13px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;',
    '  color:#1f2328;background:#fff;border:1px solid #d8dde3;border-radius:10px;',
    '  box-shadow:0 8px 28px rgba(20,25,35,.16),0 2px 6px rgba(20,25,35,.08);',
    '  overflow:hidden;z-index:2147483647;',
    '}',
    '.ml-head{display:flex;align-items:baseline;gap:8px;padding:11px 13px 9px;border-bottom:1px solid #eef1f4;background:#fafbfc}',
    '.ml-name{font-size:15px;font-weight:650;letter-spacing:.2px}',
    '.ml-sub{font-size:12px;color:#61686f;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ml-domain{font-size:10px;color:#5b6b8c;background:#eef2f9;border-radius:4px;padding:2px 6px;white-space:nowrap}',
    '.ml-close{cursor:pointer;color:#98a1ab;font-size:15px;line-height:1;padding:2px 0 2px 4px;background:none;border:0}',
    '.ml-close:hover{color:#1f2328}',
    '.ml-body{padding:11px 13px;max-height:400px;overflow-y:auto;overscroll-behavior:contain}',
    '.ml-sum{margin-bottom:9px}',
    '.ml-formula{background:#f6f8fa;border:1px solid #eaeef2;border-radius:6px;padding:8px 10px;',
    '  font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;margin-bottom:9px}',
    '.ml-rel{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#61686f}',
    '.ml-chip{cursor:pointer;background:#f2f4f7;border:1px solid #e3e7ec;border-radius:20px;padding:2px 9px;color:#2f6fd0;font-size:11.5px}',
    '.ml-chip:hover{background:#e8effb;border-color:#c9dbf7}',
    '.ml-foot{display:flex;gap:8px;padding:8px 13px;border-top:1px solid #eef1f4;background:#fafbfc}',
    '.ml-btn{cursor:pointer;font-size:12px;color:#2f6fd0;background:none;border:0;padding:2px 0;font-family:inherit}',
    '.ml-btn:hover{text-decoration:underline}',
    '.ml-list{list-style:none}',
    '.ml-item{cursor:pointer;padding:8px 9px;border-radius:7px;border:1px solid transparent}',
    '.ml-item:hover{background:#f5f8fd;border-color:#e3ecf9}',
    '.ml-item-n{font-weight:640}',
    '.ml-item-s{font-size:12px;color:#61686f;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ml-hint{font-size:11.5px;color:#8b939c;padding:0 13px 9px}',
    /* 全文区域 */
    '.ml-full p{margin:0 0 8px}',
    '.ml-full strong{font-weight:640}',
    '.ml-full code{font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f2f4f7;border-radius:4px;padding:1px 4px}',
    '.ml-full pre{background:#f6f8fa;border:1px solid #eaeef2;border-radius:6px;padding:9px 10px;overflow-x:auto;margin:0 0 9px}',
    '.ml-full pre code{background:none;padding:0;font-size:11.5px;line-height:1.55;white-space:pre}',
    '.ml-full ul{margin:0 0 9px;padding-left:17px}',
    '.ml-full li{margin-bottom:4px}',
    '.ml-full blockquote{border-left:3px solid #dde2e8;padding-left:10px;color:#61686f;margin:0 0 9px}',
    '.ml-full table{border-collapse:collapse;width:100%;margin:0 0 9px;font-size:12px;display:block;overflow-x:auto}',
    '.ml-full th,.ml-full td{border:1px solid #e3e7ec;padding:5px 8px;text-align:left;vertical-align:top}',
    '.ml-full th{background:#f6f8fa;font-weight:640}',
    '.ml-full hr{border:0;border-top:1px solid #eef1f4;margin:10px 0}',
    '.ml-full a.ml-link{color:#2f6fd0;text-decoration:none;cursor:pointer}',
    '.ml-full a.ml-link:hover{text-decoration:underline}',
    '@media (prefers-color-scheme:dark){',
    '  .ml-card{color:#e6e9ec;background:#22262b;border-color:#3a4149;box-shadow:0 8px 28px rgba(0,0,0,.5)}',
    '  .ml-head,.ml-foot{background:#1e2226;border-color:#333a41}',
    '  .ml-sub,.ml-rel,.ml-item-s,.ml-hint{color:#9aa4ae}',
    '  .ml-domain{color:#a8c0e8;background:#2c3644}',
    '  .ml-formula,.ml-full pre{background:#1a1e22;border-color:#333a41}',
    '  .ml-full code{background:#2c3238}',
    '  .ml-chip{background:#2b3138;border-color:#3a4149;color:#7ab0f5}',
    '  .ml-item:hover{background:#2a3138;border-color:#3a4149}',
    '  .ml-full th{background:#1e2226}',
    '  .ml-full th,.ml-full td{border-color:#3a4149}',
    '}'
  ].join('\n');

  var dict = null;
  var settings = { enabled: true, autoHighlight: false };
  var host = null, shadow = null, card = null;

  /* ---------- 数据 ---------- */

  function loadDict() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(['terms', 'settings'], function (got) {
        if (got && got.settings) {
          for (var k in got.settings) settings[k] = got.settings[k];
        }
        if (got && got.terms && got.terms.terms && got.terms.terms.length) {
          dict = new MetricLensDict.Dict(got.terms);
          resolve();
          return;
        }
        fetch(chrome.runtime.getURL('data/terms.json'))
          .then(function (r) { return r.json(); })
          .then(function (payload) { dict = new MetricLensDict.Dict(payload); resolve(); })
          .catch(function () { resolve(); });
      });
    });
  }

  /* ---------- 卡片外壳 ---------- */

  function ensureHost() {
    if (host && document.body.contains(host)) return;
    host = document.createElement('div');
    host.setAttribute('data-metriclens', 'host');
    host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;';
    shadow = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CARD_CSS;
    shadow.appendChild(style);
    card = document.createElement('div');
    card.className = 'ml-card';
    card.style.display = 'none';
    shadow.appendChild(card);
    document.body.appendChild(host);

    card.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    card.addEventListener('click', onCardClick);
  }

  function hideCard() {
    if (card) card.style.display = 'none';
  }

  function placeCard(rect) {
    var margin = 8;
    card.style.display = 'block';
    card.style.visibility = 'hidden';
    card.style.left = '0px';
    card.style.top = '0px';

    var w = card.offsetWidth, h = card.offsetHeight;
    var left = rect.left + window.scrollX;
    var top = rect.bottom + window.scrollY + margin;

    var maxLeft = window.scrollX + document.documentElement.clientWidth - w - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < window.scrollX + margin) left = window.scrollX + margin;

    // 下方放不下就翻到选区上方
    var spaceBelow = window.scrollY + window.innerHeight - (rect.bottom + window.scrollY);
    if (spaceBelow < h + margin * 2 && rect.top > h + margin) {
      top = rect.top + window.scrollY - h - margin;
    }

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.visibility = 'visible';
  }

  /* ---------- 卡片内容 ---------- */

  function esc(s) { return MetricLensMD.esc(s); }

  function termCard(term, expanded) {
    var h = '';
    h += '<div class="ml-head">';
    h += '<span class="ml-name">' + esc(term.name) + '</span>';
    if (term.subtitle) h += '<span class="ml-sub">' + esc(term.subtitle) + '</span>';
    h += '<span class="ml-domain">' + esc(term.domain) + '</span>';
    h += '<button class="ml-close" data-act="close" title="关闭">&#10005;</button>';
    h += '</div><div class="ml-body">';

    if (expanded) {
      h += '<div class="ml-full">' + MetricLensMD.render(term.full) + '</div>';
    } else {
      if (term.summary) h += '<div class="ml-sum ml-full">' + MetricLensMD.inline(term.summary) + '</div>';
      if (term.formula) h += '<div class="ml-formula">' + esc(term.formula) + '</div>';
      if (term.related && term.related.length) {
        h += '<div class="ml-rel"><span>相关：</span>';
        term.related.forEach(function (r) {
          h += '<span class="ml-chip" data-act="goto" data-term="' + esc(r) + '">' + esc(r) + '</span>';
        });
        h += '</div>';
      }
    }
    h += '</div><div class="ml-foot">';
    h += '<button class="ml-btn" data-act="' + (expanded ? 'collapse' : 'expand') + '" data-id="' + esc(term.id) + '">'
       + (expanded ? '收起' : '展开全文') + '</button>';
    h += '</div>';
    return h;
  }

  function listCard(hits) {
    var h = '<div class="ml-head"><span class="ml-name">选中文本里的指标</span>'
          + '<span class="ml-sub">' + hits.length + ' 条</span>'
          + '<button class="ml-close" data-act="close" title="关闭">&#10005;</button></div>';
    h += '<div class="ml-body"><ul class="ml-list">';
    hits.forEach(function (hit) {
      var t = hit.term;
      h += '<li class="ml-item" data-act="goto" data-term="' + esc(t.name) + '">'
         + '<span class="ml-item-n">' + esc(t.name) + '</span>'
         + '<span class="ml-item-s">' + esc((t.summary || '').replace(/\*\*/g, '').slice(0, 48)) + '</span>'
         + '</li>';
    });
    h += '</ul></div><div class="ml-hint">点任意一条看详情</div>';
    return h;
  }

  function showTerm(term, rect, expanded) {
    ensureHost();
    card.innerHTML = termCard(term, !!expanded);
    card.dataset.rect = JSON.stringify({ left: rect.left, top: rect.top, bottom: rect.bottom });
    placeCard(rect);
    card.querySelector('.ml-body').scrollTop = 0;
  }

  function currentRect() {
    try {
      var r = JSON.parse(card.dataset.rect || 'null');
      if (r) return r;
    } catch (e) { /* ignore */ }
    return { left: 40, top: 40, bottom: 40 };
  }

  function onCardClick(e) {
    if (!e.target.closest) return;

    // 全文里的 [[双链]] 要先处理：它没有 data-act。
    // 也不能靠 document 上的兜底监听——事件冒出 Shadow DOM 时 target 会被
    // 重定向成 host 元素，拿不到里面的 <a>。
    var link = e.target.closest('a.ml-link');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      var lt = dict.resolve(link.getAttribute('data-term'));
      if (lt) showTerm(lt, currentRect(), false);
      return;
    }

    var el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    var act = el.getAttribute('data-act');

    if (act === 'close') { hideCard(); return; }

    if (act === 'goto') {
      var t = dict.resolve(el.getAttribute('data-term'));
      if (t) showTerm(t, currentRect(), false);
      return;
    }
    if (act === 'expand' || act === 'collapse') {
      var term = dict.byId[el.getAttribute('data-id')];
      if (term) showTerm(term, currentRect(), act === 'expand');
      return;
    }
  }

  /* ---------- 选区处理 ---------- */

  function onMouseUp(e) {
    if (!settings.enabled || !dict) return;
    if (host && (e.target === host || host.contains(e.target))) return;

    setTimeout(function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) { return; }
      var text = sel.toString().trim();
      if (!text || text.length > 400) { return; }

      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;

      // 短选区：直接查；长选区：扫出里面所有指标
      var exact = text.length <= 40 ? dict.lookup(text) : null;
      if (exact) { showTerm(exact, rect, false); return; }

      var hits = dict.scan(text, 8);
      if (hits.length === 1) { showTerm(hits[0].term, rect, false); return; }
      if (hits.length > 1) {
        ensureHost();
        card.innerHTML = listCard(hits);
        card.dataset.rect = JSON.stringify({ left: rect.left, top: rect.top, bottom: rect.bottom });
        placeCard(rect);
      }
      // 一个都没命中就安静地什么都不做
    }, 10);
  }

  function onDocMouseDown(e) {
    if (host && (e.target === host || host.contains(e.target))) return;
    hideCard();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') hideCard();
  }

  /* ---------- 自动高亮（默认关） ---------- */

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, SVG: 1 };
  var highlightTimer = null;

  function highlightAll() {
    if (!settings.autoHighlight || !dict) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
        var p = node.parentElement;
        if (!p || SKIP_TAGS[p.tagName] || p.closest('[data-metriclens]') || p.dataset.mlHl)
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n, count = 0;
    while ((n = walker.nextNode()) && nodes.length < 3000) nodes.push(n);

    nodes.forEach(function (node) {
      if (count > 300) return;
      var hits = dict.scan(node.nodeValue, 4);
      if (!hits.length) return;
      var frag = document.createDocumentFragment();
      var pos = 0;
      hits.forEach(function (hit) {
        if (hit.at < pos) return;
        frag.appendChild(document.createTextNode(node.nodeValue.slice(pos, hit.at)));
        var mark = document.createElement('span');
        mark.textContent = hit.matched;
        mark.style.cssText = 'border-bottom:1px dashed #7aa7e8;cursor:help';
        mark.setAttribute('data-ml-term', hit.term.name);
        frag.appendChild(mark);
        pos = hit.at + hit.matched.length;
        count++;
      });
      frag.appendChild(document.createTextNode(node.nodeValue.slice(pos)));
      if (node.parentElement) {
        node.parentElement.dataset.mlHl = '1';
        node.parentElement.replaceChild(frag, node);
      }
    });
  }

  function onHighlightClick(e) {
    var name = e.target && e.target.getAttribute && e.target.getAttribute('data-ml-term');
    if (!name || !dict) return;
    var t = dict.resolve(name);
    if (t) showTerm(t, e.target.getBoundingClientRect(), false);
  }

  function scheduleHighlight() {
    if (!settings.autoHighlight) return;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(highlightAll, 600);
  }

  /* ---------- 启动 ---------- */

  loadDict().then(function () {
    if (!dict) return;
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onHighlightClick, true);

    if (settings.autoHighlight) {
      scheduleHighlight();
      new MutationObserver(scheduleHighlight).observe(document.body, { childList: true, subtree: true });
    }
  });

  // 设置或词库变化时热更新，不用刷页面
  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.settings && changes.settings.newValue) {
      for (var k in changes.settings.newValue) settings[k] = changes.settings.newValue[k];
      if (!settings.enabled) hideCard();
    }
    if (changes.terms && changes.terms.newValue) {
      dict = new MetricLensDict.Dict(changes.terms.newValue);
    }
  });
})();
