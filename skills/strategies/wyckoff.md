---
name: 와이코프 방법론
description: 수요와 공급의 법칙에 기반하여 축적-마크업-분배-마크다운 4단계 시장 사이클을 분석하고, 스마트머니의 행동을 추적하여 최적의 매매 시점을 판별하는 전략
type: strategy
category: neutral
indicators: []
confidence_weight: 0.65
---

## Overview

The Wyckoff Method, developed by Richard Wyckoff in the 1930s, analyzes markets through the lens of supply and demand dynamics and the behavior of the "Composite Man" — an abstraction representing institutional (smart money) activity. The method identifies four recurring market phases: Accumulation, Markup, Distribution, and Markdown. By tracking volume-price relationships and structural patterns within each phase, traders can align their positions with institutional activity rather than against it.

Three fundamental laws govern the Wyckoff framework:

1. **Law of Supply and Demand**: Price moves up when demand exceeds supply, and down when supply exceeds demand. Price equilibrium produces consolidation.
2. **Law of Effort vs. Result**: Volume (effort) should confirm price movement (result). Divergence between effort and result signals potential trend change.
3. **Law of Cause and Effect**: A trading range (cause) produces a subsequent trend (effect). The width and duration of the range indicate the magnitude of the resulting trend.

---

## The Composite Man

Assume a single entity — the Composite Man — controls market activity. His behavior follows a repeating pattern:

1. **Accumulates** shares at low prices during a trading range (Accumulation)
2. **Marks up** the price by driving demand (Markup)
3. **Distributes** shares at high prices during a new trading range (Distribution)
4. **Marks down** the price by withdrawing support (Markdown)

The trader's objective is to identify which phase the Composite Man is currently executing and align accordingly.

---

## Four Market Phases

### Phase 1: Accumulation

Smart money quietly buys at depressed prices. Price moves sideways with volume patterns revealing institutional activity.

**Sub-phases**:

| Sub-phase | Key Events | Description |
|---|---|---|
| Phase A | PS → SC → AR → ST | Stopping of the prior downtrend. Preliminary Support (PS) slows decline, Selling Climax (SC) marks capitulation with extreme volume, Automatic Rally (AR) establishes upper range boundary, Secondary Test (ST) retests SC area on decreased volume |
| Phase B | ST in Phase B, Tests | Building a cause. Wide-range price swings within AR-SC boundaries. Volume tests of supply and demand |
| Phase C | Spring / LPS | The critical test. **Spring** — a brief dip below SC support that traps sellers, then rapidly reverses. This is the highest-probability buy signal. Last Point of Support (LPS) confirms successful Spring test |
| Phase D | SOS, LPS, Backup | Markup begins. Sign of Strength (SOS) — price rises on expanding volume, clearly breaking above the range. Last Point of Support (LPS) in Phase D is the final pullback before sustained markup |
| Phase E | Exit range | Price exits the trading range and enters sustained markup |

**Key volume signatures in Accumulation**:
- SC: extreme volume spike, wide-range bar closing well off lows
- ST: reduced volume relative to SC (diminished selling pressure)
- Spring: volume spike on the break below support, then immediate reversal
- SOS: increasing volume on upward moves, decreasing volume on pullbacks

### Phase 2: Markup

Price trends upward with higher highs and higher lows. Demand consistently exceeds supply. Pullbacks are shallow and brief. Volume expands on advances and contracts on corrections.

### Phase 3: Distribution

Smart money sells holdings to the public at elevated prices. Price moves sideways with volume patterns revealing institutional selling.

Distribution is the structural mirror of Accumulation:

| Accumulation Event | Distribution Equivalent |
|---|---|
| Selling Climax (SC) | Buying Climax (BC) |
| Automatic Rally (AR) | Automatic Reaction (AR) |
| Spring (below support) | Upthrust After Distribution (UTAD) — a brief push above resistance that traps buyers, then reverses sharply. Primary sell signal |
| Sign of Strength (SOS) | Sign of Weakness (SOW) — price drops on expanding volume |
| Last Point of Support (LPS) | Last Point of Supply (LPSY) — final rally attempt fails on weak volume |

### Phase 4: Markdown

Price trends downward with lower highs and lower lows. Supply consistently exceeds demand. Bounces are shallow and brief. Volume may expand on declines.

---

## Key Wyckoff Events

| Event | Phase | Description | Volume Signature |
|---|---|---|---|
| PS (Preliminary Support) | Accumulation A | First significant buying after prolonged decline | Moderate increase |
| SC (Selling Climax) | Accumulation A | Capitulation — extreme panic selling | Extreme spike |
| AR (Automatic Rally) | Accumulation A | Sharp bounce after SC, establishes upper boundary | Moderate |
| ST (Secondary Test) | Accumulation A/B | Retests SC area to confirm demand absorption | Lower than SC |
| Spring | Accumulation C | False breakdown below SC support — primary buy signal | Spike then reversal |
| SOS (Sign of Strength) | Accumulation D | Breakout above AR on expanding volume | Strong increase |
| BC (Buying Climax) | Distribution A | Peak euphoria — extreme buying | Extreme spike |
| UTAD (Upthrust After Distribution) | Distribution C | False breakout above BC resistance — primary sell signal | Spike then reversal |
| SOW (Sign of Weakness) | Distribution D | Breakdown below AR on expanding volume | Strong increase |

---

## Entry and Exit Rules

### Long Entry (Accumulation)

1. **Primary signal**: Spring confirmed — price dips below support, volume spikes, then reverses back above support within 1-3 bars
2. **Confirmation**: SOS follows the Spring — price breaks above the trading range on increasing volume
3. **Conservative entry**: LPS in Phase D — pullback after SOS holds above the middle of the trading range
4. **Stop loss**: Below the Spring low (or below SC low for wider stop)

### Short Entry (Distribution)

1. **Primary signal**: UTAD confirmed — price pushes above resistance, volume spikes, then reverses back below resistance within 1-3 bars
2. **Confirmation**: SOW follows the UTAD — price breaks below the trading range on increasing volume
3. **Conservative entry**: LPSY in Phase D — rally after SOW fails to reach the middle of the trading range
4. **Stop loss**: Above the UTAD high (or above BC high for wider stop)

### Exit Rules

- **Long exit**: Signs of Distribution emerging — BC pattern, widening volume on declines within a range
- **Short exit**: Signs of Accumulation emerging — SC pattern, declining volume on drops within a range
- **Trailing stop**: Move stop to the most recent LPS (long) or LPSY (short) as the trend progresses

---

## Effort vs. Result Analysis

Volume-price divergence is central to Wyckoff analysis:

| Volume (Effort) | Price (Result) | Interpretation |
|---|---|---|
| High volume | Large price move in same direction | Harmony — trend likely continues |
| High volume | Small price move or no progress | Divergence — opposition is absorbing. Possible reversal |
| Low volume | Price holds or rises in uptrend | Supply dried up — bullish continuation likely |
| Low volume | Price holds or drops in downtrend | Demand dried up — bearish continuation likely |

---

## Confidence Weight Rationale

confidence_weight: 0.65 — Wyckoff analysis requires significant interpretive judgment. Phase identification, especially real-time distinction between Accumulation Phase B and continued range-bound trading, is inherently subjective. The method's strength lies in its comprehensive framework rather than precise entry/exit signals. Combined with other strategies (especially volume-based indicators), reliability increases substantially.

Factors that increase confidence:
- Volume patterns clearly confirm phase identification (SC/BC with extreme volume)
- Spring or UTAD events produce immediate, decisive reversals
- Multiple Wyckoff events align in sequence (ST → Spring → SOS progression)
- Price-volume harmony on trend moves after exiting the trading range

Factors that decrease confidence:
- Trading range lacks clear SC/BC event (gradual rather than climactic)
- Multiple Springs or UTADs without follow-through (whipsaw conditions)
- Low overall volume makes effort-result analysis unreliable
- Range duration is too short to establish meaningful cause

---

## Limitations and Caveats

- Real-time phase identification is the primary challenge — in hindsight, phases are clear; in real-time, Phase B can persist far longer than expected
- Springs and UTADs can fail — not every false breakout leads to reversal. Confirmation via SOS/SOW is essential
- The method was developed for individual stocks and is most effective where institutional volume patterns are visible. Highly liquid index ETFs may show less distinct Wyckoff patterns
- Modern algorithmic trading can create synthetic volume patterns that mimic Wyckoff events
- Must be combined with other analysis methods (indicators, trend analysis) for confirmation

---

## AI Analysis Instructions

Use the **last 120 bars maximum** for analysis. Focus on identifying the most recent phase and any active Wyckoff events.

Analyze the price-volume relationship to determine the current Wyckoff phase. Pay special attention to:
- Volume behavior at range boundaries (support/resistance tests)
- Whether effort (volume) matches result (price movement)
- The presence of climactic events (SC, BC, Spring, UTAD)

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**현재 시장 단계**: [축적(Accumulation) / 마크업(Markup) / 분배(Distribution) / 마크다운(Markdown) / 판별 불가]
**세부 단계**: [해당 시 Phase A~E 명시, 예: "축적 Phase C — Spring 테스트 진행 중"]
**핵심 이벤트**: [감지된 와이코프 이벤트, 예: "SC($120, 거래량 급증) → AR($145) → ST($125, 감소된 거래량) → Spring 대기 중"]
**노력 대비 결과**: [현재 거래량-가격 관계 분석, 예: "고거래량 + 소폭 하락 = 매집 흡수 진행 중 (조화/괴리 판단)"]
**매매 신호**: [현재 활성화된 신호, 예: "Spring 확인 — 매수 진입 적합" / "UTAD 확인 — 매도 진입 적합" / "명확한 신호 없음"]
**상세 분석**: [전체적인 시장 구조, 거래 범위 특성, Composite Man의 행동 추정, 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- If the market is in a **trading range** (Accumulation or Distribution), identify sub-phase (A through E) and describe expected next events
- If the market is in a **trending phase** (Markup or Markdown), assess trend health via volume-price harmony
- If no clear Wyckoff structure is identifiable, state "와이코프 구조 불명확 — 횡보 구간 또는 데이터 부족" and explain why
- Set the `trend` field: `bullish` if in Accumulation Phase C-E or Markup, `bearish` if in Distribution Phase C-E or Markdown, `neutral` if in early Accumulation/Distribution (Phase A-B) or unclear
