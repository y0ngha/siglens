---
name: Conventions
description: Condensed coding conventions for fix guidance — no examples
type: reference
---

# Conventions (Condensed)

## Paradigm
- `domain/`: Functional required — pure functions, immutability, higher-order functions
- `components/`: Declarative required — object maps over if/else, component splits over branching
- No for/while loops for data transformation → use map, filter, reduce, flatMap
- No mutation: `[...arr, item]` not `arr.push(item)`; `{ ...obj, key: val }` not `obj.key = val`

## File / Directory Naming
- Components: PascalCase (`StockChart.tsx`)
- Hooks, utils, types: camelCase (`useStockData.ts`, `calculateRSI.ts`, `types.ts`)
- Directories: lowercase-kebab (`indicators/`, `stock-chart/`)
- Test files: `original.test.ts`

## TypeScript
- Prefer `interface` for objects; `type` alias for unions
- No `any`
- Explicit return types on all domain functions
- Initial period values must be `null` (never `0` — 0 renders as invalid chart data)
- Interface fields: camelCase (transform snake_case in infrastructure layer)
- Extract union literals with 2+ members to a type alias
- No hardcoded literals → extract to constants in `domain/indicators/constants.ts`
- No type declarations inside functions → move to top of file

## Custom Hook Declaration Order
1. `useState` (if needed)
2. `useRef`
3. `useQuery` / `useMutation`
4. Derived variables
5. Event handlers / functions
6. `useLayoutEffect` (if needed)
7. `useEffect` (one per responsibility)
8. `return`

## Component Folder Structure
- `hooks/`: files that call React hooks
- `utils/`: pure functions with no React hooks
- Never mix component files, hook files, and util files at the same directory level

## Component Rules
- `'use client'` only when: uses state/lifecycle hooks, uses component hooks, registers event handlers, accesses browser APIs, or is an ErrorBoundary fallback
- Named exports everywhere (`export function`); only page/layout use `export default`
- Props interface defined directly above the component (not inline)
- No `React.FC`, no `React.memo()`

## Domain Function Rules
- Pure functions only — no fetch, console.log, Date.now(), or any side effects
- `export function` (named declaration) — no `export default`, no arrow function exports
- One function = one calculation (SRP)
- Explicit return types required

## Test Rules
- `domain/` and `infrastructure/` only — 100% coverage target
- `components/` and `app/` are excluded from tests
- Test structure: 2–5 levels allowed (6+ prohibited). Choose depth based on module complexity.
- One behavior per `it` block
- `toBe` for primitives, `toEqual` for objects/arrays, `toBeCloseTo` for floats
- Mock external dependencies only (API calls, file I/O); never mock domain functions
- Path aliases: `@/domain/...` (no relative paths)

## ESLint / Style
- Never use `eslint-disable` or `eslint-disable-next-line` — fix the root cause
- No inline styles → Tailwind only
- Use `cn()` for conditional classes

## HTTP Status Codes
- Use `node:http2` constants (`HTTP_STATUS_BAD_REQUEST`) — no hardcoded numbers

## Layer Dependencies
- `domain/`: no external imports — pure TypeScript only
- `infrastructure/`: may import from `domain/` only
- `components/` (.tsx): no infrastructure imports; `hooks/` may import infrastructure fetch functions for `queryFn`/`mutationFn` only
- `app/`: may import from infrastructure, domain, lib
- `lib/`: external UI utility wrappers only; may import domain types for React Query key factories

## React Query
- Key factories (`QUERY_KEYS`) live in `lib/`
- Fetch logic in infrastructure; hooks connect `queryFn`/`mutationFn` only — no inline fetch
