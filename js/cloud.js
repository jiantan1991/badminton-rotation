/* 云同步层：自家后端 API 模式（部署在云服务器时自动启用）
 * 依赖：无（纯 fetch，浏览器原生）
 * 数据接口：GET/POST /api/activity（相对路径同域部署）
 *   - 服务器版：后端读写服务器上的 activity.json → 任何设备同一份数据
 *   - GitHub Pages 版：接口 404 → 自动降级为本地模式（数据存手机）
 */
(function (global) {
  'use strict';

  /* ===== 集中配置 ===== */
  var CONFIG = {
    apiBase: '/api/activity' // 后端数据接口（同域相对路径）
  };

  var enabled = false;

  function isEnabled() { return enabled; }

  // 探测后端是否可用（GET 返回 200 即启用云同步）
  function init(cb) {
    cb = cb || function () {};
    try {
      global.fetch(CONFIG.apiBase, { method: 'GET' })
        .then(function (resp) {
          enabled = resp.status === 200;
          cb(enabled);
        })
        .catch(function () { cb(false); });
    } catch (e) { cb(false); }
  }

  // 拉取云端活动（无数据/失败 → cb(null)）
  function fetchActivity(cb) {
    cb = cb || function () {};
    if (!enabled) { cb(null); return; }
    global.fetch(CONFIG.apiBase)
      .then(function (resp) { return resp.text(); })
      .then(function (text) {
        if (text === 'null' || !text) { cb(null); return; }
        try { cb(JSON.parse(text)); } catch (e) { cb(null); }
      })
      .catch(function () { cb(null); });
  }

  // 推送活动到云端（成功 → cb(true)）
  function pushActivity(activity, cb) {
    cb = cb || function () {};
    if (!enabled) { cb(false); return; }
    global.fetch(CONFIG.apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    })
      .then(function (resp) { cb(resp.status === 200); })
      .catch(function () { cb(false); });
  }

  // 归档活动到历史球局（成功 → cb(data)，失败 → cb(null)）
  function archiveActivity(activity, cb) {
    cb = cb || function () {};
    if (!enabled) { cb(null); return; }
    global.fetch(CONFIG.apiBase.replace('/activity', '/archive'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    })
      .then(function (resp) { return resp.json(); })
      .then(function (data) { cb(data); })
      .catch(function () { cb(null); });
  }

  // 拉取全部历史球局（无数据/失败 → cb([])）
  function fetchActivities(cb) {
    cb = cb || function () {};
    if (!enabled) { cb([]); return; }
    global.fetch(CONFIG.apiBase.replace('/activity', '/activities'))
      .then(function (resp) { return resp.json(); })
      .then(function (list) { cb(Array.isArray(list) ? list : []); })
      .catch(function () { cb([]); });
  }

  // 按 id 拉取单个历史球局（无数据/失败 → cb(null)）
  function fetchActivityById(id, cb) {
    cb = cb || function () {};
    if (!enabled) { cb(null); return; }
    global.fetch(CONFIG.apiBase.replace('/activity', '/activities/') + id)
      .then(function (resp) {
        if (resp.status !== 200) { cb(null); return; }
        return resp.json();
      })
      .then(function (data) { cb(data || null); })
      .catch(function () { cb(null); });
  }

  global.BadRot = global.BadRot || {};
  global.BadRot.cloud = {
    init: init,
    fetchActivity: fetchActivity,
    pushActivity: pushActivity,
    archiveActivity: archiveActivity,
    fetchActivities: fetchActivities,
    fetchActivityById: fetchActivityById,
    isEnabled: isEnabled,
    CONFIG: CONFIG
  };
})(window);
