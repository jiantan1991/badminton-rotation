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
    clearError();
    activity = {
      strong: strong,
      weak: weak,
      schedule: BadRot.rotation.generateSchedule(strong, weak),
      currentIndex: 0
    };
    BadRot.storage.save(activity);
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
    var a = parseInt($('score-a').value, 10);
    var b = parseInt($('score-b').value, 10);
    var err = $('score-error');
    if (isNaN(a) || isNaN(b) || a < 0 || a > 99 || b < 0 || b > 99) {
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
    BadRot.storage.save(activity);

    if (activity.currentIndex + 1 >= activity.schedule.length) {
      renderResultView();
      showView('result');
    } else {
      activity.currentIndex += 1;
      BadRot.storage.save(activity);
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

  /* ---------- 后续任务填充的渲染函数（先占位避免报错） ---------- */
  function renderResultView() {}

  /* ---------- 启动 ---------- */
  function init() {
    buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
    buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
    $('btn-generate').addEventListener('click', onGenerate);
    $('btn-submit-score').addEventListener('click', onSubmitScore);
    $('btn-finish-early').addEventListener('click', onFinishEarly);
    $('btn-standings').addEventListener('click', onShowStandings);

    var saved = BadRot.storage.load();
    if (saved && saved.schedule && saved.schedule.length === 3) {
      activity = saved;
      if (BadRot.ranking.isComplete(activity.schedule)) { renderResultView(); showView('result'); }
      else { renderMatchView(); showView('match'); }
    } else {
      showView('setup');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.BadRot = window.BadRot || {};
  window.BadRot.app = { getActivity: function () { return activity; } };
})();
