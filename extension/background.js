/*
 * MetricLens 后台 service worker。
 *
 * 职责只有一个：定期把最新的 terms.json 拉下来放进 chrome.storage.local，
 * 让所有人的插件跟上知识库的更新，而不用重装扩展。
 *
 * REMOTE_URL 为空时完全不联网，插件用扩展内置的那份数据照常工作。
 */
const REMOTE_URL = '';   // 例：https://raw.githubusercontent.com/<user>/metric-lens/main/data/terms.json
const ALARM = 'metriclens-sync';
const SYNC_HOURS = 6;

async function loadBundled() {
  const res = await fetch(chrome.runtime.getURL('data/terms.json'));
  return res.json();
}

function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** 拉远程词库；返回 {ok, reason, version, count} */
async function sync(force) {
  if (!REMOTE_URL) return { ok: false, reason: '未配置远程地址，正在使用内置词库' };
  try {
    const res = await fetch(REMOTE_URL, { cache: 'no-cache' });
    if (!res.ok) return { ok: false, reason: 'HTTP ' + res.status };
    const payload = await res.json();
    if (!payload || !Array.isArray(payload.terms) || !payload.terms.length) {
      return { ok: false, reason: '远程数据格式不对，已保留本地词库' };
    }
    const cur = (await chrome.storage.local.get('terms')).terms;
    if (!force && cur && cmpVersion(payload.version, cur.version) < 0) {
      return { ok: false, reason: '远程版本更旧，跳过' };
    }
    await chrome.storage.local.set({
      terms: payload,
      lastSync: new Date().toISOString(),
      lastSyncOk: true
    });
    return { ok: true, version: payload.version, count: payload.terms.length };
  } catch (e) {
    await chrome.storage.local.set({ lastSyncOk: false, lastSyncError: String(e) });
    return { ok: false, reason: String(e) };
  }
}

/** 首次安装/升级：把内置词库灌进 storage，再试一次远程 */
async function bootstrap() {
  const got = await chrome.storage.local.get(['terms', 'settings']);
  if (!got.settings) {
    await chrome.storage.local.set({ settings: { enabled: true, autoHighlight: false } });
  }
  const bundled = await loadBundled();
  if (!got.terms || cmpVersion(bundled.version, got.terms.version) > 0) {
    await chrome.storage.local.set({ terms: bundled, bundledVersion: bundled.version });
  }
  sync(false);
}

chrome.runtime.onInstalled.addListener(() => {
  bootstrap();
  chrome.alarms.create(ALARM, { periodInMinutes: SYNC_HOURS * 60 });
});

chrome.runtime.onStartup.addListener(() => { sync(false); });

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) sync(false);
});

// popup 手动点「检查更新」
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'sync') {
    sync(true).then(sendResponse);
    return true;
  }
  if (msg && msg.type === 'reset') {
    loadBundled().then(async (b) => {
      await chrome.storage.local.set({ terms: b });
      sendResponse({ ok: true, version: b.version, count: b.terms.length });
    });
    return true;
  }
});
