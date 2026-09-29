// vclock —— Node.js 22 向量时钟。
//
// 对外契约见 README。`compare` 已实现；`merge`、偏序判定与序列化为本次待补能力。

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
    return Object.keys(this._entries).sort();
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
  throw new Error('not implemented');
}

/**
 * a 是否严格早于 b。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {boolean}
 */
export function happensBefore(a, b) {
  throw new Error('not implemented');
}

/**
 * a 与 b 是否不可比。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {boolean}
 */
export function concurrent(a, b) {
  throw new Error('not implemented');
}

/**
 * a 与 b 是否逐分量相等。
 * @param {VectorClock} a
 * @param {VectorClock} b
 * @returns {boolean}
 */
export function equals(a, b) {
  throw new Error('not implemented');
}

/**
 * 序列化为节点键按字节序升序的 JSON 字符串。
 * @param {VectorClock} clock
 * @returns {string}
 */
export function serialize(clock) {
  throw new Error('not implemented');
}

/**
 * 从 serialize 的字符串还原 VectorClock。
 * @param {string} text
 * @returns {VectorClock}
 */
export function deserialize(text) {
  throw new Error('not implemented');
}