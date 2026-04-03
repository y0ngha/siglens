# Domain Layer Rules

## Core Principle

This layer allows **pure TypeScript functions only**. No side effects, file I/O, or API calls.

---

## Dependency Rules

```
✅ Allowed: imports from other domain/ modules
❌ Forbidden: all external library imports (including technicalindicators)
❌ Forbidden: imports from infrastructure, components, app, lib
```

Indicator calculations must be **implemented from scratch** without external libraries.

---

## Function Rules

- Always use `export function` (named function declaration)
- No `export default`, arrow function exports, or classes
- One function = one calculation (SRP)
- Immutability: never mutate input arrays/objects

```typescript
// ✅ Correct
export function calculateRSI(closes: number[], period: number): (number | null)[] { ... }

// ❌ Forbidden
export default function calculateRSI(...) { ... }
export const calculateRSI = (...) => { ... }
```

---

## Type Definitions

- Define `types.ts` **before** implementation
- Interfaces use noun names without `I` prefix
- Union types use string literal unions

---

## Indicator Calculation Spec

### Common Types

```typescript
interface Bar {
  time: number;    // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;   // Alpaca 제공
}

type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';
```

### Indicator Constants

All timeframes share the same indicator settings:

```
RSI_DEFAULT_PERIOD = 14
MACD: fast=12, slow=26, signal=9
Bollinger: period=20, stdDev=2
DMI_DEFAULT_PERIOD = 14
MA_DEFAULT_PERIODS = [5, 20, 60, 120, 200]
EMA_DEFAULT_PERIODS = [9, 20, 21, 60]
```

Timeframe-specific EMA selection is handled at the call site (see `docs/DOMAIN.md`).

### IndicatorResult Rules

- Calculation results are unified into `IndicatorResult` type
- Each indicator function returns **raw arrays** (`(number | null)[]`)
- IndicatorResult assembly happens at the call site (infrastructure or app)
- Domain functions must not directly construct IndicatorResult

### Bar Count

Varies by timeframe (defined in `domain/constants/market.ts`):

```
1Min: 200, 5Min: 288, 15Min: 200, 1Hour: 200, 1Day: 500
```

---

## Candle Pattern Detection

### Single Candle (15 types)

Doji, Hammer, Inverted Hammer, Shooting Star, Hanging Man, Bullish Marubozu, Bearish Marubozu, Spinning Top, Bullish Belt Hold, Bearish Belt Hold, High Wave, Long Legged Doji, Gravestone Doji, Dragonfly Doji, Four Price Doji

### Multi Candle (30 types)

2-bar: Bullish/Bearish Engulfing, Piercing Line, Dark Cloud Cover, Tweezer Top/Bottom, Bullish/Bearish Harami, On Neck, In Neck

3-bar: Morning Star, Evening Star, Morning/Evening Doji Star, Three White Soldiers, Three Black Crows, Three Inside Up/Down, Three Outside Up/Down, Three Stars in the South, Advance Block, Two Crows, Upside Gap Two Crows, Deliberation, Three Methods (Up/Down), Abandoned Baby (Bullish/Bearish), Tri Star (Bullish/Bearish), Stick Sandwich, Matching Low

### Pattern Priority

Multi-candle pattern > Single candle pattern. If both detected on the same bar, report only the multi-candle pattern.

---

## AI Prompt Construction

`domain/analysis/prompt.ts` `buildAnalysisPrompt` is a pure function.

- Input: symbol, bars, indicators, skills (Skill[])
- Skills with `confidence_weight < 0.5` are **excluded**
- No file I/O (Skills data is injected from infrastructure)

---

## constants/

`domain/constants/` contains only domain constants: indicator settings, timeframe constants, etc.
UI-related constants (colors, styles) do not belong here.

---

## Common Mistakes

- Using `export default` → use `export function`
- Arrow function exports → use named function declarations
- Overusing `as` type assertions → use type guards or generics
- Using `any` type → use specific types or `unknown`
- Importing external libraries → implement from scratch
- `I`-prefixed interfaces → use plain noun names
