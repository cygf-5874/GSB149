// vclock —— Node.js 22 向量时钟。
//
// 对外契约见 README。仅使用 `node:` 内置模块；不读取时间、随机源或环境状态。

import { Buffer } from 'node:buffer';

// 按 UTF-8 字节序升序排列节点名。序列化与节点枚举都走这里，
// 保证输出顺序与对象键的迭代顺序无关。
function bytewiseSorted(nodes) {
  return [...nodes].sort((x, y) => Buffer.compare(Buffer.from(x), Buffer.from(y)));
}

function assertClock(value, label) {
  if (!(value instanceof VectorClock)) {
    throw new TypeError(`${label} 必须是 VectorClock`);
  }
  return value;
}

export class VectorClock {
  constructor(entries = {}) {
    this._entries = Object.create(null);
    if (entries !== null && typeof entries === 'object') {
      for (const key of Object.keys(entries)) {
        this.set(key, entries[key]);
      }
    }
  }

  get(node) {
    return Object.prototype.hasOwnProperty.call(this._entries, node) ? this._entries[node] : 0;
  }

  set(node, value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`非法的计数器：${node}`);
    }
    this._entries[node] = value;
    return this;
  }

  increment(node, delta = 1) {
    return this.set(node, this.get(node) + delta);
  }

  has(node) {
    return Object.prototype.hasOwnProperty.call(this._entries, node);
  }

  nodes() {
    return bytewiseSorted(Object.keys(this._entries));
  }

  toObject() {
    const out = {};
    for (const node of this.nodes()) out[node] = this._entries[node];
    return out;
  }

  clone() {
    return new VectorClock(this.toObject());
  }

  compare(other) {
    const nodes = new Set([...Object.keys(this._entries), ...Object.keys(other._entries)]);
    let less = false;
    let greater = false;
    for (const node of nodes) {
      const a = this.get(node);
      const b = other.get(node);
      if (a < b) less = true;
      else if (a > b) greater = true;
    }
    if (less && greater) return 'concurrent';
    if (less) return 'before';
    if (greater) return 'after';
    return 'equal';
  }
}

/**
 * 逐分量取最大值，返回新的 VectorClock。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {VectorClock}
 */
export function merge(a, b) {
  assertClock(a, 'merge 的第一个参数');
  assertClock(b, 'merge 的第二个参数');
  const out = new VectorClock();
  for (const node of bytewiseSorted(new Set([...a.nodes(), ...b.nodes()]))) {
    const inA = a.has(node);
    const inB = b.has(node);
    // 合并取并集：节点只在一侧出现时直接取该侧的值（含负数），
    // 不把“缺失”当成 0 参与取大；两侧都存在时才比较取最大值。
    const value = !inB ? a.get(node) : !inA ? b.get(node) : Math.max(a.get(node), b.get(node));
    out.set(node, value);
  }
  return out;
}

/**
 * a 是否严格早于 b。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {boolean}
 */
export function happensBefore(a, b) {
  return assertClock(a, 'happensBefore 的第一个参数')
    .compare(assertClock(b, 'happensBefore 的第二个参数')) === 'before';
}

/**
 * a 与 b 是否不可比。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {boolean}
 */
export function concurrent(a, b) {
  return assertClock(a, 'concurrent 的第一个参数')
    .compare(assertClock(b, 'concurrent 的第二个参数')) === 'concurrent';
}

/**
 * a 与 b 是否逐分量相等。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {boolean}
 */
export function equals(a, b) {
  return assertClock(a, 'equals 的第一个参数')
    .compare(assertClock(b, 'equals 的第二个参数')) === 'equal';
}

/**
 * 序列化为节点键按字节序升序的 JSON 字符串。
 * @param {VectorClock} clock
 * @returns {string}
 */
export function serialize(clock) {
  assertClock(clock, 'serialize 的参数');
  const parts = [];
  for (const node of clock.nodes()) {
    parts.push(`${JSON.stringify(node)}:${JSON.stringify(clock.get(node))}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * 从 serialize 的字符串还原 VectorClock。
 * @param {string} text
 * @returns {VectorClock}
 */
export function deserialize(text) {
  if (typeof text !== 'string') {
    throw new TypeError('deserialize 的参数必须是字符串');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new TypeError('deserialize 的参数不是合法 JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('deserialize 的内容必须是 JSON 对象');
  }
  const clock = new VectorClock();
  for (const key of Object.keys(parsed)) {
    clock.set(key, parsed[key]);
  }
  return clock;
}
