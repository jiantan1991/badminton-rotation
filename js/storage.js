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

  function isValid(activity) {
    if (!activity || !Array.isArray(activity.schedule)) return false;
    if (activity.schedule.length < 3) return false;
    return activity.schedule.every(function (m) {
      return m &&
        Array.isArray(m.teamA) && m.teamA.length === 2 &&
        Array.isArray(m.teamB) && m.teamB.length === 2 &&
        Array.isArray(m.resting);
    });
  }

  function load() {
    var s = storage();
    if (!s) return null;
    var raw = s.getItem(KEY);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (!isValid(data)) { s.removeItem(KEY); return null; } // 结构坏数据静默清除
      return data;
    } catch (e) {
      s.removeItem(KEY); // 语法坏数据静默清除
      return null;
    }
  }

  function clear() {
    var s = storage();
    if (s) s.removeItem(KEY);
  }

  // 导出备份文本：{type, version, data: activity}
  function exportText(activity) {
    return JSON.stringify({ type: 'badminton-backup', version: 1, data: activity });
  }

  // 导入备份文本：校验通过返回 activity，否则返回 null
  function importText(text) {
    if (typeof text !== 'string' || !text) return null;
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return null; }
    if (!obj || obj.type !== 'badminton-backup' || !isValid(obj.data)) return null;
    return obj.data;
  }

  function setImpl(mock) { impl = mock; }

  // ---- 本地历史（无后端降级：数据存 localStorage）----
  var HISTORY_KEY = 'badminton_history';
  var MAX_HISTORY = 200;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function loadHistory() {
    var s = storage();
    if (!s) return [];
    var raw = s.getItem(HISTORY_KEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(activity) {
    var s = storage();
    if (!s || !activity || !Array.isArray(activity.schedule)) return null;
    var arr = loadHistory();
    var now = new Date();
    var id = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '-' +
      pad2(now.getHours()) + pad2(now.getMinutes());
    var base = id, n = 2;
    while (s.getItem(HISTORY_KEY + '_' + id)) { id = base + '-' + n; n++; }
    var meta = {
      id: id,
      date: id.slice(0, 8),
      matchCount: activity.schedule.length,
      complete: activity.schedule.every(function (m) { return !!m && !!m.result; })
    };
    arr.push(meta);
    while (arr.length > MAX_HISTORY) { // 超上限删最旧（连带明细键，避免孤儿数据残留）
      var dropped = arr.shift();
      if (dropped && dropped.id) s.removeItem(HISTORY_KEY + '_' + dropped.id);
    }
    s.setItem(HISTORY_KEY, JSON.stringify(arr));
    s.setItem(HISTORY_KEY + '_' + id, JSON.stringify(activity));
    return meta;
  }

  function loadHistoryById(id) {
    var s = storage();
    if (!s || !id) return null;
    var raw = s.getItem(HISTORY_KEY + '_' + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  var Storage = {
    KEY: KEY,
    save: save,
    load: load,
    clear: clear,
    exportText: exportText,
    importText: importText,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    loadHistoryById: loadHistoryById,
    _setImpl: setImpl
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Storage; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.storage = Storage; }
})(typeof window !== 'undefined' ? window : globalThis);
