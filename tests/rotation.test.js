'use strict';
const assert = require('assert');
const Rotation = require('../js/rotation.js');

function countOccurrences(schedule) {
  const counts = {};
  schedule.forEach(m => {
    m.teamA.concat(m.teamB).forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; });
  });
  return counts;
}

function partnerDist(schedule) {
  const dist = {};
  for (const m of schedule) {
    for (const team of [m.teamA, m.teamB]) {
      const key = [team[0].name, team[1].name].sort().join('+');
      dist[key] = (dist[key] || 0) + 1;
    }
  }
  return dist;
}

function opponentPairs(schedule) {
  const pairs = new Set();
  for (const m of schedule) {
    const a = m.teamA.map(p => p.name).sort().join('+');
    const b = m.teamB.map(p => p.name).sort().join('+');
    pairs.add([a, b].sort().join(' | '));
  }
  return pairs;
}

const S = ['强1', '强2', '强3'];
const W = ['弱1', '弱2', '弱3'];

// ---- 3强3弱 × 12 场：每人恰好 8 场，每队 1强1弱，搭档分布均衡，对手不重复 ----
{
  const sched = Rotation.generateSchedule(S, W, 12);
  assert.strictEqual(sched.length, 12, '应有 12 场');
  const counts = countOccurrences(sched);
  for (const n of [...S, ...W]) assert.strictEqual(counts[n], 8, n + ' 应上场 8 次，实际 ' + counts[n]);
  for (const m of sched) {
    assert.strictEqual(m.teamA.length, 2);
    assert.strictEqual(m.teamB.length, 2);
    assert.strictEqual(m.teamA.filter(p => p.group === 's').length, 1, 'A队应 1强1弱');
    assert.strictEqual(m.teamB.filter(p => p.group === 's').length, 1, 'B队应 1强1弱');
    assert.strictEqual(m.result, null);
    assert.strictEqual(m.resting.length, 2);
  }
  const dist = Object.values(partnerDist(sched));
  assert.strictEqual(dist.length, 9, '应覆盖全部 9 种强弱搭档组合');
  assert.ok(Math.max(...dist) - Math.min(...dist) <= 2, '搭档分布应均衡: ' + JSON.stringify(dist));
  assert.ok(opponentPairs(sched).size >= 10, '对阵应尽量分散（至少 10 种不同），实际 ' + opponentPairs(sched).size + '/12');
}

// ---- 2强4弱 × 12 场：每人恰好 8 场，含纯弱场 ----
{
  const sched = Rotation.generateSchedule(['强1', '强2'], ['弱1', '弱2', '弱3', '弱4'], 12);
  assert.strictEqual(sched.length, 12);
  const counts = countOccurrences(sched);
  for (const n of ['强1', '强2', '弱1', '弱2', '弱3', '弱4']) assert.strictEqual(counts[n], 8, n + ' 应上场 8 次，实际 ' + counts[n]);
  assert.ok(sched.some(m => m.teamA.every(p => p.group === 'w') && m.teamB.every(p => p.group === 'w')), '应含纯弱场');
}

// ---- 4强2弱 × 12 场：每人恰好 8 场，含纯强场 ----
{
  const sched = Rotation.generateSchedule(['强1', '强2', '强3', '强4'], ['弱1', '弱2'], 12);
  assert.strictEqual(sched.length, 12);
  const counts = countOccurrences(sched);
  for (const n of ['强1', '强2', '强3', '强4', '弱1', '弱2']) assert.strictEqual(counts[n], 8, n + ' 应上场 8 次，实际 ' + counts[n]);
  assert.ok(sched.some(m => m.teamA.every(p => p.group === 's') && m.teamB.every(p => p.group === 's')), '应含纯强场');
}

// ---- 默认 12 场；15/18/21 场每人 10/12/14 场 ----
{
  assert.strictEqual(Rotation.generateSchedule(S, W).length, 12, '默认应为 12 场');
  const c15 = countOccurrences(Rotation.generateSchedule(S, W, 15));
  for (const n of [...S, ...W]) assert.strictEqual(c15[n], 10, n + ' 15场应上场 10 次');
  const c18 = countOccurrences(Rotation.generateSchedule(S, W, 18));
  for (const n of [...S, ...W]) assert.strictEqual(c18[n], 12, n + ' 18场应上场 12 次');
  const c21 = countOccurrences(Rotation.generateSchedule(S, W, 21));
  for (const n of [...S, ...W]) assert.strictEqual(c21[n], 14, n + ' 21场应上场 14 次');
}

// ---- 兼容 3 场（旧行为）----
{
  const sched = Rotation.generateSchedule(S, W, 3);
  assert.strictEqual(sched.length, 3);
  const counts = countOccurrences(sched);
  for (const n of [...S, ...W]) assert.strictEqual(counts[n], 2, n + ' 3场应上场 2 次');
}

// ---- 非法输入 ----
assert.throws(() => Rotation.generateSchedule(['a'], ['b', 'c', 'd', 'e', 'f'], 12), /强组需 2~4 人/, '强组 1 人应抛错');
assert.throws(() => Rotation.generateSchedule(['a', 'b'], ['c', 'd'], 12), /总人数必须为 6/, '总人数非 6 应抛错');
assert.throws(() => Rotation.generateSchedule(S, W, 2), /场数/, '场数 < 3 应抛错');
assert.throws(() => Rotation.generateSchedule(S, W, 2.5), /场数/, '场数非整数应抛错');
assert.throws(() => Rotation.generateSchedule(S, W, 99), /场数/, '场数 > 30 应抛错');

console.log('✓ rotation.test.js 全部通过');
