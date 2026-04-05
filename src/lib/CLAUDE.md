# Lib Layer Rules

## Core Principle

External UI utility wrappers. Pure functions only, no side effects.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.

---

## What Belongs Here

- **Utility wrappers**: `cn()` (clsx + tailwind-merge)
- **React Query key factories**: `QUERY_KEYS` object
- **Config constants**: `QUERY_STALE_TIME_MS`, `QUERY_GC_TIME_MS`
- **Chart color constants**: `CHART_COLORS`, `getPeriodColor()`
- Domain type imports (e.g., `Timeframe`) allowed for type-safe key factories
