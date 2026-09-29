// vclock 既有用例（起点全绿）。
//
// 只覆盖「两两比较」这一既有能力；本次要补的合并 / 偏序 / 序列化没有既有断言。
// 跑法：`node --test`。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VectorClock } from '../src/vclock.mjs';

test('compare：分量全小为 before', () => {
  const a = new VectorClock({ a: 1, b: 2 });
  const b = new VectorClock({ a: 2, b: 3 });
  assert.equal(a.compare(b), 'before');
  assert.equal(b.compare(a), 'after');
});

test('compare：逐分量相等为 equal', () => {
  assert.equal(new VectorClock({ a: 1 }).compare(new VectorClock({ a: 1 })), 'equal');
});

test('compare：缺失分量按 0 处理', () => {
  assert.equal(new VectorClock({ a: 1 }).compare(new VectorClock({ a: 1, b: 0 })), 'equal');
  assert.equal(new VectorClock({ a: 1 }).compare(new VectorClock({})), 'after');
});

test('compare：各有更大分量为 concurrent', () => {
  const a = new VectorClock({ a: 1, b: 0 });
  const b = new VectorClock({ a: 0, b: 1 });
  assert.equal(a.compare(b), 'concurrent');
});

test('get：未知节点返回 0', () => {
  assert.equal(new VectorClock({ a: 1 }).get('z'), 0);
});