# React Conventions

Client-side rules for hooks, components, effects, charts, styling, React Query and URL state. General coding rules live in [`CONVENTIONS.md`](CONVENTIONS.md), server-side rules in [`SERVER.md`](SERVER.md), test rules in [`TESTING.md`](TESTING.md).

## Rule IDs

Rules that are cited from code comments, reviews, or other docs carry a stable ID in the form `PREFIX-N`,
with an explicit anchor line directly above the heading. Cite them as `REACT.md#HK-1`.
IDs are never renumbered or reused; a new rule takes the highest existing number of its prefix + 1.
If a rule is deleted, delete its references in the same change.
`src/__tests__/guards/ruleReferences.test.ts` fails on any reference that does not resolve to an anchor.

| Prefix | Topic |
|---|---|
| `HK` | Custom hooks (declaration order, hook rules) |
| `CR` | Component rules (derived state, state machines, refs vs state) |
| `AX` | Accessibility (WAI-ARIA) |
| `EF` | `useEffect` rules |
| `LW` | Lightweight Charts |
| `TW` | Tailwind CSS |
| `RQ` | React Query and server state |

---

## Custom Hook Declaration Order

<a id="HK-1"></a>

#### HK-1 — Hook declaration order

Declare items inside a custom hook (and in components that call hooks) in the following order.
Include a step only when it is needed.

1. `useState` — local state
2. `useRef` — ref declarations
3. `useQuery` / `useMutation` / other custom hooks — server state, async operations, composed hooks
4. `useCallback` / `useMemo` — memoized values and functions, declared before any effect that depends on them
5. Derived variables — values computed from `mutation.data` etc.
6. Event handlers and functions — `handle*`, internal utilities
7. `useLayoutEffect` — runs before `useEffect`, place immediately before it
8. `useEffect` — group all effects here, separated by responsibility, listed in order
9. `return`

Why: every hook call must happen before derived values and handlers so that the reading order matches the dependency order and no hook ends up between computations.

**Documented exception.** A hook whose input is a derived value is declared immediately after that derived value, with a comment naming the dependency. Examples in the code: a query keyed on a derived `activeTimeframe`, or a tier-gated flag passed into a custom hook. Every other hook still precedes that derived variable.

**After moving part of a hook**, re-check that the remaining pieces (effects, handlers, `useCallback`s) are still in their slot. If effects depend on each other's run order, keep them together in that order and say why in a comment.

```typescript
// ❌ derived constant between hooks; useRef after derived
useQuery(...);
const rebuildQueue = rebuildQueueSrc;
useRef(...);

// ✅
useRef(...);
useQuery(...);
useCallback(...);
const rebuildQueue = rebuildQueueSrc;
```

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
│   └── ui/
│       └── StockChart.tsx
└── symbol-page/
    ├── hooks/
    │   ├── useAnalysis.ts
    │   └── useBars.ts
    └── ui/
        └── SymbolPageClient.tsx

# ❌ Incorrect — hooks or utils at the same level as components
src/widgets/chart/
├── StockChart.tsx
├── useChartData.ts     ← prohibited (must be in hooks/)
└── seriesDataUtils.ts  ← prohibited (must be in utils/)
```

**`hooks/` vs `utils/`**
- `hooks/`: files that call React hooks (`useState`, `useEffect`, `useQuery`, etc.)
- `utils/`: pure functions with no React hook calls — helper transformations, mappers, formatters

Do not define non-hook helpers (`sleep`, resolvers, label normalizers) inside a hook file: move them to `utils/` (or the slice's `lib/`) and test them there. Example: `sleep()` lives in `shared/lib/sleep.ts`, not inside a `use*` hook file.

---

## Custom Hook Rules

```typescript
// ✅ 'use client' — required at the top of every custom hook file
// Custom hooks in widgets/ always run on the client; declare 'use client' unconditionally.
'use client';

import { useState, useEffect } from 'react';
```

- **DOM event listeners go in a custom hook.** A `document`/`window` listener registered in a component's `useEffect` is extracted to a hook (`useOnClickOutside`, `useEscapeKey`, …).
- **Sibling hooks share a parameter shape.** Hooks in the same family accept the same optional properties; when one gains an option, check the others.
- **Hook messages describe the problem, not the UI layout.** Hooks are the logic layer and must not know where a control sits: `'Change the model and retry'`, not `'Pick another model from the dropdown above'`.
- **Side effects on a public entry point must not run on internal re-entry.** If `retry()` replays by calling `send()`, tracking placed inside `send()` fires twice per logical request. Split an untracked internal method from the public one that applies the side effect, then calls the internal method, and test the count across a retry.

<a id="HK-2"></a>

#### HK-2 — Async state machines are module-level functions with an explicit context

A `run`/`poll`/`retry` function defined inside a hook's `useCallback`/`useEffect` body inherits its closure (alive flag, retry counter, timers, `setState`) implicitly, so it cannot be tested alone. Extract it to a module-level async function taking an explicit context object (`RunContext { symbol, setState, isAlive, setRetryHandle }`); the hook becomes a thin coordinator that builds the context and dispatches.

```typescript
// ❌
const trigger = useCallback(() => {
    let alive = true;
    async function run() { /* uses alive, setState, retryHandle */ }
    void run();
}, [deps]);

// ✅
async function runAnalysis(ctx: RunContext, retryCount: number): Promise<void> { /* ctx.isAlive(), ctx.setState */ }
const trigger = useCallback(() => {
    let alive = true;
    const ctx: RunContext = { isAlive: () => alive, /* … */ };
    void runAnalysis(ctx, 0);
}, [deps]);
```

<a id="HK-3"></a>

#### HK-3 — Identity-scoped state is keyed by identity and reset when identity changes

State that belongs to one user (a pending decision, an open modal, a "tried once" or "already merged" flag) and
lives in a long-lived host (root layout, shared hook, module scope) carries the user id and is cleared when the id
changes or on logout. Otherwise a member switch or logout without a reload applies member A's state to member B.
Derive "is a member" in one exported place, not separately per consumer.

```tsx
// ❌ const [decision, setDecision] = useState<Decision | null>(null); // survives a member switch
// ✅ const [decision, setDecision] = useState<{ userId: string; value: Decision } | null>(null);
//    const active = decision?.userId === userId ? decision.value : null;
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

> **알려진 오탐: Next.js 경고 71007 ("Props must be serializable … `resetErrorBoundary` is a function")**
>
> `FallbackComponent`-형태 컴포넌트(`FallbackProps`를 받아 `onClick={resetErrorBoundary}`를 등록하는 컴포넌트)에 `'use client'`를 붙이면 Next.js 개발 서버 / TS 플러그인이 **71007** 경고를 낼 수 있다.
> 이는 **알려진 정적 분석 오탐**이다. `resetErrorBoundary`는 클라이언트 부모(예: `FinancialsAiSummary`, `CongressTrendSummary`)에서 생성되어 클라이언트 렌더 트리 안에서만 전달되므로, 실제 Server→Client 직렬화 경계를 넘지 않는다. 프로덕션 빌드·CI·런타임에는 영향이 없다.
>
> **경고를 없애기 위해 `'use client'`를 제거해서는 안 된다.** 제거하면 위 표의 두 가지 조건("이벤트 핸들러 등록", "FallbackComponent")을 동시에 위반하며, 해당 컴포넌트가 Server Component 컨텍스트에서 import될 경우 런타임 오류로 이어질 수 있다. `'use client'`를 유지하고 71007은 예상된 오탐으로 무시한다.

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

<a id="CR-1"></a>

#### CR-1 — Memoize props-derived objects; hoist static ones to module scope

Objects/maps derived from props or state (`inputClass` computed from a `size` prop, a lookup built from props) are wrapped in `useMemo` so their identity is stable. A value derived only from static inputs is not a hook concern at all: make it a module-level `const`.

```typescript
// ❌ empty-deps useMemo around a static call
const allowedModels = useMemo(() => getAllowedModels(DEFAULT_TIER), []);

// ✅
const ALLOWED_MODELS = getAllowedModels(DEFAULT_TIER);
```

<a id="CR-2"></a>

#### CR-2 — Non-render flags live in `useRef`; mount-time captures live in `useState`

- A flag that does not influence JSX output (`isPushed`, "already fired") is a `useRef`. `useState` would render, re-run effects, and immediately hit the guard.
- To "capture once at mount and never update", use `useState(() => initial)` and read the state in render. Reading `ref.current` during render is flagged by `react-hooks/refs` and is not what refs are for.
- If a ref and a lazy `useState` initializer start from the same value, they must share one source; if the ref is overwritten before it is read, initialize it to `null`.

```typescript
// ❌ .current read during render
const initialValueRef = useRef(initialValue);
const derived = isLoading || initialValueRef.current;

// ✅
const [capturedValue] = useState(initialValue);
```

#### Other props and state rules

- **Pass gating props explicitly.** A component that consumes a tier-gating prop (`isFreeUser` …) receives it from every call site; relying on a permissive default leaks free-tier surfaces (ads) to paid users.
- **Declared callback props must be invoked.** A callback prop that nothing calls is a latent bug; an unused prop is dead and is removed (and not passed through intermediate components — see `FF.md` 4-D).
- **Derive URLs from current local state, not initial props.** During an RSC pending transition the initial prop is stale: `updateUrl(activeTimeframe)`, not `updateUrl(initialTimeframe)`.
- **A `useState` lazy initializer runs once.** If the value must follow later prop changes, adjust during render (the previous-value comparison) or reset with a `key` — never "sync" it in an effect (see `REACT.md#EF-1`).
- **Multi-step forms let the user go back.** State derived only from a Server Action result cannot be undone; provide an explicit edit/back affordance that resets the step (for example remounting with a `key`) while keeping auth state.
- **No module-load timestamps for freshness.** `const LOADED_AT = Date.now()` is frozen for the whole SPA session; capture per mount with `useState(() => Date.now())`.
- **Unused layout classes**: check the parent's layout model before applying layout-specific utilities (a `grid-cols-*` on a flex container does nothing).

### Derived State & State Machines

- **UI state derived from geometry reacts to every geometry-changing cause.** A scroll-to-bottom button updated only from `scroll` never appears while streaming content grows `scrollHeight` with no scroll event. Add a `ResizeObserver` (subscription in the effect, `setState` in its callback) and share one `isAwayFromBottom(el)` helper between both paths.
- **Thresholds count only producers of the limited thing.** A "crowded labels" check that counts every overlay item hides labels that only patterns/Elliott emit; count the producers.
- **Reset paths cover forced transitions**, not only the intended one. A pending state cleared only when the target matches the current value gets stuck when a policy forces a different value (logout downgrades the tier mid-switch).
- **Latest intent wins.** An early return in a "latest intent" machine must still clear what the earlier intent set (start B, then click the current path A); test superseding sequences, not just single transitions.
- **Reversible state with an irreversible side effect records how to undo it** (the prior `scrollY`) and undoes it on every abandon path.
- **Compare the destination with the current location** before showing a pending/skeleton state for it.
- **Latch one-way signals that may fire before the consumer mounts** in a module store read with `useSyncExternalStore`; an event-only signal is lost.
- **Toggle predicates apply to every key the control governs.** A "shown" toggle that ignores hidden keys is a control that does nothing.
- **Cleanup clears only state the component itself set** (a menu blur must not clear a highlight another surface set).
- **When one half of a pair is removed, reset derived state on the survivor** (a stale width floor on the surviving chart).

### Accessibility (WAI-ARIA)

- **Do not override native roles.** Use `<div role="note">`, not `<p role="note">` or `<aside role="note">`.
- **No nested live regions with different urgency.** A `role="alert"` (assertive) inside `aria-live="polite"` produces competing announcements.
- **Announce state changes.** A pending navigation signalled only visually (`aria-busy`) is invisible to screen readers: add an always-mounted `role="status"` (sr-only) region whose text changes.
- **Dynamic validation uses a live region and `aria-invalid`.** `aria-describedby` pointing at a static hint announces nothing new; point it at `<div role="status" aria-live="polite" id="msg">{error || hint}</div>` and toggle `aria-invalid={!!error}`.
- **No `aria-hidden` on content users must read or re-enter** (an email to confirm, instructions, data fields). Hide only decorative or duplicated content.
- **Duplicated user-facing text is announced twice.** Render a message once; if a second copy is needed, hide it and reference the primary through `aria-describedby`.
- **Accordion triggers carry `aria-expanded`.**
- **`inert` for visually hidden interactives.** Controls moved off-screen with transform/opacity stay in the tab order; set `inert={isHidden}` in sync with visibility, but skip hiding while focus is inside the container so focus is not blurred mid-interaction.
- **Info icons are buttons, not `<span title>`.** Tooltips must be keyboard-reachable: a `<button aria-describedby>` pointing at a `role="tooltip"` element.
- **Nested interactives keep native keyboard activation.** A parent `role="button"` with `onKeyDown` guards with `if (e.target !== e.currentTarget) return;`, or it swallows Enter/Space of nested buttons.
- **Tablist:** roving `tabIndex` (`0` active, `-1` others) plus ArrowLeft/ArrowRight. **Listbox:** the same plus Up/Down/Home/End/Enter/Escape and real DOM `focus()` that follows the visual selection.

<a id="AX-1"></a>

#### AX-1 — An `aria-label` mirrors the visible heading or label

A landmark/section `aria-label` matches or closely mirrors its visible text. Two different names for one section confuse screen-reader users.

```tsx
// ❌
<section aria-label="위험 작업"><h2>위험존</h2></section>
// ✅
<section aria-label="위험존"><h2>위험존</h2></section>
```

<a id="AX-2"></a>

#### AX-2 — Every ARIA role has an accessible name

A `role` attribute needs `aria-label`, `aria-labelledby`, or accessible text content. A `tooltip` is connected from its trigger with `aria-describedby`; a `note` needs a descriptive `aria-label`.

```tsx
// ❌
<div role="tooltip">…</div>
// ✅
<div role="tooltip" id="tooltip-1">…</div>
<button aria-describedby="tooltip-1">…</button>
```

<a id="AX-3"></a>

#### AX-3 — Toggles and pending controls keep a stable name and keep focus

- A toggle button keeps one accessible name and expresses state only through `aria-pressed`; swapping `aria-label`
  between "add" and "remove" while also setting `aria-pressed` announces the state twice, inverted.
- A control that becomes pending while it holds focus uses `aria-disabled`, not `disabled`, so focus does not fall to
  `body` (Tab then escapes a modal). On success move focus to a persistent live region or the next target.
- An auto-dismissing toast that carries an action pauses its timer on hover and `focus-within`.

```tsx
// ❌
<button aria-label={on ? 'Remove' : 'Add'} aria-pressed={on} />
// ✅
<button aria-label="Watchlist" aria-pressed={on} />
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

<a id="EF-1"></a>

#### EF-1 — No `setState` in an effect body (`react-hooks/set-state-in-effect`)

oxlint 1.79+ traces calls through `useEffectEvent` and `useCallback` bodies, so wrapping `setState` in either does **not** escape the rule; the call is still attributed to the effect that scheduled it. Fix the cause instead, by what the effect is really doing:

- **Deriving state from a value that changed this render** (resolving a pending action once inputs settle): adjust state during render with the previous-value comparison, not in an effect.
- **Reading an external store the component does not own** (`localStorage`, `window.location.search`, `matchMedia`): `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`. `getServerSnapshot` returns the value the server/hydration render used, so no catch-up `setState` is needed after mount.
- **A one-shot intent flag**, chosen by where it is consumed:
  - resolvable from this render's values alone: keep it in `useState` and resolve it with a render-time adjustment;
  - must be consumed inside the effect that performs the side effect (navigation, callbacks): a `useRef`, plus a cheap tick counter if setting it must re-render. A ref is also the right "already fired" guard.
- **Effects stay for real external side effects** (`router.push`, DOM mutation, subscribing a DOM listener) — never as a way to move a `setState` one tick later. Inside a subscription callback (a `ResizeObserver` callback) calling `setState` is fine.
- **Mutations:** state that must reset on every mutate call site belongs in `useMutation`'s `onMutate`.
- In tests, when a new lint rule flags a helper, fix the root cause rather than suppressing: read Provider-created values with `renderHook(() => useX(), { wrapper: Provider })`.

```typescript
// ❌ setState synchronously in the effect body
useEffect(() => { setPollError(null); setAnalysisResult(null); mutate(...); }, [deps]);

// ❌ useEffectEvent does not escape the rule
const handleDerive = useEffectEvent(() => { setMessages(...); });
useEffect(() => { handleDerive(); }, [deps]);

// ✅ render-time adjustment, conditioned on a value that changed this render
if (isSubmitArmed && canResolve) { setIsSubmitArmed(false); setPendingNav(target); }

// ✅ external store with a hydration-safe snapshot
useSyncExternalStore(subscribePreference, getPreferenceSnapshot, getServerPreferenceSnapshot);
```

<a id="EF-2"></a>

#### EF-2 — Effect dependencies are complete; stable references are excluded

Every outer-scope value read in an effect body is in the dependency array; missing deps cause stale closures. Stable references are left out: refs and `useEffectEvent` functions. A callback **prop** that the effect calls must not sit in the deps (it changes identity each render and loops); wrap it with `useEffectEvent` and call that inside the effect. Never suppress `exhaustive-deps` with a lint comment — restructure instead.

```typescript
// ❌ slot is read but missing; snapToPoint (useEffectEvent) is stable and does not belong
useEffect(() => { /* slot, snapToPoint */ }, [isFullSnap, snapToPoint]);

// ✅
useEffect(() => { /* slot, snapToPoint */ }, [isFullSnap, slot]);
```

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

<a id="LW-1"></a>

#### LW-1 — Chart cleanup is guarded and ordered

- Unsubscribe listeners (`unsubscribeVisibleLogicalRangeChange`, `unsubscribeCrosshairMove`) **before** `chart.remove()`; otherwise the library throws "Object is disposed".
- Effect cleanup order is not deterministic (the chart may already be disposed). Wrap each cleanup call (unsubscribe, `detachCulling()`, series removal) in `try/catch` rather than re-reading `chartRef.current` inside cleanup, which trips `react-hooks/exhaustive-deps`.
- Cancel any pending `requestAnimationFrame` on unmount and when a paired chart is removed.
- When one chart of a synchronized pair is removed, reset derived state (for example a minimum-width floor) on the surviving chart.

```typescript
// ❌ ref read in cleanup, unguarded
chartRef.current?.unsubscribeCrosshairMove(handler);

// ✅
try { chart.unsubscribeCrosshairMove(handler); } catch { /* already disposed */ }
```

<a id="LW-2"></a>

#### LW-2 — Test the lifecycle of chart primitives

A primitive that wraps a library object with its own lifecycle (attach, update, detach) needs tests that verify each lifecycle method is called at the expected render boundary (mount, update, unmount). Without them render-order regressions go unseen.

Derived `className`/`style` objects in chart widgets are memoized per `REACT.md#CR-1`.

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

```

<a id="TW-1"></a>

#### TW-1 — Dynamic values go through CSS custom properties

Never use inline `style` for layout or styling. When a value is only known at runtime, set a CSS custom property and consume it from a Tailwind class (cast the style object to `CSSProperties`).

```tsx
// ❌
<div style={{ backgroundColor: getColor(state) }} />

// ✅
<div style={{ '--period-color': getColor(state) } as CSSProperties} className="bg-[var(--period-color)]" />
```

Related: compose classes with `cn()` only (never template literals or `+`, even for static multi-part constants: `const CARD = cn('px-4 py-2', 'bg-white')`); colour tokens come from the design system (`DESIGN.md#DS-1`).

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

### UI ↔ Data Access and Query State

<a id="RQ-1"></a>

#### RQ-1 — UI files reach data only through hooks

`.tsx` UI files (widgets, features, views) must not import entity internals (`lib/` business logic, `api/`). Hook
files (`hooks/*.ts`) connect Server Actions from `entities/*/actions/` to `queryFn`/`mutationFn`/`useActionState`,
and the UI consumes the hook. Pure constants and types are imported from their defining file. App-layer RSC files may
import an entity's `api.ts` directly.

```typescript
// ❌ LoginForm.tsx
import { loginUser } from '@/entities/user/lib/loginUser';

// ✅ LoginForm.tsx
import { useLoginForm } from '../hooks/useLoginForm';
```

<a id="RQ-2"></a>

#### RQ-2 — Hooks import types from the defining type module

A hook file imports types from the slice's `model.ts`/`types.ts` or `@y0ngha/siglens-core`, not from an
implementation module (DB or API code); importing a type from there drags that module's import chain into the client.

<a id="RQ-3"></a>

#### RQ-3 — Derive "still unknown" from `isPending`, not from `data === undefined`

A failed query leaves `data` undefined forever, so a loading flag derived from `data` blocks everything that waits
on it. Hooks that gate the same request share one definition of "identity is known" (`!isPending`) instead of each
deriving it differently.

<a id="RQ-4"></a>

#### RQ-4 — Do not make server seeds non-refetching without replacing what refetching fixed

A seed marked never-stale removes the client's only self-healing path for a degraded (fallback) seed. Before
changing staleness, list what the refetch used to repair and keep a replacement for it. Test seeds through
`dehydrate` -> `hydrate`, the path production takes, not by writing directly to the cache.

---

## URL State Rules

UI state that should survive page refresh or be shareable via link must be reflected in the URL.

### Query Parameter — Timeframe

The selected timeframe is synchronized to the `tf` query parameter.

**Reading (client):** to keep `[symbol]` routes ISR-cacheable, `tf` is read on the **client**, never on the
server (a server `searchParams` read forces dynamic rendering and disables ISR). Read it with
`useUrlSearchParam` (`shared/hooks/useUrlSearchParam.ts`), **not** `useSearchParams` — Next's
`useSearchParams` CSR-bails-out the subtree up to the nearest Suspense boundary, so the widget ships as a
skeleton in the server HTML. `useUrlSearchParam` is a `useSyncExternalStore` reader whose server snapshot is
`null`: the server and hydration renders use the default (`DEFAULT_TIMEFRAME`), and the URL value applies
right after hydration. The chart page uses `useTimeframeChange`, `OverallContent` uses `useTimeframeFromUrl`,
the `/market` sector panel uses `useSectorSignalState`. The canonical URL excludes `tf`, so the client-only read
does not affect SEO/indexing.

**User picks vs. URL:** a pick lives in local state (`usePickUntilPopstate`) and wins over the URL, because
the URL write (`history.replaceState`) does not notify subscribers. The pick is dropped on the next
`popstate`, so Back/Forward follows the URL again. On the chart, URL-driven changes (deep link, tier hydration,
popstate) go through `useDeferredValue` so the previous chart stays up instead of flashing the Suspense
skeleton; user picks go through `startTransition`.

**Writing (client):** `useTimeframeChange` calls `window.history.replaceState(...?tf=<value>)` inside
`startTransition` whenever the user changes the timeframe (no RSC round trip — the server ignores `tf`).

**Validation:** `isValidTimeframe()` is exported by `@y0ngha/siglens-core` and uses the `TIMEFRAMES` constant
as the source of truth for valid values. Never validate against hardcoded string literals at the call site.

```typescript
// ✅ Client reads timeframe from URL (keeps the route static/ISR, no CSR bailout)
const tfParam = useUrlSearchParam('tf');
const timeframe = isValidTimeframe(tfParam) ? tfParam : DEFAULT_TIMEFRAME;

// ❌ useSearchParams — CSR-bails-out the subtree; the server HTML gets only the Suspense fallback
// const tfParam = useSearchParams().get('tf');

// ❌ Server reading searchParams.tf — forces dynamic rendering, breaks ISR
// const { tf } = await searchParams;

// ✅ Client updates URL on change (inside startTransition)
window.history.replaceState(null, '', toLocalePath(`/${symbol}?tf=${nextTimeframe}`));

// ❌ Hardcoded default ignoring URL param
const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
```
