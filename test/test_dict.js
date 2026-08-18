/* 词典与渲染器单测。跑法： jsc test/fixture.js extension/lib/dict.js extension/lib/md.js test/test_dict.js */
var pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { fail++; print('  FAIL: ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(actual, expect, name) {
  ok(actual === expect, name, 'got ' + JSON.stringify(actual) + ' want ' + JSON.stringify(expect));
}

var dict = new MetricLensDict.Dict(TERMS_PAYLOAD);
print('词典载入: ' + dict.terms.length + ' 条, ' + Object.keys(dict.index).length + ' 个索引键');

/* --- 精确查词 --- */
function nameOf(t) { return t ? t.name : null; }
eq(nameOf(dict.lookup('eCPM')), 'eCPM', 'lookup eCPM');
eq(nameOf(dict.lookup('ECPM')), 'eCPM', 'lookup 全大写');
eq(nameOf(dict.lookup('ecpm')), 'eCPM', 'lookup 全小写');
eq(nameOf(dict.lookup('  eCPM  ')), 'eCPM', 'lookup 带空格');
eq(nameOf(dict.lookup('千次展示收益')), 'eCPM', 'lookup 中文别名');
eq(nameOf(dict.lookup('CAC')), '获客成本 / CAC', 'lookup 斜杠标题的一半');
eq(nameOf(dict.lookup('获客成本')), '获客成本 / CAC', 'lookup 斜杠标题的另一半');
eq(nameOf(dict.lookup('ABO')), 'ABO / CBO', 'lookup ABO');
eq(nameOf(dict.lookup('CBO')), 'ABO / CBO', 'lookup CBO');
eq(nameOf(dict.lookup('ROAS1')), 'ROAS0 / ROAS1', 'lookup ROAS1');
eq(nameOf(dict.lookup('ROAS D1')), 'ROAS0 / ROAS1', 'lookup 带空格变体');
eq(nameOf(dict.lookup('roas d7')), 'ROAS0 / ROAS1', 'lookup 小写带空格');
eq(nameOf(dict.lookup('LT30')), 'LT30 / LT180', 'lookup LT30');
eq(nameOf(dict.lookup('AppFlyer')), 'AppsFlyer', 'lookup 常见拼写错误');
eq(nameOf(dict.lookup('MMP')), 'AppsFlyer', 'lookup MMP');
eq(nameOf(dict.lookup('IPDAU')), 'IPU', 'lookup IPDAU');
eq(dict.lookup('这不是一个指标'), null, 'lookup 未收录词返回 null');
eq(dict.lookup(''), null, 'lookup 空串返回 null');

/* --- 回归：别名不能指向「相关但不同」的概念 ---
   起因：曾把 IPM 写成 CVR 的别名，在报表页选中 IPM 弹出的是 CVR 的卡片 --- */
eq(nameOf(dict.lookup('IPM')), 'IPM', 'IPM 指向自己，不是 CVR');
eq(nameOf(dict.lookup('每千次展示安装数')), 'IPM', 'IPM 中文名指向 IPM');
eq(nameOf(dict.lookup('ARPPU')), 'ARPPU', 'ARPPU 指向自己，不是 ARPU');
eq(dict.lookup('Adjust'), null, 'Adjust 是竞品公司，不该指向 AppsFlyer');
eq(dict.lookup('UA'), null, 'UA 是上一代产品，不该指向 GA4');
eq(dict.lookup('Universal Analytics'), null, 'Universal Analytics 同理');
eq(nameOf(dict.lookup('IPDAU')), 'IPU', 'IPDAU 是 IPU 的口径变体，仍指向 IPU');
/* 同屏出现时两者都要能各自扫出来 */
var both = dict.scan('这套素材 IPM 12，CVR 26%').map(function (h) { return h.term.name; });
ok(both.indexOf('IPM') !== -1 && both.indexOf('CVR') !== -1, 'IPM 和 CVR 能同时扫出', both.join(','));

/* --- 素材诊断漏斗（Meta 报表列名） --- */
eq(nameOf(dict.lookup('Hook')), 'Hook rate', '报表列名 Hook 指向 Hook rate');
eq(nameOf(dict.lookup('Thruplay')), 'Thruplay', 'Thruplay');
eq(nameOf(dict.lookup('ThruPlay')), 'Thruplay', 'ThruPlay 大小写变体');
eq(nameOf(dict.lookup('CPC')), 'CPC', 'CPC');
eq(nameOf(dict.lookup('CTR')), 'CTR', 'CTR 独立于 CVR');
eq(dict.lookup('完播率'), null, '完播率 ≠ Thruplay，不该命中');
/* 直接扫一整行报表表头 */
var header = dict.scan('CVR  IPM  CPM  CPC  Hook  Thruplay').map(function (h) { return h.term.name; });
eq(header.length, 6, '一行表头扫出 6 个指标', header.join(','));

/* --- 投放结构与成本口径 --- */
eq(nameOf(dict.lookup('CPA')), 'CPA', 'CPA');
eq(nameOf(dict.lookup('Campaign')), 'Campaign', 'Campaign');
eq(nameOf(dict.lookup('compaign')), 'Campaign', '常见误拼 compaign');
eq(nameOf(dict.lookup('广告系列')), 'Campaign', '中文名 广告系列');
eq(nameOf(dict.lookup('ABO')), 'ABO / CBO', 'ABO');
eq(nameOf(dict.lookup('CBO')), 'ABO / CBO', 'CBO');
/* CPA / CPI / CAC 是三个不同口径，不能互指 */
ok(nameOf(dict.lookup('CPA')) !== nameOf(dict.lookup('CPI')), 'CPA 不等于 CPI');
ok(nameOf(dict.lookup('CPA')) !== nameOf(dict.lookup('CAC')), 'CPA 不等于 CAC');
eq(nameOf(dict.lookup('CAC')), '获客成本 / CAC', 'CAC 仍指向获客成本');

/* --- 长句扫词 --- */
var hits = dict.scan('这个渠道 eCPM 25 元，IPU 4.5，ROAS D7 达到 35%，可以加预算');
var names = hits.map(function (h) { return h.term.name; });
ok(names.indexOf('eCPM') !== -1, 'scan 命中 eCPM', names.join(','));
ok(names.indexOf('IPU') !== -1, 'scan 命中 IPU', names.join(','));
ok(names.indexOf('ROAS0 / ROAS1') !== -1, 'scan 命中 ROAS D7', names.join(','));
ok(hits[0].at < hits[1].at, 'scan 结果按出现顺序');

/* 词边界：CPIA 不该被当成 CPI */
var b = dict.scan('CPIA is not CPI');
eq(b.length, 1, '边界检查：只命中一次 CPI');
eq(b[0].matched, 'CPI', '命中的是独立的 CPI');
eq(dict.scan('ACPI 电源管理').length, 0, '边界检查：ACPI 不误报');

/* 长别名优先：LT30 不该被 LT 抢走 */
var lt = dict.scan('LT30 只有 2.8 天');
eq(lt.length, 1, 'LT30 只产生一条命中');
eq(lt[0].matched, 'LT30', '长别名优先于 LT');

/* 中文别名不需要边界 */
ok(dict.scan('看一下人均展示次数').length === 1, '中文别名可命中');

/* --- 搜索 --- */
eq(nameOf(dict.search('roas')[0]), 'ROAS', 'search 精确名优先于 ROAS0/ROAS1');
ok(dict.search('留存').length > 0, 'search 正文命中');
eq(dict.search('zzzz不存在zzzz').length, 0, 'search 无结果');

/* --- 双链解析 --- */
eq(nameOf(dict.resolve('LT30 / LT180')), 'LT30 / LT180', 'resolve 全名');
eq(nameOf(dict.resolve('获客成本 / CAC')), '获客成本 / CAC', 'resolve 带斜杠');

/* --- Markdown 渲染 --- */
var md = MetricLensMD;
ok(md.render('**粗体**').indexOf('<strong>粗体</strong>') !== -1, 'render 粗体');
ok(md.render('`code`').indexOf('<code>code</code>') !== -1, 'render 行内代码');
ok(md.render('- a\n- b').indexOf('<li>a</li><li>b</li>') !== -1, 'render 列表');
ok(md.render('> 引用').indexOf('<blockquote>') !== -1, 'render 引用');
ok(md.render('```\nx = 1\n```').indexOf('<pre><code>x = 1</code></pre>') !== -1, 'render 代码块');
var tbl = md.render('| a | b |\n|---|---|\n| 1 | 2 |');
ok(tbl.indexOf('<th>a</th>') !== -1 && tbl.indexOf('<td>2</td>') !== -1, 'render 表格', tbl);
ok(md.render('[[eCPM]]').indexOf('data-term="eCPM"') !== -1, 'render 双链');
ok(md.render('<script>x</script>').indexOf('&lt;script&gt;') !== -1, 'render 转义 HTML');
ok(md.render('`<b>`').indexOf('<code>&lt;b&gt;</code>') !== -1, 'render 代码块内也转义');

/* 真实词条能整篇渲染不炸 */
var errs = 0;
dict.terms.forEach(function (t) {
  try {
    var h = md.render(t.full);
    if (!h || h.length < 10) { errs++; print('  空渲染: ' + t.name); }
  } catch (e) { errs++; print('  渲染异常 ' + t.name + ': ' + e); }
});
eq(errs, 0, '全部 ' + dict.terms.length + ' 条词条渲染无异常');

print('');
print('通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
if (fail > 0) throw new Error('测试未全部通过');
