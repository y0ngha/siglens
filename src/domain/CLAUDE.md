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
export function calculateRSI(closes: number[], period: number): number[] { ... }

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
  time: string;    // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type Timeframe = '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '1Day';
```

### Timeframe-specific Settings

| Indicator | 1Day | 1Hour | 30Min | 15Min | 5Min | 1Min |
|---|---|---|---|---|---|---|
| RSI period | 14 | 14 | 14 | 10 | 10 | 7 |
| MACD (f,s,sig) | 12,26,9 | 12,26,9 | 12,26,9 | 8,17,9 | 8,17,9 | 6,13,5 |
| BB period | 20 | 20 | 20 | 15 | 15 | 10 |
| BB stdDev | 2 | 2 | 2 | 2 | 2 | 2 |
| MA periods | 5,10,20,60,120 | 5,10,20,50 | 5,10,20,50 | 5,10,20 | 5,10,20 | 5,10,20 |
| EMA periods | 5,10,20,60,120 | 5,10,20,50 | 5,10,20,50 | 5,10,20 | 5,10,20 | 5,10,20 |
| DMI period | 14 | 14 | 14 | 10 | 10 | 7 |
| DMI ADX smooth | 14 | 14 | 14 | 10 | 10 | 7 |
| VWAP reset | daily | daily | daily | daily | daily | daily |

### IndicatorResult Rules

- Calculation results are unified into `IndicatorResult` type
- Each indicator function returns **raw arrays** (number[])
- IndicatorResult assembly happens at the call site (infrastructure or app)
- Domain functions must not directly construct IndicatorResult

### Bar Count

All timeframes: 500 bars.

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
