/*
 * 词典：索引构建、精确查词、长句扫词、模糊搜索。
 * normalize() 必须和 build.py 里的同名函数保持一致，否则别名对不上。
 */
(function (root) {
  'use strict';

  function normalize(s) {
    return String(s)
      .toLowerCase()
      .replace(/[\s　]+/g, '')
      .replace(/[()（）\[\]【】,，.。:：/、_-]+/g, '');
  }

  function isAscii(s) {
    return /^[\x20-\x7e]+$/.test(s);
  }

  // 英文缩写要卡词边界，否则 CPI 会命中 CPIA、UA 会命中 UAT
  function boundaryOk(text, start, end) {
    var before = start > 0 ? text.charAt(start - 1) : '';
    var after = end < text.length ? text.charAt(end) : '';
    var word = /[a-z0-9]/;
    return !word.test(before) && !word.test(after);
  }

  function Dict(payload) {
    this.version = payload.version || '0';
    this.generated = payload.generated || '';
    this.terms = payload.terms || [];
    this.byId = {};
    this.index = {};        // normalize(alias) -> term
    this.scanList = [];     // [{alias, lower, ascii, term}] 长度降序

    var self = this;
    this.terms.forEach(function (t) {
      self.byId[t.id] = t;
      var names = (t.aliases || []).concat([t.name]);
      names.forEach(function (a) {
        var key = normalize(a);
        if (key && !self.index[key]) self.index[key] = t;
        if (t.type === 'term' && a.length >= 2) {
          self.scanList.push({ alias: a, lower: a.toLowerCase(), ascii: isAscii(a), term: t });
        }
      });
    });
    this.scanList.sort(function (a, b) { return b.alias.length - a.alias.length; });
  }

  /* 精确查一个词（用户选中的短文本） */
  Dict.prototype.lookup = function (text) {
    return this.index[normalize(text)] || null;
  };

  /* 在一段文本里扫出所有已收录名词，按出现顺序返回，去重 */
  Dict.prototype.scan = function (text, limit) {
    var lower = String(text).toLowerCase();
    var taken = [];   // 已占用区间，防止 LT 抢走 LT30 的位置
    var hits = [];
    var seen = {};

    function overlaps(s, e) {
      for (var i = 0; i < taken.length; i++) {
        if (s < taken[i][1] && e > taken[i][0]) return true;
      }
      return false;
    }

    for (var i = 0; i < this.scanList.length; i++) {
      var entry = this.scanList[i];
      var from = 0;
      while (true) {
        var at = lower.indexOf(entry.lower, from);
        if (at === -1) break;
        var end = at + entry.lower.length;
        from = at + 1;
        if (entry.ascii && !boundaryOk(lower, at, end)) continue;
        if (overlaps(at, end)) continue;
        taken.push([at, end]);
        if (!seen[entry.term.id]) {
          seen[entry.term.id] = true;
          hits.push({ at: at, term: entry.term, matched: text.substr(at, entry.lower.length) });
        }
      }
    }

    hits.sort(function (a, b) { return a.at - b.at; });
    return limit ? hits.slice(0, limit) : hits;
  };

  /* popup 搜索框：名称优先，其次别名，最后正文 */
  Dict.prototype.search = function (query) {
    var q = normalize(query);
    if (!q) return this.terms.slice();
    var raw = String(query).toLowerCase();
    var scored = [];
    this.terms.forEach(function (t) {
      var score = 0;
      var name = normalize(t.name);
      if (name === q) score = 100;
      else if (name.indexOf(q) === 0) score = 80;
      else if (name.indexOf(q) !== -1) score = 60;
      else if ((t.aliases || []).some(function (a) { return normalize(a).indexOf(q) !== -1; })) score = 40;
      else if ((t.summary || '').toLowerCase().indexOf(raw) !== -1) score = 20;
      else if ((t.full || '').toLowerCase().indexOf(raw) !== -1) score = 10;
      if (score) scored.push({ score: score, term: t });
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.term.name.length - b.term.name.length;
    });
    return scored.map(function (s) { return s.term; });
  };

  /* [[双链]] 里写的名字未必等于 name，做一次宽松解析 */
  Dict.prototype.resolve = function (nameOrAlias) {
    var t = this.lookup(nameOrAlias);
    if (t) return t;
    var key = normalize(nameOrAlias);
    for (var id in this.byId) {
      if (id.indexOf(key) !== -1 || key.indexOf(id) !== -1) return this.byId[id];
    }
    return null;
  };

  root.MetricLensDict = { Dict: Dict, normalize: normalize };
})(typeof window !== 'undefined' ? window : globalThis);
