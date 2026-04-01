# Conventions

## Coding Paradigm

Siglens follows **Declarative** and **Functional Programming** paradigms.

### Declarative Code

Focus on "what" rather than "how".

```typescript
// ❌ Imperative
const result = [];
for (let i = 0; i < closes.length; i++) {
    if (closes[i] > 0) result.push(closes[i] * 2);
}

// ✅ Declarative
const result = closes.filter(c => c > 0).map(c => c * 2);
```

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

// ✅ Immutability
// ❌ bars.push(newBar)       ✅ [...bars, newBar]
// ❌ bar.close = 100         ✅ { ...bar, close: 100 }
```

### Priority by Layer

```
domain/         Functional required — pure functions, immutability, higher-order functions
infrastructure/ Functional recommended — separate internal logic into pure functions
components/     Declarative required — replace conditionals with object maps or component splits
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

// ✅ Return types must be explicitly declared on domain functions
function calculateRSI(closes: number[], period: number): (number | null)[] { ... }

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

// ✅ No hardcoded literals — extract to constants
// ❌ period = 14
// ✅ period = RSI_DEFAULT_PERIOD  (domain/indicators/constants.ts)
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

## Component Folder Structure

Custom hooks must always be placed in a `hooks/` subfolder.
Pure utility functions (non-hook helpers) must always be placed in a `utils/` subfolder.
Never mix component files, hook files, or utility files at the same directory level.

```
# ✅ Correct structure
src/components/
├── chart/
│   ├── hooks/
│   │   ├── useBollingerOverlay.ts
│   │   └── useChartData.ts
│   ├── utils/
│   │   └── seriesDataUtils.ts
│   └── StockChart.tsx
└── symbol-page/
    ├── hooks/
    │   ├── useAnalysis.ts
    │   └── useBars.ts
    └── SymbolPageClient.tsx

# ❌ Incorrect — hooks or utils at the same level as components
src/components/chart/
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
// Custom hooks in components/ always run on the client; declare 'use client' unconditionally.
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
| Uses custom hooks from `components/*/hooks/` | `useBars`, `useAnalysis`, `useTimeframeChange` |
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
```

---

## Domain Function Rules

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
src/__tests__/domain/indicators/rsi.test.ts
src/__tests__/infrastructure/market/alpaca.test.ts
```

### Coverage Targets

```
domain/         100% (필수)
infrastructure/ 100% (필수)
components/     optional
app/            optional
```

`domain/` and `infrastructure/` require 100% coverage.
`components/` and `app/` are not required to have tests, but writing tests for them is allowed.
Pure utility functions and other units that benefit from testing may be freely tested.

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
jest.mock('node-fetch');
import { mockAlpacaBarsResponse } from '@/__tests__/fixtures/alpaca';
```

---

## Import Path Rules

```typescript
// ✅ Use path aliases
import { calculateRSI } from '@/domain/indicators/rsi';

// ❌ No relative paths
import { calculateRSI } from '../../../domain/indicators/rsi';
```

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
✅ Use only inside components/chart/
❌ No imports from app/, domain/, or infrastructure/
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

// ✅ Arbitrary CSS properties — use bracket notation for non-utility CSS
<html className="[color-scheme:dark]">   // ✅ correct
<html style={{ colorScheme: 'dark' }}>  // ❌ inline style (prohibited)
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

```
domain/         No external library imports — pure TypeScript functions only
infrastructure/ May import from domain only
components/     May import from domain and lib
                Component files (.tsx): no direct imports from infrastructure
                Hook files (hooks/): may import fetch functions from infrastructure
                  → only for connecting queryFn/mutationFn in useQuery/useMutation
app/            May import from infrastructure, domain, and lib
lib/            External UI utility wrappers (clsx, tailwind-merge, etc.)
                For wrapping external packages that cannot go in domain
                Pure functions only — no side effects
                May include React Query key factories (QUERY_KEYS etc.)
                React Query config files shared across the app may also live in lib/
                May import domain types (e.g. Timeframe) for type-safe key factories
```

---

## Iteration Protocol

Use JavaScript's iteration protocol (`Symbol.iterator`) and generators to compose data pipelines.

### When to Use

| Situation | Approach |
|---|---|
| Applying multiple transforms in a single pass over an array | Generator pipeline |
| Making a custom data structure consumable with `for...of` | Implement `Symbol.iterator` |
| Exposing domain data as an iterable to external consumers | `Iterable` interface |
| Processing thousands of Bar records step by step | Lazy evaluation (see section below) |

### Symbol.iterator — Custom Iterables

```typescript
// ✅ Custom iterable — expose results as an iterable from pure domain/indicators/ functions
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
// ✅ Express a sliding window as a generator — used purely in the domain layer
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
// ❌ Do not define generators directly in infrastructure/ or components/
//    Generator-based iterables belong in domain/ pure functions only.

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
// ✅ domain/indicators/utils.ts — reusable lazy utilities
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
domain/         Lazy pipeline definitions allowed (pure generator functions)
                Materialize (spread / Array.from) only as the last step inside the function
infrastructure/ Call domain generator functions and consume their results
components/     Do not define lazy pipelines directly
                Receive already-materialized arrays via domain functions
```

---

## React Query and Server State Rules

Manage server state on the client using React Query.
Fetch logic must always live in the infrastructure layer.
Component hooks are responsible only for connecting infrastructure fetch functions
to `useQuery`/`useMutation` as `queryFn`/`mutationFn`.

```typescript
// ✅ infrastructure layer — fetch logic
// src/infrastructure/market/barsApi.ts
export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe,
    signal?: AbortSignal
): Promise<BarsData> {
    const res = await fetch(`/api/bars?symbol=${symbol}&timeframe=${timeframe}`);
    // ...
}

// ✅ component hook — connects queryFn only
// src/components/symbol-page/hooks/useBars.ts
const { data } = useQuery({
    queryKey: QUERY_KEYS.bars(symbol, timeframe),
    queryFn: ({ signal }) => fetchBarsWithIndicators(symbol, timeframe, signal),
});

// ❌ No inline fetch logic inside component hooks
const { data: barsData } = useQuery({
    queryKey: QUERY_KEYS.bars(symbol, timeframe),
    queryFn: async ({ signal }) => {
        const res = await fetch(`/api/bars?symbol=${symbol}`); // prohibited
        return res.json();
    },
});
```
