// GSB149 vclock 固定验收程序（勿改）。
//
// 用法：
//   node check/check.mjs              跑全部场景
//   node check/check.mjs -list        列出场景名
//   node check/check.mjs --only merge 只跑某一组
//
// 输出：逐场景 `PASS <组>/<名>` 或 `FAIL <组>/<名>  期望=… 实际=…`，
// 结尾 `结果：通过 x/N`；全过 exit 0，否则 exit 1。失败不早退。

import {
  VectorClock,
  merge,
  happensBefore,
  concurrent,
  equals,
  serialize,
  deserialize,
} from '../src/vclock.mjs';

class AssertionFailure extends Error {
  constructor(expected, actual) {
    super('assertion failed');
    this.expected = expected;
    this.actual = actual;
  }
}

function show(value) {
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = String(value);
  return text.length > 300 ? text.slice(0, 300) + '…' : text;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function expectSame(expected, actual) {
  if (!deepEqual(expected, actual)) throw new AssertionFailure(show(expected), show(actual));
}

function expectTrue(ok, expected, actual) {
  if (!ok) throw new AssertionFailure(expected, show(actual));
}

function clock(entries) {
  return new VectorClock(entries);
}

function sameClock(a, b) {
  if (a.compare(b) !== 'equal') throw new AssertionFailure('两时钟相等', JSON.stringify(a.toObject()));
  expectSame(a.toObject(), b.toObject());
}

const scenarios = [
  {
    group: 'legacy',
    name: 'basic-ordering',
    run() {
      expectSame('before', clock({ a: 1, b: 2 }).compare(clock({ a: 2, b: 3 })));
      expectSame('after', clock({ a: 2, b: 3 }).compare(clock({ a: 1, b: 2 })));
      expectSame('equal', clock({ a: 1 }).compare(clock({ a: 1 })));
      expectSame('after', clock({ a: 1 }).compare(clock({})));
    },
  },
  {
    group: 'legacy',
    name: 'concurrent',
    run() {
      expectSame('concurrent', clock({ a: 1 }).compare(clock({ b: 1 })));
      expectSame('concurrent', clock({ a: 1, b: 0 }).compare(clock({ a: 0, b: 1 })));
      expectSame('equal', clock({ a: 1 }).compare(clock({ a: 1, b: 0 })));
    },
  },
  {
    group: 'merge',
    name: 'componentwise',
    run() {
      const m = merge(clock({ a: 1, b: 2 }), clock({ a: 3 }));
      expectTrue(m instanceof VectorClock, 'merge 返回 VectorClock', m && m.constructor && m.constructor.name);
      expectSame({ a: 3, b: 2 }, m.toObject());
      expectSame({ a: 1, b: 2 }, clock({ a: 1, b: 2 }).toObject());
      const m2 = merge(clock({ x: 5 }), clock({ y: 4 }));
      expectSame({ x: 5, y: 4 }, m2.toObject());
    },
  },
  {
    group: 'merge',
    name: 'algebraic',
    run() {
      const a = clock({ a: 1, b: 2 });
      const b = clock({ b: 3, c: 1 });
      const c = clock({ a: 0, c: 4 });
      sameClock(merge(a, b), merge(b, a));
      sameClock(merge(merge(a, b), c), merge(a, merge(b, c)));
      sameClock(merge(a, a), a);
      sameClock(merge(b, b), b);
      sameClock(merge(merge(a, b), a), merge(a, b));
    },
  },
  {
    group: 'merge',
    name: 'upper-bound',
    run() {
      const a = clock({ a: 1 });
      const b = clock({ b: 2 });
      const m = merge(a, b);
      expectTrue(happensBefore(a, m) || equals(a, m), 'a <= merge(a,b)', a.compare(m));
      expectTrue(happensBefore(b, m) || equals(b, m), 'b <= merge(a,b)', b.compare(m));
      expectTrue(!happensBefore(m, a), 'merge(a,b) 不早于 a', m.compare(a));
      expectTrue(!concurrent(a, m), 'a 与 merge(a,b) 可比', 'concurrent');

      const p = clock({ a: 2, b: 1 });
      const q = clock({ a: 1 });
      const m2 = merge(p, q);
      sameClock(m2, p);
      expectTrue(happensBefore(q, m2), 'q <= merge(p,q)', q.compare(m2));
    },
  },
  {
    group: 'order',
    name: 'tri-state',
    run() {
      const pairs = [
        [clock({ a: 1 }), clock({ a: 1 })],
        [clock({ a: 1 }), clock({ a: 2 })],
        [clock({ a: 2 }), clock({ a: 1 })],
        [clock({ a: 1 }), clock({ b: 1 })],
        [clock({ a: 1, b: 2 }), clock({ a: 2, b: 1 })],
      ];
      for (const [a, b] of pairs) {
        const flags = [
          happensBefore(a, b),
          happensBefore(b, a),
          equals(a, b),
          concurrent(a, b),
        ];
        expectTrue(flags.filter(Boolean).length === 1, '恰好一个判定为真', flags.join(','));
        const cmp = a.compare(b);
        expectTrue(equals(a, b) === (cmp === 'equal'), 'equals 与 compare 一致', cmp);
        expectTrue(happensBefore(a, b) === (cmp === 'before'), 'happensBefore 与 compare 一致', cmp);
        expectTrue(happensBefore(b, a) === (cmp === 'after'), 'happensBefore(反向) 与 compare 一致', cmp);
        expectTrue(concurrent(a, b) === (cmp === 'concurrent'), 'concurrent 与 compare 一致', cmp);
      }
    },
  },
  {
    group: 'order',
    name: 'merge-relations',
    run() {
      const a = clock({ n: 1 });
      const b = clock({ m: 2 });
      const m = merge(a, b);
      expectTrue(!equals(a, b), 'a、b 不可比（不同节点）', a.compare(b));
      expectTrue(concurrent(a, b), 'a、b 并发', a.compare(b));
      expectTrue(!concurrent(a, m), '合并后不再并发', a.compare(m));
      expectTrue(equals(merge(a, b), merge(b, a)), '合并可交换', serialize(merge(a, b)));
    },
  },
  {
    group: 'roundtrip',
    name: 'serialize',
    run() {
      const c = clock({ b: 2, a: 1 });
      expectSame('{"a":1,"b":2}', serialize(c));
      expectSame(serialize(c), serialize(c));
      sameClock(deserialize(serialize(c)), c);
      expectSame('{"a":2,"z":1}', serialize(deserialize('{"z":1,"a":2}')));
      expectSame('{}', serialize(clock({})));
    },
  },
  {
    group: 'edge',
    name: 'extremes',
    run() {
      const neg = clock({ n: -5, big: Number.MAX_SAFE_INTEGER });
      const m = merge(neg, clock({ big: Number.MAX_SAFE_INTEGER, fresh: 1 }));
      expectSame({ n: -5, big: Number.MAX_SAFE_INTEGER, fresh: 1 }, m.toObject());
      expectSame(Number.MAX_SAFE_INTEGER, m.get('big'));
      expectTrue(happensBefore(clock({ n: -10, big: 1 }), neg), '负数分量可比', serialize(neg));
      sameClock(deserialize(serialize(neg)), neg);
      sameClock(merge(neg, neg), neg);
    },
  },
];

const args = process.argv.slice(2);
let only = null;
let list = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-list' || arg === '--list') {
    list = true;
  } else if (arg === '--only') {
    if (i + 1 >= args.length) {
      process.stderr.write('--only 缺少取值\n');
      process.exit(2);
    }
    only = args[++i];
  } else if (arg.startsWith('--only=')) {
    only = arg.slice('--only='.length);
  } else {
    process.stderr.write(`无法识别的参数：${arg}\n`);
    process.exit(2);
  }
}

if (list) {
  for (const scenario of scenarios) console.log(`${scenario.group}/${scenario.name}`);
  process.exit(0);
}

let passed = 0;
let ran = 0;

for (const scenario of scenarios) {
  if (only !== null && scenario.group !== only) continue;
  ran++;
  const label = `${scenario.group}/${scenario.name}`;
  try {
    scenario.run();
    passed++;
    console.log(`PASS ${label}`);
  } catch (error) {
    const expected = error instanceof AssertionFailure ? error.expected : '(未抛断言)';
    const actual = error instanceof AssertionFailure ? error.actual : error.message;
    console.log(`FAIL ${label}  期望=${expected} 实际=${actual}`);
  }
}

console.log(`结果：通过 ${passed}/${ran}`);
process.exit(passed === ran ? 0 : 1);