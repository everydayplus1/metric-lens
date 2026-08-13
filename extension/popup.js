/* MetricLens 面板：搜索、浏览、开关、手动更新 */
(function () {
  'use strict';

  var dict = null;
  var settings = { enabled: true, autoHighlight: false };
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) { return MetricLensMD.esc(s); }

  function renderList(terms) {
    var list = $('list');
    if (!terms.length) {
      list.innerHTML = '<div class="empty">没找到相关词条<br>试试 eCPM、留存、归因</div>';
      return;
    }
    var html = '';
    var lastDomain = null;
    terms.forEach(function (t) {
      if (t.domain !== lastDomain) {
        html += '<div class="group">' + esc(t.domain) + '</div>';
        lastDomain = t.domain;
      }
      var sum = (t.summary || t.title || '').replace(/\*\*/g, '');
      html += '<div class="item" data-id="' + esc(t.id) + '">'
            + '<span class="n">' + esc(t.title || t.name) + '</span>'
            + '<span class="s">' + esc(sum.slice(0, 46)) + '</span></div>';
    });
    list.innerHTML = html;
  }

  function showDetail(term) {
    $('dt-name').textContent = term.title || term.name;
    $('dt-domain').textContent = term.domain;
    $('dt-body').innerHTML = MetricLensMD.render(term.full);
    $('list').hidden = true;
    $('detail').hidden = false;
    $('detail').scrollTop = 0;
  }

  function showList() {
    $('detail').hidden = true;
    $('list').hidden = false;
  }

  function applySearch() {
    var q = $('q').value.trim();
    renderList(q ? dict.search(q) : dict.terms.slice());
    showList();
  }

  function setMeta(payload, sync) {
    var d = payload ? (payload.generated || '') : '';
    $('ver').textContent = payload
      ? ('词库 v' + payload.version + ' · ' + payload.terms.length + ' 条 · ' + d + (sync ? ' · ' + sync : ''))
      : '词库未加载';
  }

  function boot(payload) {
    dict = new MetricLensDict.Dict(payload);
    setMeta(payload);
    renderList(dict.terms.slice());
  }

  chrome.storage.local.get(['terms', 'settings', 'lastSync'], function (got) {
    if (got && got.settings) {
      for (var k in got.settings) settings[k] = got.settings[k];
    }
    $('enabled').checked = !!settings.enabled;
    $('autoHighlight').checked = !!settings.autoHighlight;

    if (got && got.terms && got.terms.terms) {
      boot(got.terms);
    } else {
      fetch(chrome.runtime.getURL('data/terms.json'))
        .then(function (r) { return r.json(); })
        .then(boot);
    }
  });

  $('q').addEventListener('input', applySearch);
  $('q').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $('q').value = ''; applySearch(); }
    if (e.key === 'Enter') {
      var first = $('list').querySelector('.item');
      if (first) first.click();
    }
  });

  $('list').addEventListener('click', function (e) {
    var it = e.target.closest('.item');
    if (!it) return;
    var t = dict.byId[it.getAttribute('data-id')];
    if (t) showDetail(t);
  });

  $('back').addEventListener('click', showList);

  $('detail').addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a.ml-link');
    if (link) {
      e.preventDefault();
      var t = dict.resolve(link.getAttribute('data-term'));
      if (t) showDetail(t);
    }
  });

  function saveSettings() {
    settings.enabled = $('enabled').checked;
    settings.autoHighlight = $('autoHighlight').checked;
    chrome.storage.local.set({ settings: settings });
  }
  $('enabled').addEventListener('change', saveSettings);
  $('autoHighlight').addEventListener('change', saveSettings);

  $('sync').addEventListener('click', function () {
    $('sync').textContent = '检查中…';
    chrome.runtime.sendMessage({ type: 'sync' }, function (res) {
      if (res && res.ok) {
        $('sync').textContent = '已更新';
        chrome.storage.local.get('terms', function (g) { if (g.terms) boot(g.terms); });
      } else {
        $('sync').textContent = '检查更新';
        $('ver').textContent = (res && res.reason) ? res.reason : '更新失败';
      }
    });
  });
})();
