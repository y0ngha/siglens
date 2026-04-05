# Domain Layer Rules

## Core Principle

Pure TypeScript functions only. No side effects, file I/O, or API calls.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.

---

## Function Rules

- Always use `export function` (named function declaration)
- No `export default`, arrow function exports, or classes
- One function = one calculation (SRP)
- Immutability: never mutate input arrays/objects

---

## Type Definitions

- Define `types.ts` **before** implementation
- Interfaces use noun names without `I` prefix
- Union types use string literal unions
- All indicator result types belong in `domain/types.ts`

---

## IndicatorResult Rules

- Each indicator function returns **raw arrays** (`(number | null)[]`)
- IndicatorResult assembly happens at the call site (infrastructure or app)
- Domain functions must not directly construct IndicatorResult

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
