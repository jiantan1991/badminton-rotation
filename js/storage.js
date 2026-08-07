/* localStorage 封装（UMD 导出），键名集中定义 */
(function (global) {
  'use strict';

  var KEY = 'badminton_activity';
  var impl = null; // 运行时注入（浏览器用 window.localStorage，测试用 mock）

  function storage() {
    if (impl) return impl;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }

  function save(activity) {
    var s = storage();
    if (!s) return;
    s.setItem(KEY, JSON.stringify(activity));
  }

  function load() {
    var s = storage();
    if (!s) return null;
    var raw = s.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      s.removeItem(KEY); // 坏数据静默清除
      return null;
    }
  }

  function clear() {
    var s = storage();
    if (s) s.removeItem(KEY);
  }

  function setImpl(mock) { impl = mock; }

  var Storage = { KEY: KEY, save: save, load: load, clear: clear, _setImpl: setImpl };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Storage; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.storage = Storage; }
})(typeof window !== 'undefined' ? window : globalThis);
