/* background.js 的同步判据单测。
   跑法： jsc test/chrome-shim.js extension/background.js test/test_sync.js
   这段逻辑错了不会报错，只会让同学永远收不到新词条——属于静默失败，必须测。 */
var pass = 0, fail = 0;
function ok(c, name, extra) { if (c) pass++; else { fail++; print('  FAIL: ' + name + (extra ? ' -> ' + extra : '')); } }

function T(gen, ver, n) {
  return { generated: gen, version: ver, terms: new Array(n || 26) };
}

/* 日期更新 -> 要更新 */
ok(isNewer(T('2026-08-17','1.0.2'), T('2026-08-13','1.0.2')), '远程日期更新');
/* 日期更旧 -> 不更新 */
ok(!isNewer(T('2026-08-13','1.0.2'), T('2026-08-17','1.0.2')), '远程日期更旧');
/* 同日重复构建 -> 仍更新（一天内可能改多次） */
ok(isNewer(T('2026-08-17','1.0.2'), T('2026-08-17','1.0.2')), '同日同版本仍更新');
/* 关键场景：词库长了但版本号没改 —— 必须能更新，否则新词条永远同步不过来 */
ok(isNewer(T('2026-08-20','1.0.2', 31), T('2026-08-17','1.0.2', 26)), '词库变长但版本号未改');
/* 版本号涨了、日期字段缺失 -> 回落到版本比较 */
ok(isNewer({version:'1.1.0', terms:[1]}, {version:'1.0.2', terms:[1]}), '缺日期时按版本比');
ok(!isNewer({version:'1.0.0', terms:[1]}, {version:'1.0.2', terms:[1]}), '缺日期时旧版本不覆盖');
/* 本地为空 -> 一定更新 */
ok(isNewer(T('2026-08-17','1.0.2'), null), '本地无词库时必更新');
ok(isNewer(T('2026-08-17','1.0.2'), {}), '本地词库残缺时必更新');

/* 版本号比较本身 */
ok(cmpVersion('1.0.10','1.0.9') > 0, '版本号按数值比而非字典序');
ok(cmpVersion('1.1.0','1.0.9') > 0, '次版本号优先');
ok(cmpVersion('1.0.2','1.0.2') === 0, '同版本相等');

print('');
print('同步判据：通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
if (fail) throw new Error('同步判据测试未通过');
