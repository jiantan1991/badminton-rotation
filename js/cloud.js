/* 云同步层：腾讯云开发 CloudBase 云存储（集中配置在此）
 * 依赖：js/vendor/cloudbase-sdk.js（全局 cloudbase）
 * 方案：活动数据序列化为 JSON，存到云存储固定路径 activity.json（上传覆盖写）；
 *       读取用 getTempFileURL + fetch（bucket 名填入 CONFIG.bucket 后自动可用）。
 */
(function (global) {
  'use strict';

  /* ===== 集中配置（用户环境） ===== */
  var CONFIG = {
    envId: 'badminton-d7gg355v353504a56', // 腾讯云开发环境 ID
    filePath: 'activity.json',            // 云存储固定路径（覆盖写）
    bucket: 'test11-1465193571'           // 云存储 bucket 名（fileID 前缀，控制台存储页可见）
  };

  var app = null;
  var enabled = false;

  function isEnabled() { return enabled && !!app; }

  // 构造固定 fileID：cloud://<envId>.<bucket>/<filePath>
  function fileID() {
    return 'cloud://' + CONFIG.envId + '.' + CONFIG.bucket + '/' + CONFIG.filePath;
  }

  // 初始化 SDK + 匿名登录（静默失败，不影响本地模式）
  function init(cb) {
    cb = cb || function () {};
    try {
      if (typeof global.cloudbase === 'undefined' || typeof global.cloudbase.init !== 'function') {
        cb(false);
        return;
      }
      app = global.cloudbase.init({ env: CONFIG.envId });
      app.auth({ persistence: 'local' }).anonymousAuthProvider().signIn()
        .then(function () {
          enabled = true;
          cb(true);
        })
        .catch(function () { cb(false); });
    } catch (e) {
      cb(false);
    }
  }

  // 拉取云端活动（无数据/失败 → cb(null)）
  function fetchActivity(cb) {
    cb = cb || function () {};
    if (!isEnabled() || !CONFIG.bucket) { cb(null); return; }
    app.getTempFileURL({ fileList: [fileID()] })
      .then(function (res) {
        var url = res && res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
        if (!url) { cb(null); return; }
        return global.fetch(url)
          .then(function (resp) { return resp.text(); })
          .then(function (text) {
            try { cb(JSON.parse(text)); } catch (e) { cb(null); }
          });
      })
      .catch(function () { cb(null); });
  }

  // 推送活动到云端（上传覆盖，成功 → cb(true)）
  function pushActivity(activity, cb) {
    cb = cb || function () {};
    if (!isEnabled()) { cb(false); return; }
    app.uploadFile({
      cloudPath: CONFIG.bucket + '/' + CONFIG.filePath, // 必须含 bucket 前缀
      fileContent: JSON.stringify(activity)
    })
      .then(function () { cb(true); })
      .catch(function () { cb(false); });
  }

  global.BadRot = global.BadRot || {};
  global.BadRot.cloud = {
    init: init,
    fetchActivity: fetchActivity,
    pushActivity: pushActivity,
    isEnabled: isEnabled,
    CONFIG: CONFIG,
    _fileID: fileID
  };
})(window);
