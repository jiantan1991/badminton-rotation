/* 轮转算法：生成 N 场双打对阵表（候选池贪心，纯函数，UMD 导出）
 * 候选池：C(6,4)=15 种人选 × 3 种配对 = 45 种对阵（3v3 时为 27 种）。
 * 每轮按评分选最优：上场均衡(权重100) > 对阵未用过(+50) > 搭档分散(-2) > 强弱搭配(+10)。
 * 硬约束：每人上场 ≤ ceil(2N/3)（N 被 3 整除时每人恰好 2N/3 场）。
 */
(function (global) {
  'use strict';

  function player(name, group) { return { name: name, group: group }; }

  function invalid(total, nS, nW, n) {
    if (total !== 6) return '总人数必须为 6（当前 ' + total + ' 人）';
    if (nS < 2 || nS > 4) return '强组需 2~4 人（当前 ' + nS + ' 人）';
    if (nW < 2 || nW > 4) return '弱组需 2~4 人（当前 ' + nW + ' 人）';
    if (typeof n !== 'number' || n % 1 !== 0 || n < 3 || n > 30) return '场数需为 3~30 的整数';
    return null;
  }

  function generateSchedule(strongNames, weakNames, numMatches) {
    var n = typeof numMatches === 'number' ? numMatches : 12; // 默认 12 场
    var S = strongNames.slice();
    var W = weakNames.slice();
    var err = invalid(S.length + W.length, S.length, W.length, n);
    if (err) throw new Error(err);

    var s = S.map(function (nm) { return player(nm, 's'); });
    var w = W.map(function (nm) { return player(nm, 'w'); });
    var all = s.concat(w);

    // ---- 候选池：全部 4 人组合 × 3 种配对 ----
    var candidates = [];
    for (var a = 0; a < all.length; a++) {
      for (var b = a + 1; b < all.length; b++) {
        for (var c = b + 1; c < all.length; c++) {
          for (var d = c + 1; d < all.length; d++) {
            var chosen = [all[a], all[b], all[c], all[d]];
            for (var x = 0; x < 4; x++) {
              for (var y = x + 1; y < 4; y++) {
                var teamA = [chosen[x], chosen[y]];
                var teamB = chosen.filter(function (p) { return p !== chosen[x] && p !== chosen[y]; });
                var resting = all.filter(function (p) { return chosen.indexOf(p) === -1; });
                candidates.push({ teamA: teamA, teamB: teamB, resting: resting, players: chosen });
              }
            }
          }
        }
      }
    }

    function key2(t) { return [t[0].name, t[1].name].sort().join('+'); }
    function key4(teamA, teamB) {
      var a = teamA.map(function (p) { return p.name; }).sort().join('+');
      var b = teamB.map(function (p) { return p.name; }).sort().join('+');
      return [a, b].sort().join('|');
    }
    function countIn(team, group) {
      var c = 0;
      team.forEach(function (p) { if (p.group === group) c++; });
      return c;
    }

    // 对称（3v3）时硬约束：人选 2强2弱 且两队各 1强1弱（候选池过滤）
    var pool = candidates;
    if (s.length === w.length) {
      pool = candidates.filter(function (cand) {
        var ns = 0;
        cand.players.forEach(function (p) { if (p.group === 's') ns++; });
        return ns === 2 &&
          countIn(cand.teamA, 's') === 1 && countIn(cand.teamA, 'w') === 1 &&
          countIn(cand.teamB, 's') === 1 && countIn(cand.teamB, 'w') === 1;
      });
    }

    // ---- 状态 ----
    var played = {};
    all.forEach(function (p) { played[p.name] = 0; });
    var partnerCount = {};
    var opponentUsed = {};
    var limit = Math.ceil((2 * n) / 3); // 每人上场上限（n 被 3 整除时 = 2n/3）

    function maxDiff() {
      var max = -1, min = 1e9;
      all.forEach(function (p) {
        var v = played[p.name];
        if (v > max) max = v;
        if (v < min) min = v;
      });
      return max - min;
    }

    var schedule = [];
    for (var i = 1; i <= n; i++) {
      var best = null;
      var bestScore = -Infinity;
      for (var ci = 0; ci < pool.length; ci++) {
        var cand = pool[ci];
        // 硬约束：上场数达上限的人不能再选
        var over = false;
        for (var pi = 0; pi < cand.players.length; pi++) {
          if (played[cand.players[pi].name] >= limit) { over = true; break; }
        }
        if (over) continue;

        // 模拟选后全局均衡（含休息者）
        var newMax = -1, newMin = 1e9;
        all.forEach(function (p) {
          var v = played[p.name] + (cand.players.indexOf(p) !== -1 ? 1 : 0);
          if (v > newMax) newMax = v;
          if (v < newMin) newMin = v;
        });
        var score = -(newMax - newMin) * 100;          // 均衡（优先）
        if (!opponentUsed[key4(cand.teamA, cand.teamB)]) score += 50; // 对阵未用过
        score -= (partnerCount[key2(cand.teamA)] || 0) * 2;
        score -= (partnerCount[key2(cand.teamB)] || 0) * 2;           // 搭档分散
        [cand.teamA, cand.teamB].forEach(function (t) {
          if (countIn(t, 's') === 1 && countIn(t, 'w') === 1) score += 10; // 强弱搭配偏好（不对称场景）
        });

        if (score > bestScore) { bestScore = score; best = cand; }
      }
      if (!best) break; // 理论不会发生（候选池足够大）

      // 更新状态
      best.players.forEach(function (p) { played[p.name] += 1; });
      partnerCount[key2(best.teamA)] = (partnerCount[key2(best.teamA)] || 0) + 1;
      partnerCount[key2(best.teamB)] = (partnerCount[key2(best.teamB)] || 0) + 1;
      opponentUsed[key4(best.teamA, best.teamB)] = true;

      schedule.push({
        id: i,
        teamA: best.teamA,
        teamB: best.teamB,
        resting: best.resting,
        result: null
      });
    }
    return schedule;
  }

  var Rotation = { generateSchedule: generateSchedule };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Rotation; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.rotation = Rotation; }
})(typeof window !== 'undefined' ? window : globalThis);
