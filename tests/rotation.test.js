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

function noRepeatPartners(schedule) {
  const seen = new Set();
  for (const m of schedule) {
    for (const team of [m.teamA, m.teamB]) {
      const key = [team[0].name, team[1].name].sort().join('+');
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

const S = ['强1', '强2', '强3'];
const W = ['弱1', '弱2', '弱3'];

// 3强3弱
{
  const sched = Rotation.generateSchedule(S, W);
  assert.strictEqual(sched.length, 3, '应有 3 场');
  const counts = countOccurrences(sched);
  for (const n of [...S, ...W]) assert.strictEqual(counts[n], 2, n + ' 应上场 2 次');
  for (const m of sched) {
    assert.strictEqual(m.teamA.length, 2);
    assert.strictEqual(m.teamB.length, 2);
    assert.strictEqual(m.teamA.filter(p => p.group === 's').length, 1, 'A队应 1强1弱');
    assert.strictEqual(m.teamB.filter(p => p.group === 's').length, 1, 'B队应 1强1弱');
    assert.strictEqual(m.result, null);
  }
  assert.ok(noRepeatPartners(sched), '搭档不应重复');
}

// 2强4弱
{
  const sched = Rotation.generateSchedule(['强1', '强2'], ['弱1', '弱2', '弱3', '弱4']);
  assert.strictEqual(sched.length, 3);
  const counts = countOccurrences(sched);
  for (const n of ['强1', '强2', '弱1', '弱2', '弱3', '弱4']) assert.strictEqual(counts[n], 2, n + ' 应上场 2 次');
  assert.ok(sched.some(m => m.teamA.every(p => p.group === 'w') && m.teamB.every(p => p.group === 'w')), '应含 1 场纯弱场');
  assert.ok(noRepeatPartners(sched));
}

// 4强2弱
{
  const sched = Rotation.generateSchedule(['强1', '强2', '强3', '强4'], ['弱1', '弱2']);
  assert.strictEqual(sched.length, 3);
  const counts = countOccurrences(sched);
  for (const n of ['强1', '强2', '强3', '强4', '弱1', '弱2']) assert.strictEqual(counts[n], 2, n + ' 应上场 2 次');
  assert.ok(sched.some(m => m.teamA.every(p => p.group === 's') && m.teamB.every(p => p.group === 's')), '应含 1 场纯强场');
  assert.ok(noRepeatPartners(sched));
}

// 非法输入
assert.throws(() => Rotation.generateSchedule(['a'], ['b', 'c', 'd', 'e', 'f']), /强组需 2~4 人/, '强组 1 人应抛错');
assert.throws(() => Rotation.generateSchedule(['a', 'b'], ['c', 'd']), /总人数必须为 6/, '总人数非 6 应抛错');

console.log('✓ rotation.test.js 全部通过');
