(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var activity = null; // { strong, weak, schedule, currentIndex }
  var viewIndex = 0;   // 当前显示/编辑的场次（查看历史时与 currentIndex 不同）

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
    var countEl = document.querySelector('input[name="matchCount"]:checked');
    var numMatches = countEl ? parseInt(countEl.value, 10) : 12;
    clearError();
    activity = {
      strong: strong,
      weak: weak,
      schedule: BadRot.rotation.generateSchedule(strong, weak, numMatches),
      currentIndex: 0
    };
    viewIndex = 0;
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
    var m = activity.schedule[viewIndex];
    var progress = '第 ' + (viewIndex + 1) + '/' + activity.schedule.length + ' 场';
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

    // 已打完场次列表（历史，点击可修改）
    var hist = $('match-history');
    hist.innerHTML = '';
    for (var h = 0; h < activity.schedule.length; h++) {
      if (h === viewIndex) continue;
      var hm = activity.schedule[h];
      if (!hm.result) continue;
      var row = document.createElement('div');
      row.className = 'item history-row';
      row.textContent = '第 ' + (h + 1) + ' 场：' + teamLabel(hm.teamA) + ' ' + hm.result.scoreA + ':' + hm.result.scoreB + ' ' + teamLabel(hm.teamB) + ' ✏️';
      (function (idx) {
        row.addEventListener('click', function () {
          viewIndex = idx;
          renderMatchView();
        });
      })(h);
      hist.appendChild(row);
    }

    // 返回当前进度按钮（正在查看/修改历史场次时显示）
    $('btn-back-progress').hidden = viewIndex === activity.currentIndex;

    // 后续场次预览
    var later = $('later-matches');
    later.innerHTML = '';
    for (var i = viewIndex + 1; i < activity.schedule.length; i++) {
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
    var m = activity.schedule[viewIndex];
    var wasResult = !!m.result;
    m.result = { scoreA: a, scoreB: b };
    saveActivity();

    if (!wasResult && viewIndex === activity.currentIndex) {
      // 正常打完一场 → 推进
      if (viewIndex + 1 >= activity.schedule.length) {
        renderResultView();
        showView('result');
      } else {
        activity.currentIndex += 1;
        viewIndex = activity.currentIndex;
        saveActivity();
        renderMatchView();
      }
    } else {
      // 修改已打过的比分 → 覆盖不推进
      toast('比分已修改');
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

  function onRematch() {
    var reset = function () {
      BadRot.storage.clear();
      activity = null;
      viewIndex = 0;
      buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
      buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
      clearError();
      showView('setup');
    };
    if (activity) { archiveCurrent(reset); }
    else { reset(); }
  }

  function onReshuffle() {
    activity.schedule = BadRot.rotation.generateSchedule(activity.strong, activity.weak, activity.schedule.length);
    activity.currentIndex = 0;
    viewIndex = 0;
    saveActivity();
    renderMatchView();
    showView('match');
  }

  function onBackProgress() {
    viewIndex = activity.currentIndex;
    renderMatchView();
  }

  /* ---------- 历史球局 ---------- */
  function fmtDate(d) {
    var s = String(d);
    return (s.length === 8 ? parseInt(s.slice(4, 6), 10) + '月' + parseInt(s.slice(6, 8), 10) + '日' : s);
  }

  function onShowHistory() {
    renderHistoryList();
    showView('history');
  }

  function renderHistoryList() {
    var listEl = $('history-list');
    listEl.innerHTML = '';
    var done = function (list) {
      if (!list || !list.length) {
        var empty = document.createElement('div');
        empty.className = 'item';
        empty.textContent = '暂无历史球局';
        listEl.appendChild(empty);
        return;
      }
      list.forEach(function (h) {
        var row = document.createElement('div');
        row.className = 'item history-row';
        row.textContent = '🗓️ ' + fmtDate(h.date) + ' ' + (h.id.indexOf('-') > 0 ? h.id.split('-')[1] : '') + ' · ' + h.matchCount + '场 · ' + (h.complete ? '已完成' : '进行中');
        (function (id) {
          row.addEventListener('click', function () { onHistorySelect(id); });
        })(h.id);
        listEl.appendChild(row);
      });
    };
    if (BadRot.cloud.isEnabled()) { BadRot.cloud.fetchActivities(done); }
    else { done(BadRot.storage.loadHistory()); }
  }

  function onHistorySelect(id) {
    var show = function (act) {
      if (!act || !act.schedule) { toast('球局不存在'); return; }
      renderHistoryDetail(act, id);
      showView('history-detail');
    };
    if (BadRot.cloud.isEnabled()) { BadRot.cloud.fetchActivityById(id, show); }
    else { show(BadRot.storage.loadHistoryById(id)); }
  }

  function renderHistoryDetail(act, id) {
    $('history-detail-title').textContent = '🗓️ 球局 ' + id;
    var roster = $('history-roster');
    roster.innerHTML = '';
    var line = document.createElement('div');
    line.className = 'item';
    line.textContent = '强组：' + act.strong.join('、') + '　弱组：' + act.weak.join('、');
    roster.appendChild(line);

    var scores = $('history-scores');
    scores.innerHTML = '';
    act.schedule.forEach(function (m, i) {
      var item = document.createElement('div');
      item.className = 'item';
      var r = m.result;
      item.textContent = '第 ' + (i + 1) + ' 场：' + teamLabel(m.teamA) + ' vs ' + teamLabel(m.teamB) +
        (r ? ' → ' + r.scoreA + ':' + r.scoreB + (r.scoreA > r.scoreB ? ' ✅' : '') : '（未打）');
      scores.appendChild(item);
    });

    var standings = BadRot.ranking.computeStandings(act.strong, act.weak, act.schedule);
    var list = $('history-standings');
    list.innerHTML = '';
    standings.forEach(function (r, i) {
      var li = document.createElement('li');
      li.textContent = (i + 1) + '. ' + r.name + ' ' + r.points + '分 · ' + r.wins + '胜' + r.played + '场 · 净胜' + (r.net >= 0 ? '+' : '') + r.net;
      list.appendChild(li);
    });
  }

  function onHistoryBack() { showView('setup'); }
  function onHistoryDetailBack() { renderHistoryList(); showView('history'); }

  /* ---------- 云同步 ---------- */
  function saveActivity() {
    activity.updatedAt = Date.now();
    BadRot.storage.save(activity);
    BadRot.cloud.pushActivity(activity); // 未连接时内部静默跳过
  }

  // 存档当前活动为历史球局：服务器优先，失败时提示；无后端时降级本地
  function archiveCurrent(stepNext) {
    var act = activity;
    if (BadRot.cloud.isEnabled()) {
      BadRot.cloud.archiveActivity(act, function (res) {
        if (res && res.ok) { stepNext(); }
        else { toast('历史存档失败，请检查网络后重试'); }
      });
    } else {
      BadRot.storage.saveHistory(act);
      stepNext();
    }
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
        viewIndex = activity.currentIndex;
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
    $('btn-back-progress').addEventListener('click', onBackProgress);
    $('btn-share-image').addEventListener('click', onShareImage);
    $('btn-copy-text').addEventListener('click', onCopyText);
    $('btn-rematch').addEventListener('click', onRematch);
    $('btn-reshuffle').addEventListener('click', onReshuffle);
    $('btn-show-history').addEventListener('click', onShowHistory);
    $('btn-history-back').addEventListener('click', onHistoryBack);
    $('btn-history-detail-back').addEventListener('click', onHistoryDetailBack);

    var saved = BadRot.storage.load();
    if (saved && saved.schedule && saved.schedule.length >= 3) {
      activity = saved;
      viewIndex = activity.currentIndex;
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
            viewIndex = activity.currentIndex;
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
