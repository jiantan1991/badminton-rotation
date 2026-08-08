'use strict';
const assert = require('assert');
const Storage = require('../js/storage.js');

// mock localStorage（node 环境没有）
const store = {};
const mock = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
Storage._setImpl(mock);

assert.strictEqual(Storage.KEY, 'badminton_activity');

// 初始 load 为 null
assert.strictEqual(Storage.load(), null);

// save 后 load 还原（用符合真实契约的 3 场结构数据）
function makeValidActivity() {
  return {
    strong: ['a'], weak: ['b'],
    schedule: [0, 1, 2].map(function (i) {
      return {
        id: i + 1,
        teamA: [{ name: 'a', group: 's' }, { name: 'b', group: 'w' }],
        teamB: [{ name: 'a', group: 's' }, { name: 'b', group: 'w' }],
        resting: [],
        result: null
      };
    }),
    currentIndex: 0
  };
}
const activity = makeValidActivity();
Storage.save(activity);
const loaded = Storage.load();
assert.deepStrictEqual(loaded, activity);
assert.strictEqual(store[Storage.KEY], JSON.stringify(activity));

// 坏数据 → load 返回 null 且清除
store[Storage.KEY] = '{not json';
assert.strictEqual(Storage.load(), null);
assert.ok(!(Storage.KEY in store), '坏数据应被清除');

// ---- 导出/导入备份 ----
// 导出后导入能还原
const exported = Storage.exportText(activity);
const restored = Storage.importText(exported);
assert.deepStrictEqual(restored, activity, '导出→导入应还原');
// 导入非法文本 → null
assert.strictEqual(Storage.importText(''), null, '空文本应失败');
assert.strictEqual(Storage.importText('{bad json'), null, '坏 JSON 应失败');
assert.strictEqual(Storage.importText(JSON.stringify({ hello: 'world' })), null, '非备份格式应失败');
assert.strictEqual(Storage.importText(JSON.stringify({ type: 'badminton-backup', version: 1, data: { schedule: [1, 2, 3] } })), null, '结构坏数据应失败');
// 备份文本含标识
assert.ok(exported.includes('badminton-backup'), '备份文本应含标识');

// 结构坏数据（合法 JSON 但结构不对）→ load 返回 null 且清除
store[Storage.KEY] = JSON.stringify({ schedule: [1, 2, 3] });
assert.strictEqual(Storage.load(), null);
assert.ok(!(Storage.KEY in store), '结构坏数据应被清除');
store[Storage.KEY] = JSON.stringify({ strong: ['a'], weak: ['b'], schedule: [{ teamA: [1], teamB: [], resting: null }, {}, {}], currentIndex: 0 });
assert.strictEqual(Storage.load(), null);
assert.ok(!(Storage.KEY in store), '场次结构坏数据应被清除');

// clear
Storage.save(activity);
Storage.clear();
assert.strictEqual(Storage.load(), null);

console.log('✓ storage.test.js 全部通过');
