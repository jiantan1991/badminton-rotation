/* 积分排名：输入名单与场次结果，输出排序后的个人统计（纯函数，UMD 导出） */
(function (global) {
  'use strict';

  function getMatchWinner(match) {
    if (!match || !match.result) return null;
    if (match.result.scoreA > match.result.scoreB) return 'A';
    if (match.result.scoreB > match.result.scoreA) return 'B';
    return null; // 平局（正常不会出现，前端已拦截）
  }

  function isComplete(schedule) {
    return schedule.every(function (m) { return !!m.result; });
  }

  function computeStandings(strongNames, weakNames, schedule) {
    var players = [];
    function ensure(name, group) {
      var p = null;
      for (var i = 0; i < players.length; i++) {
        if (players[i].name === name) { p = players[i]; break; }
      }
      if (!p) {
        p = { name: name, group: group, played: 0, wins: 0, points: 0, scored: 0, conceded: 0, net: 0 };
        players.push(p);
      }
      return p;
    }
    strongNames.forEach(function (n) { ensure(n, 's'); });
    weakNames.forEach(function (n) { ensure(n, 'w'); });

    schedule.forEach(function (m) {
      var winner = getMatchWinner(m);
      if (!winner) return;
      var sides = { A: m.teamA, B: m.teamB };
      sides.A.concat(sides.B).forEach(function (p) {
        var rec = ensure(p.name, p.group);
        var onA = sides.A.indexOf(p) !== -1;
        rec.played += 1;
        if (onA) {
          rec.scored += m.result.scoreA;
          rec.conceded += m.result.scoreB;
        } else {
          rec.scored += m.result.scoreB;
          rec.conceded += m.result.scoreA;
        }
        if ((onA && winner === 'A') || (!onA && winner === 'B')) {
          rec.wins += 1;
          rec.points += 2;
        }
      });
    });

    players.forEach(function (p) { p.net = p.scored - p.conceded; });

    players.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.net !== a.net) return b.net - a.net;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name, 'zh');
    });
    return players;
  }

  var Ranking = {
    computeStandings: computeStandings,
    getMatchWinner: getMatchWinner,
    isComplete: isComplete
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Ranking; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.ranking = Ranking; }
})(typeof window !== 'undefined' ? window : globalThis);
