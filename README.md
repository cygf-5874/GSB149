# vclock

Node.js 22 的向量时钟（vector clock）库：用「节点 → 计数器」的映射表达分布式事件的因果先后，
支持两两比较、合并（join）与偏序判定。

- 语言/依赖：Node.js 22，纯 ESM（`.mjs`），**只允许 `node:` 内置模块**，`package.json` 里不含任何 dependencies。
- 库代码在 `src/vclock.mjs`。
- 既有用例：`tests/vclock.test.mjs`（`node --test`）。
- 固定自检：`bash scripts/check.sh`（`check/` 是**固定验收入口，勿改**）。

## 用法

```js
import { VectorClock, merge, happensBefore, concurrent, equals, serialize, deserialize } from './src/vclock.mjs';

const a = new VectorClock({ a: 1 });
const b = new VectorClock({ a: 1, b: 2 });
a.compare(b);            // 'before'
merge(a, b).toObject();  // { a: 1, b: 2 }
serialize(merge(a, b));  // '{"a":1,"b":2}'
```

命令行自检（`-list` 列场景名，`--only <组名>` 只跑一组）：

```bash
bash scripts/check.sh
bash scripts/check.sh -list
bash scripts/check.sh --only merge
node --test
```

## 对外契约

时钟用类 `VectorClock` 表示，内部是 `节点名 → 计数器` 的映射；`get(node)` 对**缺失节点返回 0**。

1. **既有能力不回归**：`a.compare(b)` 返回 `'before'` / `'after'` / `'equal'` / `'concurrent'`：
   逐分量比较（缺失分量按 0），全部分量 `a[i] <= b[i]` 且至少一处更小 → `'before'`；
   反向 → `'after'`；逐分量全相等 → `'equal'`；否则（各有分量更大）→ `'concurrent'`。
2. **合并** `merge(a, b)`：返回**新的** `VectorClock`，逐分量取**最大值**，节点集合是两侧节点集合的并集。
   不得修改 `a`、`b`。
3. **偏序三判定**：`happensBefore(a, b)`、`concurrent(a, b)`、`equals(a, b)` 三者对任意一对时钟
   **互斥且完备** —— 恰好有一个为 `true`；并且与第 1 条的 `compare` 结论一致
   （`before` ↔ `happensBefore(a,b)`、`concurrent` ↔ `concurrent(a,b)`、`equal` ↔ `equals(a,b)`）。
4. **合并满足代数律**：`merge` 满足**交换律**（`merge(a,b)` 与 `merge(b,a)` 相等）、
   **结合律**（`merge(merge(a,b),c)` 与 `merge(a,merge(b,c))` 相等）与**幂等律**（`merge(a,a)` 等于 `a`）。
5. **合并保持偏序上界**：对任意 `a`、`b`，其合并结果 `m = merge(a,b)` 必须满足 `a <= m` 且 `b <= m`
   （即 `happensBefore(a,m)` 或 `equals(a,m)` 为真；`b` 同理）。
6. **节点集合可动态增长**：`set`/`increment`/`merge` 都可以引入新节点；缺失分量一律按 `0` 处理。
7. **序列化往返确定**：`serialize(clock)` 返回一个 JSON 对象字符串，节点键按**字节序升序**排列
   （例如 `{"a":1,"b":2}`），值即计数器；`deserialize(text)` 解析回 `VectorClock`。
   对同一时钟多次 `serialize` 结果逐字符相同，且 `deserialize(serialize(c))` 与 `c` 相等；
   键的先后顺序**不得**依赖对象键的迭代顺序。
8. **极值**：计数器允许为**负数**，也允许取到 `Number.MAX_SAFE_INTEGER`；合并只做「取最大」，
   不得因为求和/相加而溢出或丢精度。
9. **确定性**：同一输入多次调用结果完全相同；不得读取时间、随机源或全局可变状态。

## 目录

```
src/vclock.mjs            对外接口（compare 已实现；merge/偏序/序列化为待补桩）
tests/vclock.test.mjs     既有用例（node --test，只覆盖两两比较）
check/check.mjs           固定验收程序（9 个场景，勿改）
scripts/check.sh          自检入口
package.json              仅声明 type: module，无 dependencies
```