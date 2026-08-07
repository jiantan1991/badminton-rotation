/* 轮转算法：生成 3 场双打对阵表（纯函数，UMD 导出） */
(function (global) {
  'use strict';

  function player(name, group) { return { name: name, group: group }; }

  function invalid(total, nS, nW) {
    if (total !== 6) return '总人数必须为 6（当前 ' + total + ' 人）';
    if (nS < 2 || nS > 4) return '强组需 2~4 人（当前 ' + nS + ' 人）';
    if (nW < 2 || nW > 4) return '弱组需 2~4 人（当前 ' + nW + ' 人）';
    return null;
  }

  function generateSchedule(strongNames, weakNames) {
    var S = strongNames.slice();
    var W = weakNames.slice();
    var err = invalid(S.length + W.length, S.length, W.length);
    if (err) throw new Error(err);

    var s = S.map(function (n) { return player(n, 's'); });
    var w = W.map(function (n) { return player(n, 'w'); });

    var schedule = [];
    function add(id, teamA, teamB, resting) {
      schedule.push({ id: id, teamA: teamA, teamB: teamB, resting: resting, result: null });
    }

    if (s.length === 3 && w.length === 3) {
      add(1, [s[0], w[0]], [s[1], w[1]], [s[2], w[2]]);
      add(2, [s[0], w[1]], [s[2], w[2]], [s[1], w[0]]);
      add(3, [s[1], w[2]], [s[2], w[0]], [s[0], w[1]]);
    } else if (s.length === 2 && w.length === 4) {
      add(1, [s[0], w[0]], [s[1], w[1]], [w[2], w[3]]);
      add(2, [w[0], w[1]], [w[2], w[3]], [s[0], s[1]]);
      add(3, [s[0], w[2]], [s[1], w[3]], [w[0], w[1]]);
    } else if (s.length === 4 && w.length === 2) {
      add(1, [s[0], w[0]], [s[1], w[1]], [s[2], s[3]]);
      add(2, [s[0], s[2]], [s[1], s[3]], [w[0], w[1]]);
      add(3, [s[2], w[0]], [s[3], w[1]], [s[0], s[1]]);
    }

    return schedule;
  }

  var Rotation = { generateSchedule: generateSchedule };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Rotation; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.rotation = Rotation; }
})(typeof window !== 'undefined' ? window : globalThis);
