# Components Layer Rules

## Core Principle

React Client Components layer. Handles UI rendering and user interactions.

---

## Dependency Rules

```
✅ Allowed: domain, lib imports
❌ Forbidden: direct infrastructure imports (in .tsx component files)
⚠️ Exception: hooks/ files may import fetch functions from infrastructure only
              → Limited to queryFn/mutationFn connection purpose
              → Type imports must be from @/domain/types
```

---

## Component Rules

- All files must have `'use client'` directive
- Use `export function` (named function declaration)
- No `export default`, `React.FC`, or `React.memo()`
- Define Props inline (no separate type alias needed)

```typescript
'use client';

// ✅ Correct
export function StockChart({ symbol, bars }: { symbol: string; bars: Bar[] }) { ... }

// ❌ Forbidden
export default function StockChart(...) { ... }
const StockChart: React.FC<Props> = (...) => { ... }
export default React.memo(StockChart);
```

---

## Folder Structure

```
components/
├── analysis/          # Analysis panel
├── chart/             # Chart
│   └── hooks/         # Chart custom hooks
├── search/            # Symbol search
└── symbol-page/       # Symbol page composition
    └── hooks/         # Symbol page custom hooks
```

Custom hooks must be placed in the `hooks/` subfolder within the relevant component folder.

---

## Custom Hook Rules

### Declaration Order (must follow)

```typescript
export function useChart(symbol: string) {
  // 1. External hooks (useQuery, useRouter, useParams, etc.)
  // 2. State (useState)
  // 3. Derived values (useMemo)
  // 4. Callbacks (useCallback)
  // 5. Effects (useEffect)
  // 6. Return
}
```

### Principles

- One hook = one concern (SRP)
- Custom hooks may call other custom hooks, max 2 levels deep
- One side effect per `useEffect`

```typescript
// ✅ Separate
useEffect(() => { /* resize event */ }, []);
useEffect(() => { /* data sync */ }, [data]);

// ❌ Do not combine
useEffect(() => {
  // resize event + data sync in one place
}, [data]);
```

---

## React Query Rules

- Key factories (`QUERY_KEYS`) are defined in `lib/`
- Call infrastructure fetch functions in `queryFn`/`mutationFn`
- Never mix server state and client state
- Configure `staleTime`, `gcTime` based on data characteristics

---

## Lightweight Charts Rules

- Chart instances (`IChartApi`, `ISeriesApi`) go in `useRef`
- Chart creation/destruction via `useEffect` + cleanup function
- Overlays (indicator lines) managed in separate hooks
- Resize handling: use `ResizeObserver`

---

## Design Rules

See `docs/DESIGN.md` for the full color system, indicator line colors, and Tailwind CSS rules.

---

## Common Mistakes

- Using `React.FC` → use inline Props type
- Using `export default` → use `export function`
- Direct infrastructure import → access via hooks/
- Missing `'use client'` → required in all component files
- Multiple side effects in one `useEffect` → separate them
- Storing `ISeriesApi` in useState → use useRef
- Using deprecated `addLineSeries()` → use `addSeries(LineSeries)`
- Ignoring ESLint `react-hooks/exhaustive-deps` → specify deps array correctly
