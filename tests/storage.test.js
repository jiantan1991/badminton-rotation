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

// save 后 load 还原
const activity = { strong: ['a'], weak: ['b'], schedule: [], currentIndex: 0 };
Storage.save(activity);
const loaded = Storage.load();
assert.deepStrictEqual(loaded, activity);
assert.strictEqual(store[Storage.KEY], JSON.stringify(activity));

// 坏数据 → load 返回 null 且清除
store[Storage.KEY] = '{not json';
assert.strictEqual(Storage.load(), null);
assert.ok(!(Storage.KEY in store), '坏数据应被清除');

// clear
Storage.save(activity);
Storage.clear();
assert.strictEqual(Storage.load(), null);

console.log('✓ storage.test.js 全部通过');
