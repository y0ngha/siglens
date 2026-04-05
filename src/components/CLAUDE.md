# Components Layer Rules

## Core Principle

React Client Components layer. Handles UI rendering and user interactions.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.
**Hook order:** `→ see docs/CONVENTIONS.md` "Custom Hook Declaration Order" section.
**Design:** `→ see docs/DESIGN.md` for colors, Tailwind, and chart constants.

---

## Component Rules

- `'use client'` required only when using hooks, event handlers, or browser APIs
- Use `export function` (named function declaration)
- No `export default`, `React.FC`, or `React.memo()`
- Define Props interface directly above the component (not inline)

---

## Folder Structure

```
components/
├── analysis/          # Analysis panel
├── chart/             # Chart
│   ├── hooks/         # Chart custom hooks
│   └── utils/         # Chart pure utility functions
├── search/            # Symbol search
└── symbol-page/       # Symbol page composition
    ├── hooks/         # Symbol page custom hooks
    └── utils/         # Symbol page pure utilities
```

Custom hooks → `hooks/` subfolder. Pure utility functions → `utils/` subfolder.

---

## React Query Rules

- Key factories (`QUERY_KEYS`) are defined in `lib/`
- Call infrastructure fetch functions in `queryFn`/`mutationFn`
- Never mix server state and client state

---

## Lightweight Charts Rules

- Chart instances (`IChartApi`, `ISeriesApi`) go in `useRef`
- Chart creation/destruction via `useEffect` + cleanup function
- Overlays (indicator lines) managed in separate hooks
- Resize handling: use `ResizeObserver`
