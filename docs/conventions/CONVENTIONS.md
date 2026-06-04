# Conventions

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

---

## Custom Hook Declaration Order

Declare items inside a custom hook in the following order.
Include `useState` only when local state is needed; omit otherwise.

1. `useState` — local state (if needed)
2. `useRef` — ref declarations
3. `useQuery` / `useMutation` etc. — server state and async operations
4. Derived variables — values computed from `mutation.data` etc.
5. Event handlers and functions — `handle*`, internal utilities
6. `useLayoutEffect` — runs before `useEffect`, place immediately before it (if needed)
7. `useEffect` — group all effects here, separated by responsibility, listed in order
8. `return`

```typescript
export function useExample(props: ExampleOptions): ExampleResult {
    const ref = useRef<HTMLDivElement>(null);

    const mutation = useMutation({ mutationFn: postSomething });

    const value = mutation.data ?? initialValue;
    const error = mutation.error?.message ?? null;

    const handleSubmit = (): void => {
        mutation.mutate(ref.current);
    };

    useLayoutEffect(() => {
        ref.current = someValue;
    });

    useEffect(() => {
        mutation.reset();
    }, [dep, mutation]);

    return { value, error, handleSubmit };
}
```

---

## Widget / Feature / Entity Folder Structure

Custom hooks must always be placed in a `hooks/` subfolder.
Pure utility functions (non-hook helpers) must always be placed in a `utils/` subfolder.
Never mix component files, hook files, or utility files at the same directory level.

```
# ✅ Correct structure
src/widgets/
├── chart/
│   ├── hooks/
│   │   ├── useBollingerOverlay.ts
│   │   └── useChartData.ts
│   ├── utils/
│   │   └── seriesDataUtils.ts
│   ├── ui/
│   │   └── StockChart.tsx
│   └── index.ts
└── symbol-page/
    ├── hooks/
    │   ├── useAnalysis.ts
    │   └── useBars.ts
    ├── ui/
    │   └── SymbolPageClient.tsx
    └── index.ts

# ❌ Incorrect — hooks or utils at the same level as components
src/widgets/chart/
├── StockChart.tsx
├── useChartData.ts     ← prohibited (must be in hooks/)
└── seriesDataUtils.ts  ← prohibited (must be in utils/)
```

**`hooks/` vs `utils/`**
- `hooks/`: files that call React hooks (`useState`, `useEffect`, `useQuery`, etc.)
- `utils/`: pure functions with no React hook calls — helper transformations, mappers, formatters

---

## Custom Hook Rules

```typescript
// ✅ 'use client' — required at the top of every custom hook file
// Custom hooks in widgets/ always run on the client; declare 'use client' unconditionally.
'use client';

import { useState, useEffect } from 'react';
```

---

## Component Rules

### 'use client' Declaration

Add `'use client'` **only** when the component meets at least one of the following conditions:

| Condition | Examples |
|---|---|
| Uses React state or lifecycle hooks | `useState`, `useReducer`, `useContext`, `useEffect`, `useLayoutEffect` |
| Uses custom hooks from `widgets/*/hooks/` or `features/*/hooks/` | `useBars`, `useAnalysis`, `useTimeframeChange` |
| Registers event handlers | `onClick`, `onChange`, `onSubmit` |
| Accesses browser APIs | `window`, `document`, `localStorage` |
| Is a `FallbackComponent` for `ErrorBoundary` | receives `resetErrorBoundary` and calls it |

Do **not** add `'use client'` to components that only render static JSX with no interactivity.
Keeping components as Server Components by default minimizes the client bundle.

```typescript
// ✅ Required — uses useState and event handler
'use client';
export function TimeframeSelector({ onChange }: TimeframeSelectorProps) {
    const [selected, setSelected] = useState<Timeframe>('1Day');
    // ...
}

// ✅ Required — FallbackComponent receives resetErrorBoundary (client-only callback)
'use client';
export function ChartErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return <button onClick={resetErrorBoundary}>다시 시도</button>;
}

// ✅ Not required — pure static JSX, no hooks or handlers
// ChartSkeleton renders a loading placeholder with no interactivity
export function ChartSkeleton() {
    return <div className="animate-pulse bg-gray-800 rounded" />;
}
```

### RSC → Client Boundary: Minimize Serialized Data

When a Server Component passes data to a `'use client'` component, only the props cross the boundary as serialized JSON embedded in the HTML response. Pass only the fields the client component actually uses.

```typescript
// ❌ Serializes all 50 fields of User
async function Page() {
    const user = await fetchUser();
    return <Profile user={user} />;
}
'use client'
function Profile({ user }: { user: User }) {
    return <div>{user.name}</div>;
}

// ✅ Serializes only the one field used
async function Page() {
    const user = await fetchUser();
    return <Profile name={user.name} />;
}
'use client'
function Profile({ name }: { name: string }) {
    return <div>{name}</div>;
}
```

### Other Component Rules

```typescript
// ✅ Define Props interface directly above the component
interface StockChartProps { initialBars: Bar[]; symbol: string; }
export function StockChart({ initialBars, symbol }: StockChartProps) { ... }

// ❌ No inline prop types
export function StockChart({ initialBars, symbol }: { initialBars: Bar[]; symbol: string }) { ... }

// ✅ Named exports (only page/layout use default export)
export function StockChart() {}
export default function Page() {}

// ✅ new Date() in Server Component → hydration mismatch
// Extract into a 'use client' component or add suppressHydrationWarning

// ✅ No side effects inside setState updater functions
// Updaters run twice in React Strict Mode; side effects must be placed outside
// ❌ setState(prev => { doSideEffect(); return newValue; })
// ✅ doSideEffect(); setState(prev => newValue);

// ✅ Use functional setState to avoid stale closures
// ❌ const next = new Set(visiblePatterns); setVisiblePatterns(next);
// ✅ setVisiblePatterns(prev => { const next = new Set(prev); ...; return next; });

// ✅ Never nest interactive elements (HTML spec)
// ❌ <button><button>inner</button></button>
// ❌ <a href="..."><button>click</button></a>
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

---

## Test Rules

### File Locations

```
# FSD 슬라이스 colocated
src/entities/user/__tests__/lib/loginUser.test.ts
src/features/auth-login/__tests__/actions/loginAction.test.ts
src/shared/lib/__tests__/cn.test.ts

# 공유 fixture/utility (여러 테스트에서 사용)
src/__tests__/fixtures/jsonResponse.ts
src/__tests__/utils/makeFormData.ts
```

### Coverage Targets

```
entities/       90%
features/       90%
shared/         90%
widgets/        90%
app/            90%
src/proxy.ts    90%
```

The project target is 90% coverage across all measured FSD layers.
Current Vitest coverage includes `src/entities/**`, `src/features/**`, `src/shared/**`,
`src/widgets/**`, `src/app/**`, and `src/proxy.ts`, excluding declaration files,
barrel files, type/model-only files, and test utilities.

UI layers are part of the coverage target. Prefer unit tests for pure view utilities,
hook tests for stateful UI behavior, component tests for user-visible states, and
integration tests for critical cross-layer flows.

### Test Structure

```typescript
// ✅ 2 levels: describe → it (simple cases)
describe('formatVolume', () => {
    it('returns "1.2M" for 1200000', () => { ... });
    it('returns "0" for 0', () => { ... });
});

// ✅ 3 levels: describe → describe(context) → it
describe('calculateRSI', () => {
    describe('when input length is less than period', () => {
        it('returns an all-null array', () => {
            expect(calculateRSI([100, 101], 14)).toEqual([null, null]);
        });
    });
    describe('when input is valid', () => {
        it('returns null for the first period - 1 values', () => { ... });
        it('returns values between 0 and 100', () => { ... });
    });
});

// ✅ 4 levels: describe(module) → describe(function) → describe(context) → it
describe('prompt', () => {
    describe('buildAnalysisPrompt', () => {
        describe('current market section', () => {
            it('includes "No data available" when bars is empty', () => { ... });
        });
    });
});

// ✅ 5 levels: for complex modules requiring fine-grained context separation
describe('candle-detection', () => {
    describe('detectCandlePatternEntries', () => {
        describe('multi-candle pattern detection', () => {
            describe('when a 3-bar pattern exists', () => {
                it('excludes single patterns on involved bars', () => { ... });
            });
        });
    });
});
```

Test structure allows **2 to 5 levels**. Choose the appropriate depth based on module complexity.
6+ levels are prohibited — merge context into describe text to reduce nesting.

### Required Test Cases for Period-Based Indicators

| Case | it description |
|------|----------------|
| Empty array | 빈 배열을 반환한다 |
| Input shorter than period | 전부 null인 배열을 반환한다 |
| Initial null range | 처음 period - 1개의 값은 null이다 |
| Valid value range | period번째 이후 값은 null이 아닌 숫자다 |
| Calculation accuracy | 첫 번째 값이 명세와 일치한다 |

### External API Mocking

```typescript
vi.mock('@/shared/api/fmp/httpClient');

const mockFmpBarsResponse = [{ date: '2026-05-25', open: 100, high: 101, low: 99, close: 100.5, volume: 1000 }];
```

---

## Import Path Rules

```typescript
// ✅ Use path aliases
import { cn } from '@/shared/lib/cn';
import { useBars } from '@/widgets/symbol-page/hooks/useBars';

// ❌ No relative paths
import { cn } from '../../../shared/lib/cn';
```

### FSD Slice Internal Imports

FSD 슬라이스 내부에서 다른 segment를 참조할 때(예: `features/auth/ui/LoginForm.tsx` → `features/auth/model/types.ts`):
- **relative import 사용** (`../model/types` 형태)
- `no-restricted-imports`는 path alias 기반(`@/features/*/model/*`)으로 차단하므로, **같은 슬라이스 내에서도 `@/` 절대경로로 internal segment에 접근하면 lint 에러**
- 같은 슬라이스 내부는 반드시 relative import 사용

```typescript
// ✅ 같은 slice 내 — relative import
// src/features/auth/ui/LoginForm.tsx
import type { AuthFormState } from '../model/types';

// ❌ 같은 slice 내라도 절대경로 internal path — no-restricted-imports 위반
// src/features/auth/ui/LoginForm.tsx
import type { AuthFormState } from '@/features/auth/model/types'; // 차단됨

// ❌ 다른 slice의 internal path — no-restricted-imports 위반
// src/features/auth/ui/LoginForm.tsx
import type { ChatState } from '@/features/symbol-chat/model/types'; // 차단됨

// ✅ 다른 slice는 public API(barrel)로만 접근
import { useChatActions } from '@/features/symbol-chat';
```

> "Import Path Rules"의 path-alias 규칙은 **cross-slice** import 기준이며, 같은 슬라이스 내부 segment 간 참조는 relative import를 사용한다.

---

## useEffect Side Effect Isolation

Separate side effects inside `useEffect` by responsibility.
Never mix initialization logic and data synchronization logic in a single `useEffect`.

```typescript
// ❌ Initialization + data setup mixed in one useEffect
useEffect(() => {
    const chart = createChart(containerRef.current, { ... });
    const series = chart.addSeries(CandlestickSeries, { ... });
    series.setData(bars); // recreates the entire chart on every data change
    return () => { chart.remove(); };
}, [bars]);

// ✅ Initialization ([]): runs once on mount, stores instance in ref
useEffect(() => {
    const chart = createChart(containerRef.current, { ... });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, { ... });
    return () => {
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
    };
}, []);

// ✅ Data sync ([deps]): reuses instance on data change
useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(mappedBars);
    chartRef.current.timeScale().fitContent();
}, [bars]);
```

**Principles**
- Separate instance creation/destruction (`[]`) from data synchronization (`[deps]`) into distinct `useEffect` calls
- Reset refs to `null` in the initialization cleanup to prevent the data effect from accessing a stale instance

---

## Lightweight Charts Rules

Official docs: https://tradingview.github.io/lightweight-charts/docs

```
✅ Use only inside widgets/chart/
❌ No imports from app/ or entities/api/
```

```typescript
// ✅ Chart initialization + cleanup required
useEffect(() => {
    const chart = createChart(containerRef.current, { ... });
    const series = chart.addSeries(CandlestickSeries);
    series.setData(data);
    return () => { chart.remove(); };
}, []);

// ✅ Volume, RSI etc. go in separate panes
chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, 1);
chart.addSeries(LineSeries, {}, 2);

// ✅ Convert null values to WhitespaceData
// ❌ { time: '2024-01-01', value: null }
// ✅ { time: '2024-01-01' }

// ✅ Prepend historical data
candleSeries.setData([...newOlderBars, ...existingBars]);
```

---

## Tailwind CSS Rules

```typescript
// ✅ Use Tailwind classes
<div className="flex items-center gap-4 p-4 bg-gray-900">

// ❌ No inline styles
<div style={{ display: 'flex', padding: '16px' }}>

// ✅ Use cn utility for conditional classes
<div className={cn('base-class', isActive && 'active-class')}>

// ✅ Tailwind v4 supports numeric flex utilities directly — no arbitrary value needed
<div className="flex-3">     // ✅ correct — Tailwind v4 generates flex: 3
<div className="flex-[3]">   // ❌ unnecessary arbitrary syntax

// ✅ Tailwind v4 utility for color scheme — use the built-in utility class
<html className="scheme-dark">          // ✅ correct — Tailwind v4 utility
<html className="[color-scheme:dark]">  // ❌ unnecessary arbitrary syntax in Tailwind v4
<html style={{ colorScheme: 'dark' }}>  // ❌ inline style (prohibited)

// ✅ Dynamic runtime values → CSS custom properties
// ❌ style={{ width: `${px}px` }}
// ✅ style={{ '--w': `${px}px` }} className="md:w-[var(--w)]"
```

---

## ESLint Rules

Never use `eslint-disable` or `eslint-disable-next-line` comments.
When a rule produces a warning, fix the root cause in the code rather than suppressing the rule.

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

## HTTP Status Codes

```typescript
// ✅ Use built-in node:http2 constants — no external packages needed
import { constants } from 'node:http2';
const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_NOT_FOUND } = constants;

// ❌ No local constant redefinition — node:http2 already provides standard constants
const HTTP_STATUS = { BAD_REQUEST: 400 };

// ❌ No hardcoded literals
return NextResponse.json({ error: '...' }, { status: 400 });
```

---

## Layer Dependency Rules

`→ see docs/architecture/ARCHITECTURE.md` for the authoritative layer dependency rules and folder structure.

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

## React Query and Server State Rules

Manage server state on the client using React Query.
Fetch logic must live in entity/feature slices (api.ts or actions/).
Widget hooks are responsible only for connecting Server Actions or entity fetch functions
to `useQuery`/`useMutation` as `queryFn`/`mutationFn`.

```typescript
// ✅ entity action — Server Action
// src/entities/bars/actions/getBarsAction.ts
'use server';
export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe
): Promise<BarsData> {
    // FMP 호출 + @y0ngha/siglens-core indicator 계산
    // ...
}

// ✅ widget hook — connects queryFn only
// src/widgets/symbol-page/hooks/useBars.ts
const { data } = useQuery({
    queryKey: QUERY_KEYS.bars(symbol, timeframe),
    queryFn: () => getBarsAction(symbol, timeframe),
});

// ❌ No inline fetch logic inside widget hooks
const { data: barsData } = useQuery({
    queryKey: QUERY_KEYS.bars(symbol, timeframe),
    queryFn: async ({ signal }) => {
        const res = await fetch(`/api/bars?symbol=${symbol}`); // prohibited
        return res.json();
    },
});
```

---

## URL State Rules

UI state that should survive page refresh or be shareable via link must be reflected in the URL.

### Query Parameter — Timeframe

The selected timeframe is synchronized to the `tf` query parameter.

**Reading (client):** to keep `[symbol]` routes ISR-cacheable, `tf` is read on the **client**, never on the
server (a server `searchParams` read forces dynamic rendering and disables ISR). The chart page uses
`useTimeframeChange` (`useSearchParams().get('tf')`); `OverallContent` reads it inline the same way. Server
components seed `DEFAULT_TIMEFRAME` and let the client reconcile to the URL value on mount. The canonical URL
excludes `tf`, so the client-only read does not affect SEO/indexing.

**Writing (client):** `useTimeframeChange` calls `router.replace(...?tf=<value>, { scroll: false })`
inside `startTransition` whenever the user changes the timeframe.

**Validation:** `isValidTimeframe()` is exported by `@y0ngha/siglens-core` and uses the `TIMEFRAMES` constant
as the source of truth for valid values. Never validate against hardcoded string literals at the call site.

```typescript
// ✅ Client reads timeframe from URL (keeps the route static/ISR)
const tfParam = useSearchParams().get('tf');
const timeframe = isValidTimeframe(tfParam) ? tfParam : DEFAULT_TIMEFRAME;

// ❌ Server reading searchParams.tf — forces dynamic rendering, breaks ISR
// const { tf } = await searchParams;

// ✅ Client updates URL on change (inside startTransition)
router.replace(`/${symbol}?tf=${nextTimeframe}`, { scroll: false });

// ❌ Hardcoded default ignoring URL param
const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
```
