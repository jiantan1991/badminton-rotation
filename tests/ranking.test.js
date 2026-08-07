'use strict';
const assert = require('assert');
const Rotation = require('../js/rotation.js');
const Ranking = require('../js/ranking.js');

const S = ['强1', '强2', '强3'];
const W = ['弱1', '弱2', '弱3'];

// 全部打完：场1 A胜，场2 B胜，场3 A胜
const sched = Rotation.generateSchedule(S, W);
sched[0].result = { scoreA: 21, scoreB: 15 };
sched[1].result = { scoreA: 18, scoreB: 21 };
sched[2].result = { scoreA: 21, scoreB: 12 };

const st = Ranking.computeStandings(S, W, sched);

const byName = {};
st.forEach(r => { byName[r.name] = r; });

assert.strictEqual(st.length, 6);
assert.strictEqual(byName['强1'].wins, 1, '强1 场1胜、场2负 → 1胜');
assert.strictEqual(byName['强1'].points, 2, '胜1场=2分');
assert.strictEqual(byName['强1'].played, 2);
assert.strictEqual(byName['强1'].scored, 39, '21+18');
assert.strictEqual(byName['强1'].conceded, 36, '15+21');
assert.strictEqual(byName['强1'].net, 3, '39-36');

// 排名顺序：积分降序
for (let i = 1; i < st.length; i++) {
  assert.ok(st[i - 1].points >= st[i].points, '积分应降序');
}

// 同分比净胜分：三人各 1 胜（同 2 分），净胜 强3(+21) > 强1(0) > 强2(-1)
{
  const s2 = Rotation.generateSchedule(S, W);
  s2[0].result = { scoreA: 21, scoreB: 10 };  // 强1弱1 vs 强2弱2 → A胜(强1)
  s2[1].result = { scoreA: 10, scoreB: 21 };  // 强1弱2 vs 强3弱1 → B胜(强3)
  s2[2].result = { scoreA: 21, scoreB: 11 };  // 强2弱3 vs 强3弱2 → A胜(强2)
  const st2 = Ranking.computeStandings(S, W, s2);
  const rank1 = st2.findIndex(r => r.name === '强1');
  const rank2 = st2.findIndex(r => r.name === '强2');
  const rank3 = st2.findIndex(r => r.name === '强3');
  assert.strictEqual(st2.find(r => r.name === '强1').points, 2);
  assert.strictEqual(st2.find(r => r.name === '强2').points, 2);
  assert.strictEqual(st2.find(r => r.name === '强3').points, 2);
  assert.ok(rank3 < rank1 && rank1 < rank2, '同积分时按净胜分降序：强3 > 强1 > 强2');
}

// getMatchWinner
assert.strictEqual(Ranking.getMatchWinner({ result: { scoreA: 21, scoreB: 15 } }), 'A');
assert.strictEqual(Ranking.getMatchWinner({ result: { scoreA: 15, scoreB: 21 } }), 'B');
assert.strictEqual(Ranking.getMatchWinner({ result: null }), null);

// isComplete
const s3 = Rotation.generateSchedule(S, W);
assert.strictEqual(Ranking.isComplete(s3), false);
s3.forEach(m => { m.result = { scoreA: 21, scoreB: 10 }; });
assert.strictEqual(Ranking.isComplete(s3), true);

console.log('✓ ranking.test.js 全部通过');
