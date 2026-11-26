# Conventions

General coding rules. Client-side rules (hooks, components, effects, charts, Tailwind, React Query, URL state) live in [`REACT.md`](REACT.md); server-side rules (Server Actions, I/O, concurrency, data cache, database) in [`SERVER.md`](SERVER.md); test rules in [`TESTING.md`](TESTING.md).

## Rule IDs

IDs follow the root `CLAUDE.md` "Rule IDs and references". Cite them as `CONVENTIONS.md#CP-2`.

| Prefix | Topic |
|---|---|
| `CP` | Coding paradigm (declarative, functional, exhaustive branching, compute once) |
| `TS` | TypeScript rules |
| `NC` | Constants & literals, numeric and nil guards |
| `CM` | Comments & documentation |
| `CS` | Change synchronization |

Retired IDs: TS-4

## Coding Paradigm

Siglens follows **Declarative** and **Functional Programming** paradigms.

### Declarative Code

Focus on "what" rather than "how".

```typescript
// ❌ Imperative — prefer declarative when logic is simple
const result = [];
for (let i = 0; i < closes.length; i++) {
    if (closes[i] > 0) result.push(closes[i] * 2);
}

// ✅ Declarative
const result = closes.filter(c => c > 0).map(c => c * 2);
```

**Exception — `for (let i = 0; ...)` is allowed when it provides a clear advantage:**
- Sliding window algorithms (O(n) vs O(n²) with `.slice()` inside `.map()`)
- Algorithms where index arithmetic is central to the logic
- Cases where the imperative form is measurably more readable than the functional equivalent

**Exception — `while` is allowed when the algorithm's termination condition is naturally expressed as a predicate, not as a counter:**
- Binary search (convergent boundary `low`/`high` pointers)
- Pointer-convergence loops (two pointers approaching each other)
- Cases where a `for` header equivalent would be an empty `for (; condition; )` — use `while` instead for clarity

The goal is readable, maintainable code — not mechanical adherence to a style. When `map`/`reduce` produces convoluted code or unnecessary O(n²) complexity, prefer `for (let i = 0; ...)`. When the loop condition is a convergence predicate rather than a counter, prefer `while`.

```typescript
// ❌ Nested conditionals
let label;
if (trend === 'bullish') label = '상승';
else if (trend === 'bearish') label = '하락';
else label = '중립';

// ✅ Object map
const TREND_LABEL: Record<Trend, string> = {
    bullish: '상승',
    bearish: '하락',
    neutral: '중립',
};
const label = TREND_LABEL[trend];
```

<a id="CP-4"></a>

#### CP-4 — Prefer `const` expressions over `let` + `if`

Conditional assignment is a ternary or a small named function feeding a `const`, not a `let` that is reassigned. A `let` that is reassigned invites partial updates and hides the value's single definition.

```typescript
// ❌
let result = value;
if (condition) result = newValue;
return result;

// ✅
const result = condition ? newValue : value;
```

A `let` assigned in `try` and read after it is the same smell; both shapes are machine-checked (see "Enforced rules"). Loop state and effect-cleanup flags stay a judgment call.

In tests, do not reassign a `let` mock inside `act()`/callbacks; create a `const` mock and pass it into the helper.

<a id="CP-5"></a>

#### CP-5 — Name complex inline expressions; turn repeated JSX into data + map

Extract to a named helper (or a data array rendered with `.map()`) when an expression would otherwise be hard to read or repeat:

- The same `className` ternary three or more times: one helper.
- IIFEs and multi-statement ternaries: a named function.
- The same JSX structure twice or more: a data array plus `.map()`.
- Combining Tailwind classes always goes through `cn()` (see Tailwind CSS Rules), never template literals or `+`.

```typescript
// ❌ same ternary repeated
<div className={isActive ? 'bg-primary-600 text-white' : 'bg-secondary-800'} />
<span className={isActive ? 'bg-primary-600 text-white' : 'bg-secondary-800'} />

// ✅
const tabClassName = (isActive: boolean) => cn(isActive ? 'bg-primary-600 text-white' : 'bg-secondary-800');
```

### Functional Programming

```typescript
// ✅ Pure function — same input → same output, no side effects
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }

// ✅ Immutability — use immutable methods for all array/object mutations
// ❌ bars.push(newBar)       ✅ [...bars, newBar]
// ❌ bar.close = 100         ✅ { ...bar, close: 100 }
// ❌ arr.reverse()           ✅ arr.toReversed()
// ❌ arr.sort()              ✅ arr.toSorted()
// ❌ arr.splice(i, 1)        ✅ arr.filter((_, idx) => idx !== i)
// Applies to: push, pop, shift, unshift, splice, reverse, sort
```

**Exception — Local state-accumulator mutation is allowed when `reduce + spread` causes O(N²) complexity:**

State-machine based indicators where each step depends on the previous accumulated result
cannot use `reduce + [...acc, value]` without incurring O(N²) time complexity.
In these cases, a function-local mutable accumulator (pre-allocated array + index assignment,
or a `for` loop with index) is permitted.

The following conditions must all be satisfied:
1. The function maintains a pure contract (same input → same output, no side effects)
2. Input arguments (`bars`, `state`, etc.) are never mutated
3. The return value is a completed, externally immutable array

```typescript
// ❌ O(N²) — spread inside reduce creates a new array on every iteration
const results = bars.reduce((acc, bar) => {
    return [...acc, compute(bar)];
}, [] as Result[]);

// ✅ O(N) — pre-allocated array with index assignment (local mutation only)
const results: Result[] = new Array(bars.length);
let state = initialState;
for (let i = 0; i < bars.length; i++) {
    const { state: next, result } = nextState(state, bars[i]);
    results[i] = result;
    state = next;
}
return results;
```

These rules apply to test helpers too: do not reassign a closure `let` inside a helper (for example a seeded pseudo-random generator); derive the sequence with `reduce` over the previous value instead.

Also: use the callback parameter itself rather than re-reading the source by index.

```typescript
// ❌ discards the callback parameter and re-accesses by index
lines.reduce((acc, _line, idx) => { const line = lines[idx]; ... }, init);

// ✅
lines.reduce((acc, line) => { ... }, init);
```

Generators that build lazy data pipelines are defined only in pure calculation utilities (`shared/lib/`,
`entities/*/lib/`); widgets, components and Server Actions receive materialized arrays. Use one only where it pays
(several transforms over 1,000+ bars, or taking the first N); otherwise plain `map`/`filter` reads better. A generator
is one-shot: materialize it, or wrap it in a factory, before a second read.

<a id="CP-6"></a>

#### CP-6 — No `push` accumulation in pure calculations or functional contexts

Build results in pure calculations, `useMemo`, `reduce` and `map` with `map`, `filter`, `flatMap`, `reduce`, spread, `new Map(entries)` (the last entry per key wins; first-wins needs a reversed source or a loop) or `Array.from({ length }, …)` (also for request chunking), not with a loop that `push`es, `Map.set`s or `Set.add`s into an outer value, mutates an object you just created (`{ ...source, property }`), or reassigns a `let` min/max/sum (`Math.max`, `reduce`). The sliding-window / O(N) exception above is the only sanctioned local mutation, and only where the immutable form has a real cost; a short list stays immutable and a lint warning alone does not justify `push`. Where used, a comment names the cost; in `src/shared/lib/**` and `src/entities/*/lib/**` it reads `// CONVENTIONS.md#CP-6 예외: <cost>` above the function, loop or accumulator (guard `accumulator-in-loop`). `push` inside a `map`/`filter`/`reduce`/`flatMap` callback or a `useMemo` factory is never allowed (guard `push-in-functional-callback`).

```typescript
// ❌
const lines = [];
for (const rec of reconciled) { lines.push(...extractLines(rec)); }

// ✅
const lines = reconciled.flatMap(extractLines);
```

<a id="CP-7"></a>

#### CP-7 — Extracted nested functions take explicit parameters

When a function is lifted out of a parent function, every parent variable it used becomes an explicit parameter. An extracted function that still needs "something from above" was not really extracted — it is a closure at module scope waiting to break.

```typescript
// ❌
function searchAction() { function toResult(x) { /* uses parentVar */ } }

// ✅
function toResult(x, parentVar) { /* ... */ }
function searchAction() { toResult(x, parentVar); }
```

### Exhaustive Branching

<a id="CP-1"></a>

#### CP-1 — Branch exhaustively over domains with 3+ members

A binary ternary or an `if/else` chain over a union with three or more members silently misclassifies the unhandled case. Use an exhaustive `switch` over the discriminated union, or delegate to the existing exhaustive mapping function instead of rebuilding it with a ternary. The same applies to lookup maps: type them with required keys (`Record<Union, T>`) instead of keeping a defensive `throw` that can never run.

```typescript
// ❌ three asset classes, the third falls through to US
const spec = isKrEquitySymbol(s) ? KR : US;

// ✅ delegate to the authoritative exhaustive switch
const spec = sessionSpecFor(assetClassOf(s));
```

### Compute Once, Remove Dead Work

<a id="CP-2"></a>

#### CP-2 — Compute once, derive once

An identical value that is queried or computed more than once in a function is computed once and reused: a map lookup, a loop bound, a ratio used in both a helper and a log line, a repeated filter across several `useMemo`/effects, the same parameter object passed to several calls (a `const`, or `useMemo` in hooks), or the same resource (client, connection) created twice when one instance would do.

- When a predicate decides both a gate and the body of the code it gates, derive it once and share it between the two; two copies drift.
- Track values independently instead of back-deriving them from code that may move. A duration computed as `now - (deadline - BUDGET)` breaks silently the day `deadline` is computed elsewhere.

```typescript
// ❌
if (map.get(key)) { use(map.get(key)); }

// ✅
const value = map.get(key);
if (value) { use(value); }
```

<a id="CP-3"></a>

#### CP-3 — Remove logic that has no effect

Delete filters/maps that do not change the result, catch-all branches that never execute, and guards that restate what the type system already guarantees. When a refactor removes the last reason for an operation, remove the operation in the same change.

```typescript
// ❌ uniqueId is guaranteed by flatMap
data.flatMap(...).filter(x => x.id === uniqueId)

// ✅
data.flatMap(...)
```

### Priority by Layer

```
shared/lib/     Functional required — pure functions, immutability, higher-order functions
entities/lib/   Functional required — pure business logic functions
features/lib/   Functional recommended — separate internal logic into pure functions
widgets/        Declarative required — replace conditionals with object maps or component splits
app/            Declarative recommended — aligns naturally with RSC async/await patterns
```

---

## File / Directory Naming

```
Component files   PascalCase      StockChart.tsx
Hook files        camelCase       useStockData.ts
Util/function     camelCase       calculateRSI.ts
Type files        camelCase       types.ts
Test files        original.test   rsi.test.ts
Directories       lowercase kebab indicators/, stock-chart/
```

---

## TypeScript Rules

```typescript
// ✅ Prefer interface; use type alias for unions
interface Bar { time: number; open: number; }
type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

// ✅ Initial period values must be null
// (null = skip rendering, 0 = renders as invalid data in charts)
const result: (number | null)[] = new Array(period - 1).fill(null);

// ✅ Interface fields must be camelCase
// Even if the external source (e.g. YAML frontmatter) uses snake_case,
// define domain types in camelCase and transform in the infrastructure layer.
interface Skill { confidenceWeight: number; }

// ✅ Extract union literals with 2+ members into a type alias
type SignalStrength = 'strong' | 'moderate' | 'weak';
interface Signal { strength: SignalStrength; }

// Callback parameter annotations are optional when the type is inferred from context
// (bars.map(bar => ...)); `strict` (noImplicitAny) already rejects an un-inferrable one.

// ✅ Types must be declared at the top of the file, not inside functions
// ❌ function process() { interface Item { id: string; } ... }
// ✅ interface Item { id: string; }
//    function process() { ... }

// ✅ Related interfaces with shared fields must use extends
// ❌ interface B { ...all fields of A...; extra: string }
// ✅ interface B extends A { extra: string }
```

<a id="TS-3"></a>

#### TS-3 — Explicit return types on logic-bearing functions

Pure functions, business-logic functions, domain/infra helpers, custom hooks, Server Actions, and Route Handlers (`GET`/`POST`/…) declare their return type explicitly: it prevents inference drift and states the API contract.

```typescript
// ❌
async function loginAction(data: FormData) { ... }
export async function GET(req: Request) { ... }

// ✅
async function loginAction(data: FormData): Promise<LoginResult> { ... }
export async function GET(req: Request): Promise<NextResponse> { ... }
```

Exempt (Next.js file conventions — the framework fixes the signature and the return is self-evident): `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `icon.tsx`, `apple-icon.tsx`, `sitemap.ts`, `robots.ts`, `manifest.ts` under `app/**`. React components stay unannotated: TypeScript infers `JSX.Element`, and an annotation only adds noise.

<a id="TS-1"></a>

#### TS-1 — `as` assertions: guards first, documented safe-casts only

Prefer a type guard, a narrowing helper or `satisfies` over `as`. Never use the `!` operator instead: it silences the compiler without narrowing, so an impossible `null` fails later as a vague `TypeError` (production code is linted, see "Enforced rules"). A cast hiding a value that can really be `null`/`undefined`/another shape is the bug to avoid. Replacing a `!` or `as` means real narrowing (a closed key type or `switch`, a named error on the impossible branch, a restructure that makes the value known); a type predicate that claims more than it checks, a fail-open `?? fallback` or a silent `return` on an "impossible" branch only moves the bug.

A cast is acceptable only when TypeScript cannot express a constraint the runtime provably satisfies, and then it **must carry a comment stating the guarantee**:

- `Object.fromEntries(pairs) as Record<K, V>` and `Object.keys(record) as T[]` (keys widen to `string`, but `Record<T, …>` guarantees them) are the sanctioned safe-casts.
- The `fromEntries` cast is sanctioned only when the key set is closed by construction. When the values come from validating external data (parsed JSON), the cast carries the guarantee the validation should have: build the fixed-key record as an explicit object literal with one validating reader per key (`{ lines: readCount(raw, 'lines'), … }`) so each field is narrowed.
- Test files are exempt from the comment for self-documenting mock casts such as `fn as MockedFunction<typeof fn>`.
- Replace a post-check narrowing that repeats across call sites (`if (!x) throw` before every use) with a helper that returns the narrowed type or throws, e.g. `requireDatabaseUrl()`; for a one-off, bind a local `const` and return early or throw a readable error.
- Narrow external data (parsed JSON, a `Response` body, `unknown` input) with a type guard instead of asserting its shape (`body as Foo | null`); a double assertion (`as unknown as T`) needs the same WHY comment, in tests too, unless a typed fixture or guard removes the need.
- A parsed file (JSON manifest, config) and a caught error are external data too: narrow them with `isRecord` plus a per-item guard instead of `parsed as {entries?}` or `error as {code?}`. A malformed item then throws a named error with its index instead of flowing on as `undefined`.

```typescript
// ❌ hides a possible null / wrong shape
const value = fetchData() as MyType;
const x = someString as SpecificLiteral;

// ✅ TS limitation, not runtime risk — comment says why
// Object.keys widens to string[]; SKILL_STAT_CONFIG is Record<SkillType, …>, so every key is a SkillType.
const SKILL_TYPES = Object.keys(SKILL_STAT_CONFIG) as SkillType[];
```

<a id="TS-2"></a>

#### TS-2 — A local mirror of an upstream union must contain every member

When you keep a local `readonly T[]` to back a `value is T` guard (for example `isSkillCategory`), it must list every member of the upstream union, and a `@y0ngha/siglens-core` bump that adds union members is a sync trigger. TypeScript cannot detect a strict subset — the failure shows up at runtime as silently filtered data.

Prefer deriving the list so it cannot drift: `Object.keys(map) as T[]` from an upstream `Record<T, …>`, a compile-time exhaustiveness check paired with `satisfies`, or exporting the list from core itself.

#### Other TypeScript rules

- **Add parsed fields to the owning interface immediately.** When an adapter starts reading a new field from its data source, add it to the domain interface in the same change.
- **Interface optionality must match runtime behavior.** If the implementation does `bars ?? []`, the field is `bars?: BarData[]`; a field that is always present is not marked `?`.
- **Define each type once** in its canonical module and import it everywhere else. A duplicated declaration drifts the first time one copy changes.
- **No aliases without a distinct role.** `type SaveState = ApiKeyActionState; type DeleteState = ApiKeyActionState` adds indirection only; use the original. Extract a named alias when a role is genuinely distinct or a union repeats.
- **Named types over inline shapes**, for props, constants, and especially return types such as `Promise<{ a; b }>` in Server Actions and adapters: declare an `interface`/`type` and reuse it.

---

## Constants & Literals

<a id="NC-1"></a>

#### NC-1 — Named constants for magic numbers, strings, and time units

Extract every magic number and constant value to a module-level constant, and let function names stay true when the constant changes.

- String literals (event names, storage keys, magic strings) shared across files are one exported constant.
- Time math uses the shared constants (`MS_PER_HOUR`, `MS_PER_SECOND`, KST offset …) from `shared/config` or `@y0ngha/siglens-core`, not `hours * 60 * 60 * 1000`.
- **Drift trap:** once a constant exists in a file, every literal use of the same value in that file (JSX text, error messages, JSDoc, tests) references it. A tests file converted halfway keeps the old literal and passes for the wrong reason.
- A rounding factor and its `toFixed` digits are one constant, not two literals.
- A fallback or a displayed maximum (`/ 100`) imports the constant the logic uses; it never re-declares the value in a sibling module or in JSX text.
- Exception: Next.js route segment config (`revalidate`, `dynamic`, …) must stay a literal — see `src/app/CLAUDE.md#AP-1`.

```typescript
// ❌
const SPARKLINE_DAYS = 30;
<p>최근 30거래일 섹터 수익률</p>   // drifts when the constant changes

// ✅
<p>{`최근 ${SPARKLINE_DAYS}거래일 섹터 수익률`}</p>
```

## Numeric & Nil Guards

<a id="NC-2"></a>

#### NC-2 — Guard numeric, financial, and sentinel values explicitly

- **Financial values need range guards**, not just `Number.isFinite`: entry, take-profit, and stop-loss must be `> 0` and sensible relative to each other. A meaningless result (negative R:R) is suppressed, not displayed.
- **Money rounds to the currency minor unit** (USD 2 decimals, KRW 0), never with significant-figure rounding that changes digits with magnitude. Do not use `toFixed` for money: it is off by a cent at binary-float boundaries (`150.005`); apply a relative epsilon correction and `Math.round`, and avoid exponent-string round trips that turn float noise into `NaN`.
- **Prices keep precision**: format prices by significant figures so sub-penny assets do not collapse to `0`, and preserve the sign of calculated values such as a MACD histogram through serialization.
- **Sentinels propagate unchanged.** `Math.max(0, sentinel)` turns `-1` into `0`; guard the sentinel explicitly before wrapping.
- **Explicit nil/empty checks before comparisons.** `undefined < now` is `false`, so a stale-check without `x !== undefined` silently passes; a truthy check on the string `'None'` passes too.
- **NaN-aware guards** where a value can be `NaN`: `Number.isFinite` / `Number.isNaN`, not truthiness.
- Write defensive assertions so they cover every expected valid state, not only the degenerate case.

```typescript
// ❌
if (staleLastModified < currentTime) { ... }          // undefined passes silently
const reward = tp - entryPrice;                        // no tp > entryPrice guard

// ✅
if (staleLastModified !== undefined && staleLastModified < currentTime) { ... }
if (!(Number.isFinite(tp) && tp > 0 && tp > entryPrice)) return '';
```

---

## Pure Function Rules (shared/lib, entities/lib)

Functions here are pure: no `fetch`, `console.log` or `Date.now()`. Scope and the injected-repository exception:
`src/entities/CLAUDE.md#EN-1`.

---

## Import Path Rules

```typescript
// ✅ Use path aliases across slices and layers
import { cn } from '@/shared/lib/cn';
import { useBars } from '@/widgets/symbol-page/hooks/useBars';

// ❌ Relative paths that climb out of the slice (../../..)
import { cn } from '../../../shared/lib/cn';
```

Inside the same slice, cross-segment imports stay relative (`../lib/resolveGateMode`, see "No Barrels" below); the
alias is for crossing a slice or layer boundary.

<a id="CS-24"></a>

#### CS-24 — Imports form one block: packages first, then `@/` aliases, then relative

All `import` statements sit at the top of the file in a single block ordered package imports (`react` first), then `@/` alias imports, then relative imports. "One block" means no code between imports; a blank line between the three groups is allowed but not required — the order is the rule. Never place an import below a later group; the formatter does not reorder across groups, so review is the only guard.

```typescript
// ❌
import { cn } from '@/shared/lib/cn';
import { useState } from 'react';
import { helper } from './helper';

// ✅
import { useState } from 'react';

import { cn } from '@/shared/lib/cn';

import { helper } from './helper';
```

### No Barrels — Import from the Defining File

Barrels are banned (root `CLAUDE.md`; `src/__tests__/guards/noBarrelFiles.test.ts`). Every import, including tests and
`vi.mock`/`vi.importActual`/`await import()` paths, names the file that defines the symbol: `vi.mock` intercepts by
module path, so a different path is not mocked.

❌ `import { useSymbolModel } from '@/features/symbol-model';`
✅ `import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';`

---

## Lint and guard rules

Never use `eslint-disable`, `eslint-disable-next-line`, or `oxlint-disable` comments — not in production code and not in test helpers (guarded, see the table).
When a rule produces a warning, fix the root cause in the code rather than suppressing the rule (restructure deps, use `useEffectEvent` or a ref for stable references; see `REACT.md#EF-1` / `#EF-2`).

### Enforced rules

A rule listed here is enforced by the tool in the "Mechanism" column, in `yarn lint`, the pre-commit `oxlint --fix`, or `src/__tests__/guards`. CI reports it; review does not re-raise it. The config or guard carries the reason in a comment.

| Rule | Mechanism | Scope | Fix |
|---|---|---|---|
| `let` that is never reassigned (CP-4) | oxlint `prefer-const` (autofix) | all code | Make it `const`. |
| One import statement per module | oxlint `import/no-duplicates` (autofix) | all code | Merge the specifiers into the first import. |
| Imports before any other statement | oxlint `import/first` | production code; tests are exempt because `vi.mock` goes above the imports (`TESTING.md#TE-1`) | Move the import to the top of the file. |
| No explicit `any` | oxlint `typescript/no-explicit-any` | all code | Use `unknown` and narrow, or a precise type. Do not evade it: no alias that resolves to `any` (`ReturnType<typeof JSON.parse>`), no self-referential index type (`{ [k: string]: Self }`); use the real type, `Mutable<T>`, or `unknown` plus a shared narrowing helper. |
| No lint-disable comments | `codeRules.test.ts` rule `lint-disable-directive`, zero tolerance | comments in code under `src e2e scripts cache-handler db infra` and root configs; two allowlisted files that state a `--` reason | Fix the cause; a rule that cannot apply to a file is turned off in `.oxlintrc.json` with a reason. |
| No non-null assertion `x!` (TS-1) | oxlint `typescript/no-non-null-assertion` | production code (`src`, `scripts`, `db`, e2e support) | Early return, or a local `const` and a named error; for a Map or array lookup, destructure or use `entries()`. |
| No new non-null assertion in tests (TS-1) | `codeRules.test.ts` rule `non-null-assertion`, per-file baseline (`TOOLCHAIN.md#TC-41`) | test files and e2e | Bind the value and narrow it, or use `defined(value, 'what')` from `src/shared/test-utils/defined.ts`. |
| No assertion by mock call index (TE-27) | `codeRules.test.ts` rule `mock-call-index`, per-file baseline | test files and e2e | `mock.calls.find(...)` by a discriminating argument, or `toHaveBeenCalledWith`. |
| No `let x = a;` + `if` that only assigns `x` (CP-4) | `codeRules.test.ts` rule `let-then-if`, zero tolerance | all code | `const x = c ? b : a;` or a small named function. |
| No `let x;` + `try` that assigns `x` (CP-4) | `codeRules.test.ts` rule `let-then-try`, per-file baseline | all code | `const x = await load().catch(() => null)` or a small named function. |
| No `push`/`Map.set`/`Set.add` accumulation in a loop (CP-6) | `codeRules.test.ts` rule `accumulator-in-loop`, zero tolerance | production code in `src/shared/lib/**` and `src/entities/*/lib/**` | `map`/`flatMap`/`reduce`, or `// CONVENTIONS.md#CP-6 예외: <cost>` above the function, loop or accumulator. |
| No `push` in a `map`/`filter`/`reduce`/`flatMap` callback or `useMemo` factory (CP-6) | rule `push-in-functional-callback`, zero tolerance | production code | Return the values from the callback. |
| No `??=`, `||=`, `&&=` in components and hooks (EF-4) | rule `logical-assignment-in-react`, zero tolerance | production `.tsx` and `use*.ts` | Write the check and the assignment out. |
| No citation of local-only docs (CM-9) | rule `local-doc-citation`, zero tolerance | comments and strings of code, and `.sh`/`.css`/`.yml` text, under the scan roots; strings in test files are fixtures and skipped | State the fact inline. |
| No issue/PR number `#123`+ in a comment (CM-11) | `codeRules.test.ts` rule `issue-ref-in-comment`, zero tolerance | comments in `src/**/*.ts(x)`; URLs, `#418` in a React/hydration comment, hex colours with a letter and one-digit-repeat numbers are skipped; `PR 123` without `#` is not seen | State the constraint and reason instead. |
| No partial assertion on rendered SQL (TE-53) | rule `sql-substring-assertion`, zero tolerance | tests: `toContain`/`toMatch`/`toHaveLength`/`toBeTruthy`/`not.toBe('')`/`stringContaining`/`.includes()`/`.length` on `renderSql().sql`, `captured[n].sql`, aliases, joins, splits; absence checks need `// sql-absence: <reason>` (logged), snapshots are full pins; not seen: other-file helpers, `Array.from`/`reduce` lists, array destructuring | `toBe` the full rendered SQL. |
| The rules above stay switched on | `src/__tests__/guards/lintRulesEnabled.test.ts` plants a violation per rule and runs oxlint with the real config | `.oxlintrc.json` | Restore the rule instead of editing the guard. |

---

## Comments & Documentation

<a id="CM-1"></a>

#### CM-1 — Comments explain WHY, not WHAT

A comment earns its place by recording a reason, constraint or tradeoff the code cannot show. Delete comments that
label a section, narrate a state transition, restate a name or a type narrowing the compiler already proves,
`// ─── Title ───` separators and JSX `{/* Lock icon */}` labels, JSDoc that only repeats a component's or options
interface's name (`/** [[useX]] options. */`: say what the options control instead) or only lists a props interface's
field names, a file-header JSDoc that repeats the single export's JSDoc (keep one block, on the
export), comments framed as history ("회귀:", "previously…", "fixed in…"; state the current reason
instead), and
structural enumerations ("Profile + Valuation + Peers") that drift as the code changes. This is not a ban on
multi-line WHY blocks.

```typescript
// ❌ WHAT
// Existing OAuth account → immediate login
if (oauthRecord) return redirect('/dashboard');

// ✅ WHY
// Guard: a negative value breaks the log calculation downstream.
if (value < 0) return null;

// ❌ JSDoc that only restates the name
/** 회원이 담은 건수. */
export interface WatchlistCount { memberCount: number }

// ✅ Delete it, or state what the name cannot (unit, source, edge case)
```

<a id="CM-2"></a>

#### CM-2 — Comments must be factually accurate and stay in step with the code

Every claim in a comment or JSDoc (behaviour, callers, timing, narrowing target, browser or accessibility semantics,
geometry, time conversions, numbers) matches reality when written and after every change; a false WHY is worse than none.

- **Verify at the source before writing.** Grep the callers before a claim about consumers, counts or per-method
  behaviour ("only X uses this", "both validate at import time", "all queries retry"), read each member (what holds for
  one does not hold for the group), and name the callers or drop the claim. Identifiers named in a comment exist; a
  version or number cited after a merge is re-read against the merged state. Claims about other files, live systems or
  other components (a boot option, a deployed setting, "same order as the other tabs", a robots-blocked URL's headers)
  are checked there and dropped if they do not hold. A vendor or model claim says only what the cited source says about
  that exact subject, and copies of the comment are worded identically. A "stable"/"memoized" claim matches the
  dependency list (otherwise say what the identity depends on); a timing claim (on mount, after commit, before the
  response) matches the real hook or call order; runtime layout or a diagnosed mechanism is stated as fact only when
  measured, and a suspected cause is labelled as suspected. A time-zone comment matches the literal; check DST with
  `new Date(...).toLocaleString('en-US', { timeZone })`.
- **State the condition and the owner.** A consistency guarantee ("both paths see the same value", "cannot diverge")
  names the condition it holds under (warm cache, no budget timeout, same inputs), and a partial move onto a shared
  loader lists which callers moved and which keep their own path. A JSDoc describes only its own unit (a reducer's doc
  claims no rendering, a view's doc no state-transition rules). A count or policy value another constant or file owns
  (`TABS.length`, a TTL) is pointed at, not restated.
- **Re-read on every change.** When a function's processing order, workload, input, data source, location, caching or
  name changes, or it is split, moved, replaced or deleted (a comment naming a test or guard that was replaced
  promises protection that is gone), grep the old name, its concept and paraphrases repo-wide (`src/`,
  `e2e/`, `docs/`; CS-8) and update in the same change the comments, JSDoc, test names, sibling test comments ("in
  the same module"), class- or module-level summaries and sibling files, route and public docs, and the header doc of
  every touched file, including the one that holds the change. This covers a reversed layout contract, a setup, config
  or helper change to what a lane or module does (`vitest.config.ts` lane docs), hardcoded text becoming translated
  keys, and changed cancellation, retry or error semantics including status codes (once a response streams, a failure
  is an error body, not another status). Re-derive figures from a value that became per-locale or variable, re-read an
  ordering comment when entries change, grep a full identifier rather than a prefix, and after a split check that each
  paragraph sits on the half it describes, with no sentence cut and no field lost.

❌ "Every surface reads the hint from the shared cache." ✅ "Pages A, B and C read it from the shared cache; the agent
tool keeps its own lite read. Both agree once the 12 h cache is warm."

<a id="CM-3"></a>

#### CM-3 — Factual and numeric claims cite their evidence

A measurement, size, count, deadline or behavioral claim in a comment, runbook or doc must point to its evidence
(test, script, link, record) or say how to re-measure it; an unsourced figure can never be detected as stale. State
the conditions and units (a size measured as gzip S3 object size is not the uncompressed body length a gate
compares; two residency figures with different binding conditions say so), and for version-dependent claims give the
version, the check date and the command to re-check. Schedules and windows come from the schedule source, cited by
file, not from assumptions about business hours. When there is no measurement, say so ("no baseline yet").

When moving code or trimming or rewriting a comment, keep the measured evidence (figures with their conditions and
units, the re-check command) and drop only the narration of the past fix or the pointer to local notes (CM-9); a figure
removed together with its pointer leaves the claim unsourced.

```typescript
// ❌ unverifiable
// strong ETags block Cloudflare compression

// ✅ repeatable
// Strong ETags block Cloudflare compression: /NRICX origin gzip 39KB -> edge HIT 209KB.
// To re-check: read content-encoding on a cf-cache-status: MISS response.
```

<a id="CM-4"></a>

#### CM-4 — A JSDoc block stays directly above its declaration

When inserting a helper, constant or export above existing code, insert it above the `/**` of the existing block,
never between the JSDoc and its declaration. If the line above your insertion point ends with `*/`, move up. The
same applies to JSX: when wrapping an element that has a preceding comment block, put the wrapper above the comment.

The inverse also holds: when removing or moving a declaration, remove or move its JSDoc with it so no orphaned block is left above the next declaration.

The same holds for any comment, not only JSDoc: a new constant, setup block or statement never goes between a
comment and the code it describes (a header JSDoc and its declaration, a `// matchMedia ...` note and the line it
explains). Insert above the comment, or give the new code its own comment.

```typescript
// ❌ the new helper splits the JSDoc from fetchBars
/** Fetches bars for a symbol. */
function normalizeSymbol() {}
function fetchBars() {}

// ✅ inserted above the existing `/**`
function normalizeSymbol() {}
/** Fetches bars for a symbol. */
function fetchBars() {}
```

<a id="CM-5"></a>

#### CM-5 — Re-wrap a comment you lengthened

If an edit pushes a comment or JSDoc line past the file's existing wrap width, re-wrap the whole block to match the
surrounding style.

<a id="CM-6"></a>

#### CM-6 — Document deliberate deviations at the decision point

If behavior intentionally differs from nearby code or from what a reader expects, say why where the decision is made;
otherwise a later sweep "fixes" it. Examples: a call site that skips a new parameter, a literal left untranslated, a
deliberate omission from a title, a status code that differs from its siblings, shared state with
last-event-wins semantics, work started early for parallelism (state its discard cost on early return). A temporary
workaround names its removal condition and the tracking link.
A hook or function that is only correct under a caller assumption (e.g. an `enabled` flag never flipped after mount) states that assumption in its JSDoc.

<a id="CM-7"></a>

#### CM-7 — Cross-file invariants are enforced by guard tests, not "audited once" comments

A premise that holds across many files (every member-only Server Action authenticates itself, every route registers
in an allowlist) is enforced by a guard test that fails when a new file breaks it. A comment saying "audited on
<date>" does not keep the next file honest.

<a id="CM-8"></a>

#### CM-8 — `@internal` only on exports that are truly internal

Do not put `@internal` on a symbol that is not exported (it is internal by definition), and remove it from exported
functions that tests or other modules legitimately import.

<a id="CM-9"></a>

#### CM-9 — Public code and docs never cite local-only files

Comments, JSDoc, tests and tracked docs must not point at gitignored or local-only material (design specs, plans,
scratch logs, runbooks, production logs): a reader of the repository cannot open it, and the pointer cannot be checked
for staleness. State the fact or the reason inline, and cite only tracked files or rule IDs. Identifiers from local
benchmark, audit or eval sheets (`B-12`, "case 7 of the prompt eval") are local-only references too: write the
measured fact instead of the case ID. If the pointer was the instruction's only target, drop the instruction. Guard: `local-doc-citation`.

```typescript
// ❌ see docs/superpowers/specs/funnel.md §4 for why member prompts are excluded
// ❌ regression guard for benchmark case B-12
// ✅ Member-only prompts are excluded: the funnel measures anonymous visitors before signup.
```

<a id="CM-10"></a>

#### CM-10 — A measured-figure comment says only what its test asserts, and the test runs on the measured shape

A comment that says a test "pins" or "guards" a measured figure (payload size, count, width) must match the assertion:
a test that only checks a ceiling does not pin the figure. When the measured input changes (new fields, a larger
window, a live-only shape), re-measure, update the figure, and make the test exercise the same shape the figure was
measured on; a pin test fed the smaller fixture passes while the real payload drifts.
The same applies when the design changes rather than the input (a field dropped, a read moved to another source, a
window redefined): re-read every measured-figure comment in the touched module and its tests before finishing, because
the figure and the "pinned" wording outlive the design they described. Grep the touched files for the figure's unit
(`KB`, `bytes`, `pins`, `guards`) as part of that pass.

```typescript
// ❌ Pinned by sizeTest: ~4.2KB.   (the test only asserts size < 8KB, on a non-live fixture)
// ✅ Measured ~4.2KB on the live shape; sizeTest asserts the 8KB ceiling only.
```

<a id="CM-15"></a>

#### CM-15 — A claim about a guard or enforcement equals what the guard enforces

A comment, README or rule sentence that says a constraint is enforced ("refuses a non-local DB and Redis", "oxlint
enforces the layer rules", "the guard requires ASCII") names the real mechanism (lint rule, guard test file, or
review-time only) and holds only for what that mechanism checks. When the claim is wider than the check, narrow the
claim or extend the check in the same change; a rule that nothing enforces says so instead of implying a guard.

- ❌ "Refuses non-local databases and Redis" over a helper that validates only `DATABASE_URL`.
- ✅ One guard checks every inherited address variable, and the comment lists exactly those.

<a id="CM-14"></a>

#### CM-14 — Every export in a module gets JSDoc once its siblings do

When a file's exports carry JSDoc (role, consumer, WHY), a newly added or split-out export gets one too, and a JSDoc
that only restates the name or type does not count. A lone undocumented export reads as an oversight and hides its
consumer.

```typescript
// ❌ siblings documented, this one bare
export function rssNewsSurface() {}
// ✅ /** Why this surface exists and who consumes it. */

<a id="CM-13"></a>

#### CM-13 — One comment language per file

Match the language of the comments already in the file you edit: a new JSDoc or comment follows the file's existing
language, never introducing a second one. A mixed file reads as two authors and makes a grep for a concept miss half of it.

```typescript
// ❌ English JSDoc throughout the file, one new block written in Korean
// ✅ the new block is English like its neighbours
<a id="CM-12"></a>

#### CM-12 — Every exported component, hook and helper carries its own JSDoc

A module-level JSDoc does not replace per-symbol docs. Each exported component, hook and non-trivial helper gets a JSDoc directly above it stating its responsibility (and, for hooks, what it returns). A new export is not finished without one.

- ❌ A new `useEconomyFilter` exported under only the file's header comment.
- ✅ A short JSDoc above `useEconomyFilter` naming what it owns and returns.
<a id="CM-11"></a>

#### CM-11 — Comments describe the current design and WHY, not history

A comment or JSDoc states the present constraint and reason. It does not narrate PRs, audits, review rounds, issue or PR
numbers (guard-checked) or what the code used to do, and it does not announce planned future changes ("a later change will move..."), which go stale
as soon as the plan lands or changes. When a refactor changes a strategy (for example how a chart is remounted on theme change), re-read
the comments and helpers that describe the old strategy and rewrite or delete them; a comment that contradicts the code
is worse than none.

```typescript
// ❌ Added in the audit round; previously remounted via useThemeVersion().
// ✅ The chart is recreated on theme change because series colours are fixed at creation.
```

---

## Change Synchronization

<a id="CS-1"></a>

#### CS-1 — Reuse existing helpers before writing a new one

Search for an existing implementation before writing a new algorithm. Keep `number[]`-based helpers separate from
`Bar[]` wrappers so both callers can reuse them, and extract logic shared by provider pairs to
`entities/llm-provider/lib/` or `shared/lib/`.

<a id="CS-2"></a>

#### CS-2 — One source for duplicated logic and values

When the same guard, configuration value or literal appears in two or more places (build stages, scripts, config
files, one page's metadata and JSON-LD, coupled layout values such as a panel width and the axis offset that depends
on it), extract it to one shared source and import it everywhere. If a duplicate is unavoidable, see CS-3. Where a
second site is meant to import rather than redeclare a list, pin that with a source guard.

The same applies to derived logic, not only literals: one window boundary (for example a weekend roll-back) or one
"last completed daily close" rule computed in two places drifts apart. Keep one function in the lowest layer that
needs it and have the other callers delegate to it.

Extracting a shared rule (a validation predicate, a locale or formatting helper) is finished only when every existing
copy, including hand-rolled duplicates and constant aliases at the original call site, is migrated to it. Grep for the
old logic before calling the extraction done.

- ❌ Two helpers each re-derive "the previous trading day" with their own weekend handling.
- ✅ One exported helper owns the boundary; both callers import it, and one test pins its edge cases.

A condition that must hold in both a route's `generateMetadata` and its body component (a "degraded"/"empty" state
that switches the robots directive and the rendered content) is one `_lib` predicate that both call. A comment saying
"same expression as the body" is not enforcement.

A summary label follows the same rule: derive it from the aggregate it summarizes, never copy it from one component.
Validate label/aggregate consistency where the data enters, and regenerate bundled copies (an archive of the same data)
in the same change.

<a id="CS-3"></a>

#### CS-3 — Mirrored constants are documented and parity-tested

When a module cannot import a shared constant (a runtime constraint, a partially mocked module that is read at load
time), keep the literal and put a comment on every copy naming the original and the sync requirement, plus a parity
test that parses every copy (TypeScript, shell, config) and compares it with the source. Schemas duplicated across
files (Redis key layouts) get a block comment naming their origin.

The same applies when a JS constant and a Tailwind arbitrary-value class literal (`w-[45%]`, `h-[4px]`) encode the same
number: a comment alone does not keep them in sync. Add a test that reads the source file, extracts the literal and
compares it with the exported constant, and fails when the literal is not found.

```typescript
// ✅ shared/config/marketProfile/usEquity.ts
/** Mirrors `US_EXCHANGES` in `entities/ticker/server/fmpTickerApi.ts`; change both together. */
const US_EXCHANGES: ReadonlySet<string> = new Set(['NYSE', 'NASDAQ' /* ... */]);
```

<a id="CS-4"></a>

#### CS-4 — Product capability claims derive from one constant

Statements about what the product supports (asset classes, features per asset) that appear in titles, descriptions,
keywords, FAQ text and OpenGraph copy come from one exported constant or helper, never restated by hand. Add a test
asserting each consuming file's output covers every member, so adding or removing a capability fails immediately.
Copy that lists features or describes gated content states each feature's market scope and is checked against the feature-to-market mapping and the gate.

<a id="CS-5"></a>

#### CS-5 — Apply a rule to every sibling

A fix, guard or normalization applied to one of N siblings (two methods wrapping one upstream, a chart route and its
sibling routes, a register and a login action, provider A and provider B, a toggle's predicate and the hidden keys it
governs, the same business condition on server and client) must be applied to all of them. Hoist it into a helper
every sibling calls, and when the same user input flows through several functions normalize it identically (trim on
both register and login, or on neither). When fixing a pattern, grep for the other instances first.

<a id="CS-6"></a>

#### CS-6 — A spec lists only what its executor returns

Tool descriptions, schemas and JSDoc that list output fields must match what the executor actually returns, and a
documented null or edge case needs a test. Before writing "the provider does not expose this field", grep the
existing loaders for it.

<a id="CS-7"></a>

#### CS-7 — Register new items in every guard list in the same change

A new route, agent, i18n surface, feature flag, external service or tool error code must be added to every allowlist
or enumeration that covers its siblings (`RESERVED_FIRST_SEGMENTS`, `SURFACES`, `KNOWN_AGENTS`, the public API's
error-code mapping and catalog, ...) in the same commit, with a test
that fails when it is removed. Allowlists stay explicit and fixed; do not widen one with a dynamically built union.

<a id="CS-8"></a>

#### CS-8 — Grep the repo after moving, deleting or changing a constant

After a move, delete, constant change or merge-conflict resolution, grep the whole repo (`src/`, `e2e/`, `scripts/`,
`infra/`, `docs/`) for the old path, name or literal and update every hit in the same commit. Scoped test runs and editor
refactors miss e2e specs, hard-coded test literals and branch-only additions. When a data source starts feeding a
config list, check every test-enforced invariant over that list; a script's output should be dry-run against the
suite before it is committed. Rules that exist in several restatements (prompt body, digest, output directives)
are updated in all of them when one changes.

<a id="CS-9"></a>

#### CS-9 — Related state, functions and docs change together

When requirements change, update everything that depends on the same decision: `reset()` clears all related state
(`useState` and `useMutation`), sibling functions in a module use the same approach (a recursive collector and its
counter), and every field list in an instruction block gains the new field.

<a id="CS-10"></a>

#### CS-10 — Docs describing behavior change in the same PR

Reference docs, runbooks and architecture docs that describe an API, type, setting, default or example are updated
in the same change as the code. Examples and folder trees must exist in the code (no illustrative edges or
directories that are not real). A documented default must work at merge time (do not make a local DB the default if
the runtime driver cannot reach it) and, when PR order matters, the order is stated. Reference docs (for example a
local `docs/reference/API.md`) list every provider, path and parameter enum. A fast-changing union or list is not mirrored in a public doc; point at its source of truth so the doc cannot go stale.

<a id="CS-11"></a>

#### CS-11 — Parsers of another package's format name their owner

Code that parses an identifier or payload format produced by another package (an id with a suffix grammar) states which
package owns the format, defines a fallback for unknown shapes and has a test for every emitted shape, including the
plain suffix.

<a id="CS-12"></a>

#### CS-12 — No adapter methods without a production caller

New repository or adapter methods land in the PR that consumes them. Pre-emptive methods accumulate tests, mocks and
type churn for a design that may change before use.

<a id="CS-13"></a>

#### CS-13 — Update references before deleting TODO-marked code

Code kept under a TODO is referenced by other comments or commented-out code. Update or restore every reference
before deleting it.

<a id="CS-14"></a>

#### CS-14 — Policy and notice text matches code behavior line by line

Privacy policies, terms and in-product copy (prompts, toasts, banners) state exactly what the code does. Compare each
sentence with every code path that reads or writes the data; on a mismatch change the code or the text, never leave
both. Update the text in the same change as a new path that writes user data, a new use (extend the purpose list), or a
store found during the revision that was never disclosed (user-supplied keys, bands, counters). A security limit's
numbers (attempt caps, TTLs, windows) published there are pinned by a guard reading code constants (durations:
`privacyRetention.test.ts`; caps: `*Privacy.test.ts`), not test literals.

- Copy never promises a delivery or effect some users skip (gate it on the real state or word it conditionally), names
  a cause only when every path that shows it guarantees that cause, and labels a state only when the data can show it
  (a filing proves "filed", not "in progress").
- Policies list the storage items, the data actually used and every item sent to a third party (including identifiers
  embedded in links). Processor-held identifiers (a member id inside cache or quota keys) and every new event appear in
  the stored-data, purpose and retention sections; non-advertising items stay out of the advertising-cookie paragraph.
- Each claim word holds for every reader and writer: "hashed"/"anonymised" against what is stored raw; "used only for X"
  for every host or route that reads the same cookie or key; "encrypted" does not imply the server cannot read a value
  it decrypts at use; a disclosure names every flow and analysis kind that sends the value and says "may send" where a
  cache hit sends nothing. An absolute claim ("never uses the server key", "only X") is written only after auditing
  every transitive path, including indirect callers such as search or name-translation helpers, and a stated fact holds
  only for the scope the text names ("no language prefix" for the listed pages, not the whole site).
- State the bound the code enforces: retention from its real trigger (a TTL refreshed on every write is not "after
  storage"), a cookie or record lifetime as the maximum across every set path (a lazy catch-up path may write a fresh
  full term, so "as long as the session" is false), and cookie scope as the real domain (a parent-domain cookie covers
  every subdomain).
- A privacy claim ("the link address is not recorded") is checked against every stored field that can hold the value
  (an older column may keep the raw path) and against rows written before the change; when old rows contradict it, ship
  an idempotent backfill in the same change.
- Parallel locale texts use the same enumeration and punctuation; user-facing examples use plain language, not
  internal code values.

- ❌ Policy says "quantity and average price are used" while the code only reads tickers.
- ✅ Policy lists tickers only, matching what the code reads.

<a id="CS-15"></a>

#### CS-15 — A name promises only what the code proves

A function, variable or field name states what the code guarantees, not what it usually is. Before naming a value
`close`, `latest` or `verified`, check that the code establishes it (a date match alone does not prove a bar is the
close); a helper named for one behavior (`formatKoreanDate`) must not silently do another (locale-aware). When the
guarantee is weaker, name the weaker fact or add the missing check.

- ❌ `const close = bar.close` after verifying only that `bar.date` matches the session date.
- ✅ Verify the bar is final, or name it for what is known (`lastBarClose`).

The same holds for a status flag or marker field (`missing`, `exact`, `fresh`, `complete`): set it only for the case
the code actually established. A flag that covers several cases (absent vs. stale, exact vs. legacy data that cannot
prove exactness) is split per case or set from the narrower check. Explanatory text attached to such a result (a hint
or note read by a user or a model) follows the same limit: it states only the case the code distinguished ("none usable
for this caller", not "none exists") and names only fields or tools that are present in that response.

<a id="CS-16"></a>

#### CS-16 — Comments, logs and operator messages describe what the code path actually does

A comment, help text or log line on a destructive or operator-facing script must match the code path: do not say
"not touched" or "read-only" when a branch replaces or deletes data, and keep log wording in step with the counting
rule (what is counted, per what unit). When the behavior changes, change the text in the same edit.

- ❌ "Existing rows are left untouched" above a path that replaces them.
- ✅ State the replacement and the condition under which it happens.

<a id="CS-17"></a>

#### CS-17 — Displayed and tool-emitted numbers keep the source's meaningful precision

A formatter or tool projection must not round a small non-zero value to zero or print a fractional count with a
spurious decimal. Choose the digits from the value's magnitude (or show `<0.001%`), and render whole-valued counts
(days, items) as integers. A test fixture that expects the collapsed output locks the bug in: derive expected strings
from the real source value, not from the formatter's current output.

- ❌ `0.0004` formatted as `0.000%`, or a day count shown as `0.0일`.
- ✅ `<0.001%`, or the value at enough digits to stay non-zero; `0일` / `3일` for whole counts.

<a id="CS-18"></a>

#### CS-18 — A displayed label or score states what the data measures and carries its basis

A user-facing label, score or chart title names only what the underlying data proves. A score computed from a
partial source (filings only, daily candles, an estimate) says so in its name or caption, and an estimated split is
not labelled with the real-world quantity it approximates. When the data cannot support the stronger term, use the
weaker one or show the basis next to the value. Each rendered figure names its own basis (reference value,
denominator, comparison) in the same card; a basis written once for several tables must hold for every table it covers.
A verdict sentence follows the producer's definition (`no_edge`: not shown to beat placebo), tested on a boundary row.
A product-reserved term (golden cross) never labels another definition.

- ❌ "Order flow" computed from daily candles; "buy/sell volume" for a close-location estimate.
- ✅ "Estimated volume split (from daily candles)"; a flow score captioned with the filings it is built from.

<a id="CS-19"></a>

#### CS-19 — Values from an incomplete period are not presented as directional or final

A figure aggregated over a period that is still in progress (a running quarter, a partially reported window) is not a
final number. Do not label it with a direction (net buy / net sell, up / down) or rank it against complete periods.
Detect "still collecting" from the period's completeness, not only from empty data, so a partial aggregate never looks
complete. Show it as in-progress or leave it out.

- ❌ Labelling the net flow of a quarter that has only a few filings as "net selling".
- ✅ Marking the in-progress quarter as collecting, and deriving that state from period completeness rather than from an empty result.

<a id="CS-26"></a>

#### CS-26 — Removing a cast or assertion keeps the accepted values identical

An `as` cast, `!` or loose parser hides a runtime decision (what `undefined`, `null`, `NaN`, or a wrong type does). When
a refactor replaces it with a typed helper, compare every input class against the old behavior: throw vs skip, `null`
becoming `Invalid Date` vs epoch, `NaN` propagated vs filtered. Keep the old result, or change it deliberately and
say so in the PR and pin it with a test.

- ❌ Swapping `new Date(row.at as string)` for a helper that skips `undefined` and turns `null` into `Invalid Date`.
- ✅ A test table of `undefined`, `null`, `NaN` and a valid value run against old and new code before the cast goes.
<a id="CS-25"></a>

#### CS-25 — A refactor changes no behavior without a demonstrated bug

In a structure-only change (SRP split, rename, move), do not add a guard, tighten validation, add a sort tiebreak or
otherwise alter what input is accepted or what output is produced "while you are there". Such an edit needs a failing
case that shows the bug (a test, a real data shape, a reproduction); without one it is speculation that changes accepted
input or ordering and hides inside a diff reviewers read as a pure move. A change with a demonstrated bug is a behavior
change: keep it separate from the move or list it in the PR body.

- ❌ Adding a strict hex regex to a token check, or an `orderBy` tiebreak where the data never produces a tie, in an
  extraction PR.
- ✅ Move the code unchanged; fix a proven bug in its own commit with the test that failed.

<a id="CS-22"></a>

#### CS-22 — Export only what another module imports

A constant, type or helper with no importer outside its own file stays private. Do not export a symbol only so a test can
read it; test through the public behaviour, or move the symbol to a non-component module that a consumer really imports.

- ❌ `export const FLAT_EPSILON = 0.005` that nothing imports.
- ✅ `const FLAT_EPSILON = 0.005`, exercised through the component's rendered output.
<a id="CS-20"></a>

#### CS-20 — Visibility and emptiness checks use the value the UI renders

When a block is shown or hidden based on a text or value, the check reads the same resolver, field and rounding the rendered output uses. Testing a different field (a raw or non-localized one) than the one printed makes the block appear empty, or hide when it has content. Derive both from one shared value.

- ❌ `summaryKo ? <Summary text={resolveSummary(item, locale)} /> : null`
- ✅ `const text = resolveSummary(item, locale); text ? <Summary text={text} /> : null`

<a id="CS-21"></a>

#### CS-21 — Compute a value only on the path that uses it

A value that only one branch reads is computed inside that branch (or behind the same condition), not on every render or
call and then discarded when the condition is off. Deriving it unconditionally does work the user never sees and hides
which branch actually depends on it.

- ❌ `const hasVisible = visibleOf(group).length > 0;` … `{isSelected && !hasVisible && <EmptyNote />}`
- ✅ `const showEmptyNote = isSelected && visibleOf(group).length === 0;`
<a id="CS-23"></a>

#### CS-23 — Sign, colour and prefix come from the rounded value that is printed

When a number is displayed at fixed precision, decide its sign, "+" prefix, colour and zero state from the rounded
value, not the raw one. Otherwise a value that rounds to zero prints as "-0.00%" or is coloured as a loss while the
text shows nothing.

- ❌ `value < 0 ? '-' : '+'` on the raw `-0.004`, printing `-0.00%`.
- ✅ Round first (`const r = Number(value.toFixed(2))`), then derive sign and colour from `r`; `0` gets the neutral colour and the same prefix as an exact zero.
