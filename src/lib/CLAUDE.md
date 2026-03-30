# Lib Layer Rules

## Core Principle

External UI utility wrappers. Pure functions only, no side effects.

---

## Dependency Rules

```
✅ Allowed: external packages (clsx, tailwind-merge, etc.)
✅ Allowed: domain type imports (e.g., Timeframe) for type safety in key factories
❌ Forbidden: infrastructure, components, app imports
```

---

## What Belongs Here

- **Utility wrappers**: `cn()` (clsx + tailwind-merge), etc.
- **React Query key factories**: `QUERY_KEYS` object
- **Config constants**: shared configuration values

---

## What Does NOT Belong Here

- Business logic (→ domain/)
- API calls (→ infrastructure/)
- UI components (→ components/)
- Domain constants (→ domain/constants/)

---

## Function Rules

- Pure functions only — no side effects
- `export function` (named function declaration)
- No `export default`

---

## React Query Key Factory

```typescript
// ✅ Key factories live in lib/
export const QUERY_KEYS = {
  bars: (symbol: string, timeframe: Timeframe) => ['bars', symbol, timeframe] as const,
  analysis: (symbol: string) => ['analysis', symbol] as const,
};
```

Type imports from domain (e.g., `Timeframe`) are allowed for key factory type safety.
