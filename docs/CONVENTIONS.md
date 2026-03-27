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

Group declarations by kind. Use comments to mark boundaries between groups.

```typescript
export function useExample(props: ExampleOptions): ExampleResult {
    // Refs
    const ref = useRef<HTMLDivElement>(null);

    // Query hooks
    const mutation = useMutation({ mutationFn: postSomething });

    // Derived variables
    const value = mutation.data ?? initialValue;
    const error = mutation.error?.message ?? null;

    // Handlers
    const handleSubmit = (): void => {
        mutation.mutate(ref.current);
    };

    // Effects
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

Custom hooks inside a component folder must always be placed in a `hooks/` subfolder.
Never mix component files and hook files at the same directory level.

```
# ✅ Correct structure
src/components/
├── chart/
│   ├── hooks/
│   │   ├── useBollingerOverlay.ts
│   │   └── useChartData.ts
│   └── StockChart.tsx
└── symbol-page/
    ├── hooks/
    │   ├── useAnalysis.ts
    │   └── useBars.ts
    └── SymbolPageClient.tsx

# ❌ Incorrect structure — hooks at the same level as components
src/components/symbol-page/
├── SymbolPageClient.tsx
├── useAnalysis.ts  ← prohibited
└── useBars.ts      ← prohibited
```

---

## Component Rules

```typescript
// ✅ 'use client' — at the top of the file, required when using useState/useEffect
'use client';

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
domain/         100%
infrastructure/ 100%
components/     excluded
app/            excluded
```

**`components/` and `app/` are intentionally excluded from test coverage.**
Do not request or write test files for files under `components/` or `app/`.
UI rendering logic is verified manually or via integration tests, not unit tests.
Test files exist only for `domain/` and `infrastructure/`.

### Test Structure

```typescript
// ✅ describe → describe(context) → it
describe('calculateRSI', () => {
    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => {
            expect(calculateRSI([100, 101], 14)).toEqual([null, null]);
        });
    });
    describe('정상 입력일 때', () => {
        it('처음 period - 1개의 값은 null이다', () => { ... });
        it('0 ~ 100 사이 값을 반환한다', () => { ... });
    });
});
```

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
