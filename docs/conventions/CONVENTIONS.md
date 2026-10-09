# Conventions

General coding rules. Client-side rules (hooks, components, effects, charts, Tailwind, React Query, URL state) live in [`REACT.md`](REACT.md); server-side rules (Server Actions, I/O, concurrency, data cache, database) in [`SERVER.md`](SERVER.md); test rules in [`TESTING.md`](TESTING.md).

## Rule IDs

Rules that are cited from code comments, reviews, or other docs carry a stable ID in the form `PREFIX-N`,
with an explicit anchor line directly above the heading (`<a id="CP-2"></a>`).
Cite them as `CONVENTIONS.md#CP-2`. IDs are never renumbered or reused; a new rule takes the highest existing number of its prefix + 1; if a rule is deleted, delete its references in the same change.
`src/__tests__/guards/ruleReferences.test.ts` fails on any reference that does not resolve to an anchor.

| Prefix | Topic |
|---|---|
| `CP` | Coding paradigm (declarative, functional, exhaustive branching, compute once) |
| `TS` | TypeScript rules |
| `NC` | Constants & literals, numeric and nil guards |
| `CM` | Comments & documentation |
| `CS` | Change synchronization |
| `I18` | i18n |

Prefixes `HK` `CR` `AX` `EF` `LW` `TW` `RQ` live in [`REACT.md`](REACT.md); `SA` `CC` `DC` `DB` in [`SERVER.md`](SERVER.md); `TE` in [`TESTING.md`](TESTING.md).

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

```typescript
// ✅ Acceptable — sliding window where for-loop is more efficient and readable
for (let i = 0; i + period <= values.length; i++) {
    const window = values.slice(i, i + period);
    results.push(compute(window));
}
```

**Exception — `while` is allowed when the algorithm's termination condition is naturally expressed as a predicate, not as a counter:**
- Binary search (convergent boundary `low`/`high` pointers)
- Pointer-convergence loops (two pointers approaching each other)
- Cases where a `for` header equivalent would be an empty `for (; condition; )` — use `while` instead for clarity

```typescript
// ✅ Acceptable — binary search where while expresses the convergence condition directly
while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (bars[mid].time === time) return mid;
    if (bars[mid].time < time) low = mid + 1;
    else high = mid - 1;
}
```

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

<a id="CP-5"></a>

#### CP-5 — Name complex inline expressions; turn repeated JSX into data + map

Extract to a named helper (or a data array rendered with `.map()`) when an expression would otherwise be hard to read or repeat:

- The same `className` ternary three or more times: one helper.
- IIFEs and multi-statement ternaries: a named function.
- The same JSX structure twice or more: a data array plus `.map()`.
- Combining Tailwind classes always goes through `cn()` (see Tailwind CSS Rules), never template literals or `+`.

Why: named helpers can be tested and renamed; anonymous expressions drift independently when copied.

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

// ✅ Extract nested functions to module-level with explicit parameters
// ❌ function parent() { function child() { uses parentVar } }
// ✅ function child(parentVar: T) { ... }  // extracted, explicit params
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

<a id="CP-6"></a>

#### CP-6 — No `push` accumulation in pure calculations or functional contexts

Pure calculation functions and anything inside `useMemo`/`reduce`/`map` build their result with `map`, `filter`, `flatMap`, `reduce`, or spread — never a `for` loop that `push`es into an outer array. This also covers object mutation: derive `{ ...source, property }` instead of assigning a property on an object you just created. The sliding-window / O(N) state-machine exception above is the only sanctioned local mutation.

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

// ❌ No any
const data: any = response;

// ✅ Return types must be explicitly declared on non-component functions
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }

// ❌ Do NOT annotate return types on UI-rendering functions (components)
// TypeScript infers JSX.Element / ReactNode automatically; annotating adds noise
export function StockChart({ symbol }: StockChartProps): JSX.Element { ... } // ❌
export function StockChart({ symbol }: StockChartProps) { ... }              // ✅

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

// Callback parameter type annotations are required when TypeScript cannot infer
// the type from context. When the type is already inferred from the surrounding
// expression, explicit annotations are optional (but allowed for clarity).
// bars.map(bar => ...)                   ✅ inferred from Bar[] — annotation optional
// bars.map((bar: Bar) => ...)            ✅ explicit — also fine
// items.map((p: Omit<T, 'id'>) => ...)  ✅ required — Omit<> not inferrable from context

// ✅ No hardcoded literals — extract to constants
// ❌ period = 14
// ✅ period = RSI_DEFAULT_PERIOD  (@y0ngha/siglens-core public constant or shared/config)

// ✅ Types must be declared at the top of the file, not inside functions
// ❌ function process() { interface Item { id: string; } ... }
// ✅ interface Item { id: string; }
//    function process() { ... }

// ✅ Return named interfaces instead of inline object types
// ❌ function getCredentials() { return { apiKey, secretKey }; }
// ✅ interface Credentials { apiKey: string; secretKey: string; }
//    function getCredentials(): Credentials { ... }

// ✅ Prefer type guards over `as` type assertions
// ❌ const user = data as User;
// ✅ if ('name' in data) { /* data is User */ }
// Exception: DOM elements, third-party library return types (add comment explaining why)

// ✅ Hardcoded array indices → named constants
// ❌ result.split('\n\n')[1]
// ✅ const SECTION_INDEX = 1; result.split('\n\n')[SECTION_INDEX]

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

Exempt (Next.js file conventions — the framework fixes the signature and the return is self-evident): `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `icon.tsx`, `apple-icon.tsx`, `sitemap.ts`, `robots.ts`, `manifest.ts` under `app/**`. React components also stay unannotated (see above).

<a id="TS-1"></a>

#### TS-1 — `as` assertions: guards first, documented safe-casts only

Prefer a type guard, a narrowing helper, `satisfies`, or (when null is logically impossible) the `!` operator over `as`. A cast that hides a value which can really be `null`/`undefined`/another shape is the bug being avoided.

A cast is acceptable only when TypeScript cannot express a constraint the runtime provably satisfies, and then it **must carry a comment stating the guarantee**:

- `Object.fromEntries(pairs) as Record<K, V>` and `Object.keys(record) as T[]` (keys widen to `string`, but `Record<T, …>` guarantees them) are the sanctioned safe-casts.
- Test files are exempt from the comment for self-documenting mock casts such as `fn as MockedFunction<typeof fn>`.
- Replace a post-check `value!` that repeats across call sites with a helper that returns the narrowed type (or throws), e.g. `requireDatabaseUrl()`.

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
- **No checks that duplicate type guarantees.** If `AssetInfo.name` is required, `!!assetInfo?.name` should be `!!assetInfo`.

---

## Constants & Literals

<a id="NC-1"></a>

#### NC-1 — Named constants for magic numbers, strings, and time units

Extract every magic number and constant value to a module-level constant, and let function names stay true when the constant changes.

- String literals (event names, storage keys, magic strings) shared across files are one exported constant.
- Time math uses the shared constants (`MS_PER_HOUR`, `MS_PER_SECOND`, KST offset …) from `shared/config` or `@y0ngha/siglens-core`, not `hours * 60 * 60 * 1000`.
- **Drift trap:** once a constant exists in a file, every literal use of the same value in that file (JSX text, error messages, JSDoc, tests) references it. A tests file converted halfway keeps the old literal and passes for the wrong reason.
- A rounding factor and its `toFixed` digits are one constant, not two literals.
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

```typescript
// ✅ Pure functions only
// ❌ No side effects: fetch, console.log, Date.now() are all prohibited
function calculateRSI(closes: number[], period = RSI_DEFAULT_PERIOD): (number | null)[] {
    // pure calculation only
}
```

Where pure-only applies to `entities/*/lib/` and the sanctioned exception for injected-repository pipeline steps, see `src/entities/CLAUDE.md#EN-1`.

---

## Test Rules

Test rules live in [TESTING.md](./TESTING.md) (rule IDs `TE-N`).

---

## Import Path Rules

```typescript
// ✅ Use path aliases
import { cn } from '@/shared/lib/cn';
import { useBars } from '@/widgets/symbol-page/hooks/useBars';

// ❌ No relative paths
import { cn } from '../../../shared/lib/cn';
```

Consolidate imports from the same module into one statement (oxlint has no `no-duplicates` rule here, so review catches it):

```typescript
// ❌
import { formatUsdPrice } from '@/shared/lib/priceFormat';
import { formatPriceChange } from '@/shared/lib/priceFormat';

// ✅
import { formatUsdPrice, formatPriceChange } from '@/shared/lib/priceFormat';
```

### No Barrels — Import from the Defining File

`index.ts`/`index.tsx` barrel은 금지다(`src/__tests__/guards/noBarrelFiles.test.ts`가 강제).
모든 import — 테스트와 `vi.mock`/`vi.importActual`/`await import()` 경로 포함 — 는 심볼을 **정의한
파일**을 가리킨다.

- 다른 슬라이스·레이어의 심볼: `@/` path alias로 정의 파일을 직접 import
- 같은 슬라이스 내부 segment 간 참조: relative import (`../model/types`)
- `vi.mock`은 코드가 실제로 import하는 **정의 파일 경로**를 mock한다(모듈 단위로 가로채므로 경로가 다르면 mock이 적용되지 않는다)

```typescript
// ✅ 같은 slice 내 — relative import
// src/features/auth/ui/LoginForm.tsx
import type { AuthFormState } from '../model/types';

// ✅ 다른 slice — 정의 파일 직접 import
import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';

// ❌ 슬라이스 루트(barrel) import — barrel은 존재하지 않는다
import { useSymbolModel } from '@/features/symbol-model';
```

---

## Lint Rules (oxlint)

Never use `eslint-disable`, `eslint-disable-next-line`, or `oxlint-disable` comments — not in production code and not in test helpers.
When a rule produces a warning, fix the root cause in the code rather than suppressing the rule (restructure deps, use `useEffectEvent` or a ref for stable references; see `REACT.md#EF-1` / `#EF-2`).

```typescript
// ✅ import/first — imports must be at the top of the file
import { calculateRSI } from './rsi';
export * from './rsi';

// ❌ No imports after export *
export * from './rsi';
import { calculateRSI } from './rsi';

// ✅ no-shadow — do not use browser/Node global names as variable names
// Prohibited: window, document, location, event, name, length, screen
```

EOF newline: every file must end with `\n`. Auto-fixed by `yarn format`.

---

## Comments & Documentation

The repo allows multi-line JSDoc and comment blocks when the WHY is non-obvious; see the "Documentation Policy" in
the root `CLAUDE.md`. The rules below target comments that restate the code or state things that are not true.

<a id="CM-1"></a>

#### CM-1 — Comments explain WHY, not WHAT

A comment earns its place by recording a reason, constraint or tradeoff the code cannot show. Delete comments that
label a section, narrate a state transition, restate a name or a type narrowing the compiler already proves,
`// ─── Title ───` separators and JSX `{/* Lock icon */}` labels, JSDoc that only repeats a component's name, and
structural enumerations ("Profile + Valuation + Peers") that drift as the code changes. This is not a ban on
multi-line WHY blocks.

```typescript
// ❌ WHAT
// Existing OAuth account → immediate login
if (oauthRecord) return redirect('/dashboard');

// ✅ WHY
// Guard: a negative value breaks the log calculation downstream.
if (value < 0) return null;
```

<a id="CM-2"></a>

#### CM-2 — Comments must be factually accurate and stay in step with the code

Every claim in a comment (behavior, callers, narrowing target, browser or accessibility semantics, geometry, time
conversions) must match reality, and a false WHY is worse than none. Re-verify the claim whenever the code, the
file or the rule it describes changes:

- "Only X uses this" claims go stale when a second caller appears; name callers explicitly or drop the claim.
- When a function's processing order or workload changes (a step appended, steps reordered), re-read its JSDoc and the
  route or caller doc that describes it, for example a "short, no lock needed" claim.
- When a function's input, data source or location changes, or a file or function is deleted, grep for comments,
  JSDoc and test names that mention it and update them in the same change (see CS-8).
- After reversing a layout contract, grep the whole repo (`src/`, `e2e/`, `docs/`) for the old wording, including
  test names.
- A time-zone comment must match the literal exactly; check DST dates with
  `new Date(...).toLocaleString('en-US', { timeZone })`.
- After splitting a function or JSDoc, check that each paragraph stays on the half it describes and that no
  sentence is cut in the middle or loses a field the next paragraph relies on.
- Claims about other files or live systems (a boot option, a deployed setting) are verified at their source.

<a id="CM-3"></a>

#### CM-3 — Factual and numeric claims cite their evidence

A measurement, size, count, deadline or behavioral claim in a comment, runbook or doc must point to its evidence
(test, script, link, record) or say how to re-measure it; an unsourced figure can never be detected as stale. State
the conditions and units (a size measured as gzip S3 object size is not the uncompressed body length a gate
compares; two residency figures with different binding conditions say so), and for version-dependent claims give the
version, the check date and the command to re-check. Schedules and windows come from the schedule source, cited by
file, not from assumptions about business hours. When there is no measurement, say so ("no baseline yet").

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
for staleness. State the fact or the reason inline, and cite only tracked files or rule IDs.

```typescript
// ❌ see docs/superpowers/specs/funnel.md §4 for why member prompts are excluded
// ✅ Member-only prompts are excluded: the funnel measures anonymous visitors before signup.
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

<a id="CS-3"></a>

#### CS-3 — Mirrored constants are documented and parity-tested

When a module cannot import a shared constant (a runtime constraint, a partially mocked module that is read at load
time), keep the literal and put a comment on every copy naming the original and the sync requirement, plus a parity
test that parses every copy (TypeScript, shell, config) and compares it with the source. Schemas duplicated across
files (Redis key layouts) get a block comment naming their origin.

```typescript
// ✅ shared/config/marketProfile/usEquity.ts
/** Mirrors `US_EXCHANGES` in `entities/ticker/lib/fmpTickerApi.ts`; change both together. */
const US_EXCHANGES: ReadonlySet<string> = new Set(['NYSE', 'NASDAQ' /* ... */]);
```

<a id="CS-4"></a>

#### CS-4 — Product capability claims derive from one constant

Statements about what the product supports (asset classes, features per asset) that appear in titles, descriptions,
keywords, FAQ text and OpenGraph copy come from one exported constant or helper, never restated by hand. Add a test
asserting each consuming file's output covers every member, so adding or removing a capability fails immediately.

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

A new route, agent, i18n surface, feature flag or external service must be added to every allowlist or enumeration
that covers its siblings (`RESERVED_FIRST_SEGMENTS`, `SURFACES`, `KNOWN_AGENTS`, ...) in the same commit, with a test
that fails when it is removed. Allowlists stay explicit and fixed; do not widen one with a dynamically built union.

<a id="CS-8"></a>

#### CS-8 — Grep the repo after moving, deleting or changing a constant

After a move, delete, constant change or merge-conflict resolution, grep the whole repo (`src/`, `e2e/`, `scripts/`,
`docs/`) for the old path, name or literal and update every hit in the same commit. Scoped test runs and editor
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
local `docs/reference/API.md`) list every provider, path and parameter enum.

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

Privacy policies, terms and in-product copy (prompts, toasts, banners) state exactly what the code does. Copy never promises a delivery or effect the code skips for some users; gate the prompt on the real state or word it conditionally. Policies list the storage items, the data
actually used and every item sent to a third party (including identifiers embedded in links). Compare each sentence
with the code path; on a mismatch change the code or the text, never leave both. When a new code path starts writing
user data, update the text in the same change. Keep non-advertising storage items out of the advertising-cookie
paragraph.

- ❌ Policy says "quantity and average price are used" while the code only reads tickers.
- ✅ Policy lists tickers only, matching what the code reads.

---

## Layer Dependency Rules

`→ see the "Layer Dependency Rules" section of CLAUDE.md` for the authoritative layer dependency rules.

---

## Iteration Protocol

Use JavaScript's iteration protocol (`Symbol.iterator`) and generators to compose data pipelines.

### When to Use

| Situation | Approach |
|---|---|
| Applying multiple transforms in a single pass over an array | Generator pipeline |
| Making a custom data structure consumable with `for...of` | Implement `Symbol.iterator` |
| Exposing pure calculation data as an iterable to external consumers | `Iterable` interface |
| Processing thousands of Bar records step by step | Lazy evaluation (see section below) |

### Symbol.iterator — Custom Iterables

```typescript
// ✅ Custom iterable — expose results as an iterable from pure calculation utilities
class SlidingWindow<T> implements Iterable<T[]> {
    constructor(private items: T[], private size: number) {}

    [Symbol.iterator](): Iterator<T[]> {
        let index = 0;
        const { items, size } = this;
        return {
            next(): IteratorResult<T[]> {
                if (index + size > items.length) return { done: true, value: undefined };
                return { done: false, value: items.slice(index++, index + size - 1) };
            },
        };
    }
}

// ✅ Consume naturally with for...of
for (const window of new SlidingWindow(closes, 14)) {
    // window: number[]
}
```

### Generator Functions

```typescript
// ✅ Express a sliding window as a generator — used purely in calculation helpers
function* slidingWindow<T>(items: T[], size: number): Generator<T[]> {
    for (let i = 0; i + size <= items.length; i++) {
        yield items.slice(i, i + size);
    }
}

// ✅ Compose generators — iterable pipeline with no intermediate arrays
function* map<T, U>(iter: Iterable<T>, fn: (v: T) => U): Generator<U> {
    for (const item of iter) yield fn(item);
}

function* filter<T>(iter: Iterable<T>, pred: (v: T) => boolean): Generator<T> {
    for (const item of iter) if (pred(item)) yield item;
}

// ✅ Usage — pipeline with no intermediate arrays
const gains = filter(
    map(slidingWindow(closes, 2), ([prev, curr]) => curr - prev),
    (delta) => delta > 0,
);
```

### Pitfalls

```typescript
// ❌ Do not define generators directly in Server Actions or UI components.
//    Generator-based iterables belong in pure calculation utilities only.

// ❌ Do not consume a generator more than once — iterators are one-shot
const gen = slidingWindow(closes, 14);
const a = [...gen]; // consumed
const b = [...gen]; // ❌ b is always an empty array

// ✅ When reuse is needed, materialize to an array or wrap in a factory function
const windows = () => slidingWindow(closes, 14); // new generator on each call
```

---

## Lazy Evaluation

Use lazy evaluation when data is large (thousands of Bars or more) or when multiple transformation stages would create many intermediate arrays.

### When to Choose Lazy Evaluation

```
✅ Use lazy evaluation when:
- The Bar array has 1,000+ items and requires multi-stage transforms (filter → map → reduce)
- Only the first N results are needed — generators short-circuit without processing the rest
- Computing streaming indicators one value at a time

❌ Skip lazy evaluation when:
- There is only one transformation stage or the dataset is small (a few hundred items or fewer)
  → plain .map() / .filter() is more readable
- The result must be shared across multiple consumers
  → materialize to an array first, then share
```

### Pattern 1 — Generator Pipeline

```typescript
// ✅ shared/lib or @y0ngha/siglens-core — reusable lazy utilities
function* lazyMap<T, U>(iter: Iterable<T>, fn: (v: T) => U): Generator<U> {
    for (const item of iter) yield fn(item);
}

function* lazyFilter<T>(iter: Iterable<T>, pred: (v: T) => boolean): Generator<T> {
    for (const item of iter) if (pred(item)) yield item;
}

function* lazyTake<T>(iter: Iterable<T>, n: number): Generator<T> {
    let count = 0;
    for (const item of iter) {
        if (count++ >= n) return;
        yield item;
    }
}

// ✅ Extract the first N closing prices from bullish candles — no intermediate arrays
function getFirstNBullishCloses(bars: Bar[], n: number): number[] {
    const bullish = lazyFilter(bars, (b) => b.close > b.open);
    const closes = lazyMap(bullish, (b) => b.close);
    return [...lazyTake(closes, n)];
}
```

### Pattern 2 — Streaming Accumulation

```typescript
// ✅ Compute a cumulative average in a single pass over the input
function* cumulativeAverage(values: Iterable<number>): Generator<number> {
    let sum = 0;
    let count = 0;
    for (const v of values) {
        sum += v;
        count++;
        yield sum / count;
    }
}
```

### Pattern 3 — Explicit Materialization Point

```typescript
// ✅ Define the pipeline lazily; materialize only at the final consumption point
function calculateLazyRSI(closes: number[], period: number): (number | null)[] {
    // Pipeline definition — nothing runs yet
    const windows = slidingWindow(closes, period);
    const rsiValues = lazyMap(windows, computeRSIFromWindow);

    // Materialize here — actual computation happens at this point
    const prefix: null[] = new Array(period - 1).fill(null);
    return [...prefix, ...rsiValues];
}

// ❌ Do not create an intermediate array at every stage
function calculateEagerRSI(closes: number[], period: number): (number | null)[] {
    const windows = closes                     // intermediate array
        .map((_, i) => closes.slice(i, i + period))
        .filter((w) => w.length === period);   // intermediate array
    return windows.map(computeRSIFromWindow);  // intermediate array
}
```

### Lazy Evaluation and Layer Rules

```
shared/lib/     Lazy pipeline definitions allowed (pure generator functions)
entities/lib/   Lazy pipeline definitions allowed (pure generator functions)
                Materialize (spread / Array.from) only as the last step inside the function
entities/api/   Call entity/shared generator functions and consume their results
widgets/        Do not define lazy pipelines directly
                Receive already-materialized arrays via entity/shared functions
```

---

## i18n Rules

<a id="I18-1"></a>

#### I18-1 — Regenerate i18n artifacts after source changes

Run `yarn i18n:extract --write` after editing source that has skipped i18n literals (line shifts move the skip
markers in `messages/_meta/skips.json`) or after changing a route's import graph (its client key manifest,
`messages/_meta/clientKeys.json`). Plain `yarn i18n:extract` only scans; commit the regenerated artifacts in the
same change.

<a id="I18-2"></a>

#### I18-2 — Keep all locale catalogs in step

Adding, renaming, changing or removing a catalog key applies to every locale file (`ko`, `en`, `ja`, `zh`) in the
same change, then `yarn i18n:verify` must pass. Translations for en/ja/zh come from `yarn i18n:translate`. A key
added to one locale makes the others fall back to raw text. Skill cards are keyed by the skill `name`
(`shared.skillName.<name>`, `shared.skillSummary.<name>`); see `skills/CLAUDE.md` for what a skill change requires.

<a id="I18-3"></a>

#### I18-3 — Hand-written catalog keys also get a `hashes.json` entry

Keys written by hand add an entry to `messages/_meta/hashes.json` (`sha1(ko value).slice(0, 12)`) in the same
change. Without it the next `yarn i18n:translate` treats the translations as stale and overwrites them, and
`i18n:verify` does not catch the omission.

<a id="I18-4"></a>

#### I18-4 — Server-only namespaces stay out of client components

A key consumed by a client component belongs in a namespace that is allowed in the client payload. Reading a key
from a server-only namespace (such as `shared.seo`) in a client component leaks that namespace into every page.

<a id="I18-5"></a>

#### I18-5 — The import graph decides a route's client keys

A server view importing a module that reaches many client components adds all of
their message keys to that route's client payload. Import the narrow module, and move leaf utilities shared by
products to `shared/`.

<a id="I18-6"></a>

#### I18-6 — Inject core or config numbers as ICU arguments

A number owned by core or config (a re-entry gap, a limit) is passed into the message as an ICU argument from the
exported constant, never typed into the catalog strings, where it silently drifts.

<a id="I18-7"></a>

#### I18-7 — Compare against `DEFAULT_LOCALE`, not the `'ko'` literal

Branches that mean "the default locale" use `locale === DEFAULT_LOCALE`. Leave a literal `'ko'` only where the code
really means Korean regardless of the default.

<a id="I18-8"></a>

#### I18-8 — Use `useAppPathname` for path matching

`usePathname()` returns the locale-prefixed path, so comparisons against locale-less constants fail for non-default
locales. Use `useAppPathname` (`shared/i18n/useAppPathname.ts`); raw `usePathname` imports are rejected by
`src/shared/i18n/__tests__/useAppPathname.test.ts`. A scoped test run can miss that guard, so include
`src/__tests__/guards` and the guard directories when you add a client component.

<a id="I18-9"></a>

#### I18-9 — Market and region text comes from context, and failure modes differ

Market and region names ('미국 증시'), and region-specific error text, are derived from a scope object or props, never
hardcoded in a component, or the component cannot serve another market. Messages also distinguish failure modes: a
"some data failed" message is not shown on the branch where no data rendered. Test fixtures carry a different scope
per market so reverting to a hardcoded string fails a test.

```typescript
// ❌
<div>미국 증시 데이터를 불러오지 못했습니다</div>

// ✅
<MarketDataErrorNotice variant={isTotalFailure ? 'total' : 'partial'} marketLabel={scope.marketLabel} />
```

A deliberately untranslated literal gets a comment saying why (see CM-6).

<a id="I18-10"></a>

#### I18-10 — Check for duplicate translator declarations after `i18n:extract --apply`

`scripts/i18n/extract.mjs --apply` inserts `const t = useTranslations('<ns>')` without checking whether the component
already declares a translator for that namespace. After every `--apply` run, grep each touched file for repeated
`useTranslations(` declarations of the same namespace and remove the extra one before running tests.

```typescript
// ❌ extractor output in a component that already had a translator
const t = useTranslations('emailReport');
const t = useTranslations('emailReport');

// ✅
const t = useTranslations('emailReport');
```

---
