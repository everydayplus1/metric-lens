/* 让 background.js 能在 jsc 里被加载：只挡住它注册监听器的那几个调用 */
var noop = function () {};
var listener = { addListener: noop };
var chrome = {
  runtime: { onInstalled: listener, onStartup: listener, onMessage: listener,
             getURL: function (p) { return p; } },
  alarms: { create: noop, onAlarm: listener },
  storage: { local: { get: function () { return Promise.resolve({}); },
                      set: function () { return Promise.resolve(); } } }
};
var fetch = function () { return Promise.reject(new Error('测试环境不联网')); };
