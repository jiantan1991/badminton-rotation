(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var activity = null; // { strong, weak, schedule, currentIndex }

  /* ---------- 视图切换 ---------- */
  function showView(name) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].getAttribute('data-view') !== name;
    }
    window.scrollTo(0, 0);
  }

  /* ---------- 设置页 ---------- */
  function defaultInputs() {
    return ['', '', ''];
  }
  function buildNameInputs(containerId, values, addBtnId) {
    var container = $(containerId);
    container.innerHTML = '';
    values.forEach(function (v) {
      var input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 8;
      input.placeholder = '姓名';
      input.value = v;
      container.appendChild(input);
    });
    $(addBtnId).addEventListener('click', function () {
      if (container.children.length >= 4) { toast('最多 4 人'); return; }
      var input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 8;
      input.placeholder = '姓名';
      container.appendChild(input);
      input.focus();
    });
  }

  function collectNames(containerId) {
    var out = [];
    var inputs = $(containerId).querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      var v = inputs[i].value.trim();
      if (v) out.push(v);
    }
    return out;
  }

  function hasDuplicates(arr) {
    for (var i = 0; i < arr.length; i++) {
      for (var j = i + 1; j < arr.length; j++) {
        if (arr[i] === arr[j]) return true;
      }
    }
    return false;
  }

  function validateSetup(strong, weak) {
    var all = strong.concat(weak);
    if (hasDuplicates(all)) return '姓名不能重复';
    if (all.length !== 6) return '总共需要 6 人（当前 ' + all.length + ' 人）';
    if (strong.length < 2 || strong.length > 4) return '强组需 2~4 人（当前 ' + strong.length + ' 人）';
    if (weak.length < 2 || weak.length > 4) return '弱组需 2~4 人（当前 ' + weak.length + ' 人）';
    return null;
  }

  function onGenerate() {
    var strong = collectNames('strong-inputs');
    var weak = collectNames('weak-inputs');
    var err = validateSetup(strong, weak);
    if (err) { showError(err); return; }
    var countEl = $('match-count');
    var numMatches = parseInt(countEl.value, 10);
    if (isNaN(numMatches) || numMatches < 3 || numMatches > 30 || String(numMatches) !== countEl.value.trim()) {
      showError('场数需为 3~30 的整数');
      return;
    }
    clearError();
    activity = {
      strong: strong,
      weak: weak,
      schedule: BadRot.rotation.generateSchedule(strong, weak, numMatches),
      currentIndex: 0
    };
    saveActivity();
    renderMatchView();
    showView('match');
  }

  function showError(msg) {
    var el = $('setup-error');
    el.textContent = msg;
    el.hidden = false;
  }
  function clearError() { $('setup-error').hidden = true; }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.style.display = 'none'; }, 1800);
  }

  function copyText(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); return true; }
    catch (e) { return false; }
    finally { document.body.removeChild(ta); }
  }

  /* ---------- 轮转表页 ---------- */
  function teamLabel(team) {
    return team.map(function (p) { return (p.group === 's' ? '💪' : '') + p.name; }).join(' + ');
  }

  function renderMatchView() {
    var m = activity.schedule[activity.currentIndex];
    var progress = '第 ' + (activity.currentIndex + 1) + '/' + activity.schedule.length + ' 场';
    $('match-progress').textContent = progress;

    var card = $('current-match');
    card.innerHTML =
      '<div class="team">' + teamLabel(m.teamA) + '</div>' +
      '<div style="color:#999">VS</div>' +
      '<div class="team">' + teamLabel(m.teamB) + '</div>' +
      '<div class="rest">本场休息：' + m.resting.map(function (p) { return p.name; }).join('、') + '</div>';

    $('score-a-label').textContent = teamLabel(m.teamA);
    $('score-b-label').textContent = teamLabel(m.teamB);

    // 已打过（修改比分场景）
    var scoreA = $('score-a'), scoreB = $('score-b');
    scoreA.value = m.result ? m.result.scoreA : '';
    scoreB.value = m.result ? m.result.scoreB : '';

    // 后续场次预览
    var later = $('later-matches');
    later.innerHTML = '';
    for (var i = activity.currentIndex + 1; i < activity.schedule.length; i++) {
      var lm = activity.schedule[i];
      var item = document.createElement('div');
      item.className = 'item';
      item.textContent = '第 ' + (i + 1) + ' 场：' + teamLabel(lm.teamA) + ' vs ' + teamLabel(lm.teamB);
      later.appendChild(item);
    }
    $('score-error').hidden = true;
  }

  function onSubmitScore() {
    var rawA = $('score-a').value.trim();
    var rawB = $('score-b').value.trim();
    var a = parseInt(rawA, 10);
    var b = parseInt(rawB, 10);
    var err = $('score-error');
    if (rawA === '' || rawB === '' || isNaN(a) || isNaN(b) ||
        a < 0 || a > 99 || b < 0 || b > 99 ||
        String(a) !== rawA || String(b) !== rawB) {
      err.textContent = '请输入 0~99 的整数比分';
      err.hidden = false; return;
    }
    if (a === b) {
      err.textContent = '两队比分不能相同，请确认胜者';
      err.hidden = false; return;
    }
    err.hidden = true;
    var m = activity.schedule[activity.currentIndex];
    m.result = { scoreA: a, scoreB: b };
    saveActivity();

    if (activity.currentIndex + 1 >= activity.schedule.length) {
      renderResultView();
      showView('result');
    } else {
      activity.currentIndex += 1;
      saveActivity();
      renderMatchView();
    }
  }

  function onFinishEarly() {
    renderResultView();
    showView('result');
  }

  function onShowStandings() {
    renderResultView();
    showView('result');
  }

  /* ---------- 结果页 ---------- */
  function renderResultView() {
    var standings = BadRot.ranking.computeStandings(activity.strong, activity.weak, activity.schedule);
    var finished = BadRot.ranking.isComplete(activity.schedule);
    $('result-title').textContent = finished ? '🏆 积分排名（完赛）' : '📊 当前排名（未完赛）';

    var list = $('standings-list');
    list.innerHTML = '';
    standings.forEach(function (r, i) {
      var li = document.createElement('li');
      if (i === 0 && finished) li.className = 'champion';
      var left = document.createElement('span');
      left.textContent = (i === 0 && finished ? '🏆 ' : '') + (i + 1) + '. ' + r.name;
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = r.points + '分 · ' + r.wins + '胜' + r.played + '场 · 净胜' + (r.net >= 0 ? '+' : '') + r.net;
      li.appendChild(left);
      li.appendChild(meta);
      list.appendChild(li);
    });
    $('share-image-wrap').innerHTML = '';
  }

  function onShareImage() {
    var standings = BadRot.ranking.computeStandings(activity.strong, activity.weak, activity.schedule);
    BadRot.share.renderRankingImage(standings, $('share-image-wrap'));
    toast('图片已生成，长按图片保存或发送到微信群');
  }

  function onCopyText() {
    var standings = BadRot.ranking.computeStandings(activity.strong, activity.weak, activity.schedule);
    var text = BadRot.share.rankingText(standings);
    toast(copyText(text) ? '排名文字已复制' : '复制失败，请手动复制');
  }

  function onExport() {
    if (!activity) { toast('还没有数据可备份'); return; }
    var text = BadRot.storage.exportText(activity);
    toast(copyText(text) ? '备份文本已复制，粘贴到微信聊天保存即可' : '复制失败，请长按手动复制');
  }

  function onImport() {
    var restored = BadRot.storage.importText($('backup-text').value);
    if (!restored) { toast('备份格式不正确，请检查粘贴内容'); return; }
    activity = restored;
    saveActivity();
    if (BadRot.ranking.isComplete(activity.schedule)) { renderResultView(); showView('result'); }
    else { renderMatchView(); showView('match'); }
    toast('数据恢复成功');
  }

  function onRematch() {
    BadRot.storage.clear();
    activity = null;
    buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
    buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
    clearError();
    showView('setup');
  }

  function onReshuffle() {
    activity.schedule = BadRot.rotation.generateSchedule(activity.strong, activity.weak, activity.schedule.length);
    activity.currentIndex = 0;
    saveActivity();
    renderMatchView();
    showView('match');
  }

  /* ---------- 云同步 ---------- */
  function saveActivity() {
    activity.updatedAt = Date.now();
    BadRot.storage.save(activity);
    BadRot.cloud.pushActivity(activity); // 未连接时内部静默跳过
  }

  function applyView() {
    if (BadRot.ranking.isComplete(activity.schedule)) { renderResultView(); showView('result'); }
    else { renderMatchView(); showView('match'); }
  }

  function getCurrentView() {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      if (!views[i].hidden) return views[i].getAttribute('data-view');
    }
    return 'setup';
  }

  function startCloudPolling() {
    setInterval(function () {
      if (!BadRot.cloud.isEnabled()) return;
      BadRot.cloud.fetchActivity(function (cloudAct) {
        if (!cloudAct || !activity || !cloudAct.schedule) return;
        // 正在输入比分时不覆盖
        var ae = document.activeElement;
        if (ae && (ae.id === 'score-a' || ae.id === 'score-b')) return;
        var localNewer = activity.updatedAt &&
          (!cloudAct.updatedAt || activity.updatedAt >= cloudAct.updatedAt);
        if (localNewer) return;
        activity = cloudAct;
        BadRot.storage.save(activity);
        var view = getCurrentView();
        if (view === 'match') renderMatchView();
        else if (view === 'result') renderResultView();
      });
    }, 10000);
  }

  /* ---------- 启动 ---------- */
  function init() {
    buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
    buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
    $('btn-generate').addEventListener('click', onGenerate);
    $('btn-submit-score').addEventListener('click', onSubmitScore);
    $('btn-finish-early').addEventListener('click', onFinishEarly);
    $('btn-standings').addEventListener('click', onShowStandings);
    $('btn-share-image').addEventListener('click', onShareImage);
    $('btn-copy-text').addEventListener('click', onCopyText);
    $('btn-rematch').addEventListener('click', onRematch);
    $('btn-reshuffle').addEventListener('click', onReshuffle);
    $('btn-export').addEventListener('click', onExport);
    $('btn-import').addEventListener('click', onImport);

    var saved = BadRot.storage.load();
    if (saved && saved.schedule && saved.schedule.length >= 3) {
      activity = saved;
      applyView();
    } else {
      showView('setup');
    }

    // 云同步初始化：拉取云端最新数据（云端更新则覆盖），随后启动轮询
    var cloudStatus = $('cloud-status');
    BadRot.cloud.init(function (ok) {
      if (!ok) {
        cloudStatus.textContent = '☁️ 云端未连接（本地模式）';
        cloudStatus.className = 'cloud-status off';
        return;
      }
      cloudStatus.textContent = '☁️ 云端已连接，数据自动同步';
      BadRot.cloud.fetchActivity(function (cloudAct) {
        if (cloudAct && cloudAct.schedule && cloudAct.schedule.length >= 3) {
          var cloudNewer = !activity || !activity.updatedAt ||
            (cloudAct.updatedAt && cloudAct.updatedAt > activity.updatedAt);
          if (cloudNewer) {
            activity = cloudAct;
            BadRot.storage.save(activity);
            applyView();
          }
        } else if (activity) {
          saveActivity(); // 云端为空、本地有数据 → 首次推送
        }
        startCloudPolling();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.BadRot = window.BadRot || {};
  window.BadRot.app = { getActivity: function () { return activity; } };
})();
