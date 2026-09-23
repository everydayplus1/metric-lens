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

/* --- 回收曲线逐日写法 与 DAU --- */
['ROAS0','ROAS1','ROAS2','ROAS3','ROAS5','ROAS7','ROAS30'].forEach(function (k) {
  eq(nameOf(dict.lookup(k)), 'ROAS0 / ROAS1', k + ' 指向回收率词条');
});
eq(nameOf(dict.lookup('ROAS D3')), 'ROAS0 / ROAS1', '带空格的 ROAS D3');
eq(nameOf(dict.lookup('DAU')), 'DAU', 'DAU');
eq(nameOf(dict.lookup('日活')), 'DAU', '中文 日活');
eq(dict.lookup('MAU'), null, 'MAU 时间窗不同，不该指向 DAU');
/* DAU 与 ROAS 是两个不同词条，别互相吃掉 */
ok(nameOf(dict.lookup('DAU')) !== nameOf(dict.lookup('ARPU')), 'DAU 不等于 ARPU');

/* --- 模式匹配：带任意数字的时间窗写法都要认得，不能靠枚举 --- */
[0,1,2,3,7,14,28,30,45,90,180].forEach(function (n) {
  eq(nameOf(dict.lookup('ROAS' + n)), 'ROAS0 / ROAS1', 'ROAS' + n);
});
eq(nameOf(dict.lookup('ROAS D28')), 'ROAS0 / ROAS1', '带空格的 ROAS D28');
eq(nameOf(dict.lookup('roas28')), 'ROAS0 / ROAS1', '小写 roas28');
[7,14,30,90,180].forEach(function (n) {
  eq(nameOf(dict.lookup('LTV' + n)), 'LTV', 'LTV' + n);
  eq(nameOf(dict.lookup('LT' + n)), 'LT30 / LT180', 'LT' + n);
});
eq(nameOf(dict.lookup('LTV(D14)')), 'LTV', 'LTV(D14) 括号写法');
/* hint 要按选中的天数生成 */
var m28 = dict.resolveMatch('ROAS28');
ok(m28.hint.indexOf('28') !== -1 && m28.hint.indexOf('累计') !== -1, 'ROAS28 的 hint 提到 28 天', m28.hint);
ok(dict.resolveMatch('LT90').hint.indexOf('90 天') !== -1, 'LT90 的 hint', dict.resolveMatch('LT90').hint);
/* 已收录的词不该被 hint 污染 */
eq(dict.resolveMatch('eCPM').hint, '', '普通词条没有 hint');
/* 数字兜底：模式没覆盖到的也别弹空 */
eq(nameOf(dict.lookup('CPM2024')), 'CPM', '剥掉尾部数字兜底到 CPM');
eq(dict.lookup('12345'), null, '纯数字不该命中');
eq(dict.lookup('A1'), null, '过短的残余不兜底');
/* 长句里的 ROAS28 也要扫得出来 */
var sc = dict.scan('这批量 ROAS28 才 62%，ROAS7 只有 31%');
eq(sc.length, 1, 'ROAS28 与 ROAS7 同属一个词条，去重后一条', sc.map(function(h){return h.term.name}).join(','));
ok(sc[0].hint.indexOf('28') !== -1, '长句里也带上 hint', sc[0].hint);
var sc2 = dict.scan('LT90 撑不住 ROAS180');
eq(sc2.length, 2, 'LT90 和 ROAS180 分属两个词条', sc2.map(function(h){return h.term.name}).join(','));

/* --- ARPU 家族三兄弟必须各归各位 --- */
eq(nameOf(dict.lookup('ARPDAU')), 'ARPDAU', 'ARPDAU');
eq(nameOf(dict.lookup('日ARPU')), 'ARPDAU', '「日ARPU」其实就是 ARPDAU');
eq(nameOf(dict.lookup('ARPU')), 'ARPU', 'ARPU 仍指向自己');
eq(nameOf(dict.lookup('ARPPU')), 'ARPPU', 'ARPPU 仍指向自己');
var fam = ['ARPU','ARPDAU','ARPPU'].map(function (k) { return nameOf(dict.lookup(k)); });
eq(new Set(fam).size, 3, '三者互不相同', fam.join(','));
/* 拆成两个文件后领域标签要对 */
eq(dict.lookup('ARPDAU').domain, '变现与用户价值', 'ARPDAU 属于变现侧');
eq(dict.lookup('CPI').domain, '买量与成本', 'CPI 属于买量侧');

/* --- Meta 投放的两组三字母缩写，只差一个字母，绝不能串 --- */
eq(nameOf(dict.lookup('AEO')), 'AEO / VO', 'AEO 指向事件/价值优化');
eq(nameOf(dict.lookup('VO')), 'AEO / VO', 'VO');
eq(nameOf(dict.lookup('ABO')), 'ABO / CBO', 'ABO 指向预算模式');
eq(nameOf(dict.lookup('CBO')), 'ABO / CBO', 'CBO');
ok(nameOf(dict.lookup('AEO')) !== nameOf(dict.lookup('ABO')), 'AEO 与 ABO 是两个词条');
eq(nameOf(dict.lookup('应用事件优化')), 'AEO / VO', '中文名');
eq(nameOf(dict.lookup('Value Optimization')), 'AEO / VO', '英文全称');
/* 同一句里出现要各归各位 */
var mix = dict.scan('这条 campaign 用 CBO，广告组走 AEO 优化首充').map(function (h) { return h.term.name; });
ok(mix.indexOf('ABO / CBO') !== -1 && mix.indexOf('AEO / VO') !== -1 && mix.indexOf('Campaign') !== -1,
   '一句话里 CBO / AEO / campaign 各自命中', mix.join(','));

/* --- 投放路径：WtoA 与 AtoA 是一对选择，同指一条词条 --- */
['WtoA','AtoA','W2A','Web to App','Web2App','商店直投'].forEach(function (k) {
  eq(nameOf(dict.lookup(k)), 'WtoA / AtoA', k);
});
/* 三组「X / Y」型词条互不串台（缩写都以 A/C 开头，形近） */
var pairs = ['WtoA / AtoA', 'AEO / VO', 'ABO / CBO'];
var got = ['AtoA', 'AEO', 'ABO'].map(function (k) { return nameOf(dict.lookup(k)); });
eq(JSON.stringify(got), JSON.stringify(pairs), '三组形近缩写各归各位', got.join(','));

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
