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
- **Render-target constants**: `OG_BG`, `OG_FG`, `OG_TICKER_FONT_SIZE` (lib/og.ts) — infrastructure 측 OG image factory에서 import해 사용
- Domain type imports (e.g., `Timeframe`) allowed for type-safe key factories

---

## Imported by

`lib/`은 **app**, **components**, **infrastructure** 모두에서 import 가능 (단방향). lib에는 사이드 이펙트가 없어야 하므로 어느 레이어에서든 안전하게 사용된다. 단, **타입은 lib에 두지 않는다** — cross-layer 공유 타입은 `domain/types.ts`에 두어 hook 파일이 `@/domain/types`만 참조하도록 유지한다.
