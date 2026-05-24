# Mixed Signal Conflict Resolution — Design Spec

**Date:** 2026-04-20
**Feature:** 섹터 신호 탐색 혼재(Mixed) 영역 추가

---

## Problem

A stock with both bullish and bearish signals currently appears in multiple quadrants simultaneously. This confuses the user because the same company shows up in both the bullish and bearish sections.

---

## Solution

Resolve conflicts at the component layer. Compare bullish signal count vs bearish signal count per stock, then route to a single destination:

- **bullish > bearish** → bullish section + conflict badge
- **bearish > bullish** → bearish section + conflict badge
- **equal counts** → new "혼재" section in the center

---

## Layout

```
[▲ 상승 확정] [△ 상승 예상]   [⚡ 혼재]   [▽ 하락 예상] [▼ 하락 확정]
```

The 혼재 section sits between bullish and bearish subsections. It displays an info message:
> "상승 신호와 하락 신호의 강도가 동일하다. 방향을 알 수 없다."

---

## Data Flow

```
filterStrict()
  → resolveConflicts()          ← NEW
      → groupStockIntoQuadrants()
```

`resolveConflicts()` inspects each `StockSignalResult`:
1. Count `signal.direction === 'bullish'` → `bullishCount`
2. Count `signal.direction === 'bearish'` → `bearishCount`
3. If both > 0 (conflict exists):
   - Attach `conflict: { bullishCount, bearishCount }` to the stock
   - Mark destination: bullish / bearish / mixed

---

## Type Changes (`domain/types.ts`)

```typescript
// Add 'mixed' to QuadrantKey
type QuadrantKey =
  | 'bullishConfirmed'
  | 'bullishExpected'
  | 'bearishExpected'
  | 'bearishConfirmed'
  | 'mixed'              // NEW

// Add optional conflict metadata to StockSignalResult
interface StockSignalResult {
  // ...existing fields unchanged
  readonly conflict?: {
    readonly bullishCount: number;
    readonly bearishCount: number;
  };
}
```

---

## Component Changes

### `SectorSignalPanel.tsx`

1. Add `resolveConflicts(stocks)` function:
   - For each stock, compute bullishCount and bearishCount from `stock.signals`
   - If both > 0: attach `conflict` field and determine destination quadrant
   - If only one direction: pass through unchanged

2. Add `mixed` entry to quadrant rendering pipeline.

3. Render `SignalSubsection` for mixed quadrant with `infoMessage` prop.

### `SignalSubsection.tsx`

- Add optional `infoMessage?: string` prop.
- When present, render a small info tooltip (ℹ️ icon) next to the section title.

### `SignalStockCard.tsx`

- Accept optional `conflict?: { bullishCount: number; bearishCount: number }` prop.
- When present, render a conflict badge below signal badges:
  > `상승 N건 / 하락 N건 감지`

---

## Conflict Badge Appearance

- Shown on cards in **all three destinations** (bullish section, bearish section, mixed section)
- Text: `상승 {bullishCount}건 / 하락 {bearishCount}건 감지`
- Style: muted/neutral tone (not red or green) to avoid directional implication

---

## Out of Scope

- No changes to domain signal detection logic
- No changes to infrastructure/caching layer
- No weighting by signal type importance (simple count only)
