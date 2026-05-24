# Components Layer Rules

## Core Principle

React Client Components layer. Handles UI rendering and user interactions.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.
**Hook order:** `→ see docs/CONVENTIONS.md` "Custom Hook Declaration Order" section.
**Design:** `→ see docs/DESIGN.md` for colors, Tailwind, and chart constants.

---

## Migration Notice (Phase 1)

**UI primitives** (`DotSeparator`, `EyeIcon`, `InfoTooltip`, `JsonLd`, `MarkdownText`, `tabs/`)는 `shared/ui/`로 이동 완료.
`PremiumModelGateModal`만 잔류 (Phase 6에서 `features/premium-gate/`로 이동 예정).

**Generic hooks** (`useDialog`, `useEscapeKey`, `useFocusTrap`, `useHydrated`, `useIsMobileViewport`,
`useOnClickOutside`, `usePageHideCancel`, `usePageShowReload`, `usePointerTooltip`, `usePopoverToggle`,
`useQueryParamState`, `useRovingKeyboardNav`, `useCopyToClipboard`)는 `shared/hooks/`로 이동 완료.

`hooks/` 디렉토리에 잔류하는 feature-specific hooks는 이후 Phase에서 각 feature로 이동 예정.

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

- Key factories (`QUERY_KEYS`) are defined in `shared/config/`
- `queryFn`/`mutationFn`: `infrastructure` fetch 함수 또는 `entities/*/actions` Server Action 사용
- `useActionState`: `entities/<x>/actions.ts` Server Action 직접 연결 허용
- Never mix server state and client state

---

## Lightweight Charts Rules

- Chart instances (`IChartApi`, `ISeriesApi`) go in `useRef`
- Chart creation/destruction via `useEffect` + cleanup function
- Overlays (indicator lines) managed in separate hooks
- Resize handling: use `ResizeObserver`
