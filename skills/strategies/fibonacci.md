---
name: 피보나치 전략
description: 피보나치 되돌림/확장 비율을 활용하여 지지·저항 레벨과 목표가를 산출하고, 패턴·지표와 결합하여 매매 시점을 판별하는 전략
type: strategy
category: neutral
indicators: []
confidence_weight: 0.5
overlay_kind: fibonacci
gating:
  tier: always_on
token_cost: 663
digest_hash: "8bb92dc0"
---

## Overview

Fibonacci levels are reference levels the market watches, not predictions (Batchelor & Ramyar, "Magic numbers in the Dow", 2006: no clustering of trend ratios at Fibonacci values beyond chance). Weight them only where they coincide with other structure (prior swing, MA, volume node). Whatever reaction they get comes from many participants watching the same levels, not from the ratios themselves.

This skill covers both retracement (where a pullback may stop) and extension (where the next leg may reach). All level prices are computed by the app and listed in `## Market Reference` — the model cites them, never computes them.

## Confidence Weight Rationale

confidence_weight: 0.5 — widely watched, but no standalone predictive power. Confidence rises when a listed level coincides with a prior swing, horizontal S/R, a key MA (MA20/50/200), a volume node, or a level from another horizon (cluster), and when a reversal candle confirms at the level. It falls when the level stands alone, the swing structure is unclear, the market is choppy, or several listed levels sit within about 1% of each other (ambiguous zone).

## Levels

| Kind | Ratios | Notes |
|---|---|---|
| Retracement | 23.6%, 38.2%, 50%, 61.8%, 78.6% | 50% is a midpoint, not a Fibonacci ratio |
| Extension | 100%, 127.2%, 161.8%, 200%, 261.8% | 100% = equal measured move |

## Retracement

- **Uptrend**: swing low = 0%, swing high = 100%; retracement levels act as **support** on a pullback.
- **Downtrend**: swing high = 0%, swing low = 100%; the same levels act as **resistance** on a bounce.
- Price reacts in a zone around a level, not at the exact price.

| Depth | Interpretation |
|---|---|
| 23.6–38.2% | Shallow — strong trend, minor pause |
| 38.2–50% | Moderate — ordinary pullback |
| 50–61.8% | Deep — trend intact, momentum weakening |
| 61.8–78.6% | Very deep — trend integrity questionable |
| Beyond 78.6% | Near-full retracement — trend likely broken |

## Extension

- **Two-point** (`Fib ext N%`): projected from the anchor swing itself.
- **Three-point A-B-C** (`Fib ABC ext N%`): A = swing start, B = swing end, C = where the retracement completed; the A-B distance is projected from C. Valid only once C is established — never during an active retracement.
- Extension levels are profit-target zones, not entry signals. 100% is the conservative target, 127.2% the first extension, 161.8% the primary one; 200%/261.8% only in strong trends, and price near 261.8% warrants an exhaustion warning.
- A small or unclear A-B swing makes the projection unreliable.

## Cluster

A zone where listed levels from different horizons converge, or where a listed level meets horizontal S/R, a key MA or a volume node, is stronger than any single level. More independent structures in the zone = stronger zone.

## Trade Use

- **Pullback entry**: in a confirmed trend, price reaches a listed 38.2/50/61.8% level and at least one confirmation appears — reversal candle at the level, RSI divergence, volume drying up on the pullback then expanding on the turn, or coincidence with S/R or an MA. Enter on the confirmation close (mirror for downtrends).
- **Stop**: beyond the next deeper listed level.
- **Targets**: retest of the swing extreme, then listed extension levels.
- **Invalidation**: a close beyond the listed 78.6% level → trend likely broken.
- Elliott Wave relationships between waves are covered by the Elliott skill; cite Market Reference rows either way.

## Caveats

- Not a standalone tool; a level without confluence is weak.
- Swing selection is subjective — use the anchor the app lists, not your own swing.
- Don't draw levels on minor swings.

## AI Analysis Instructions

`## Market Reference` lists the computed Fibonacci rows per horizon (Short-term / Medium-term / Long-term), under that horizon's Resistance (above price) or Support (below price) list — the nearest-to-price subset, each with its price and distance from the current price:

- Retracement rows `Fib 23.6%`…`Fib 78.6%`; two-point extension rows `Fib ext N%`.
- A complete `Fib table:` line per horizon with every standard ratio's price — use it for a ratio further from price than the nearest-list rows cover.
- A `Fib anchor: swing low X → swing high Y (up leg)` (or down-leg) line — cite THAT for the swing; do not describe your own.
- Only when a Point C exists for that horizon: `Fib ABC ext 100%`…`Fib ABC ext 261.8%` rows, a complete `Fib ABC table:` line, and a `Fib ABC anchor: A x → B y → C z (up|down)` line. Prefer these over the plain `Fib ext` / `Fib table` rows for a target. If they are absent, state that no A-B-C extension is available yet — do not pick your own A/B/C.

Every standard ratio is available in the nearest-list rows or the table line — **never calculate a level yourself.** Pick the horizon(s) relevant to the setup and identify which listed level price is at or near. Put the relevant listed retracement levels in `keyLevels`. Put listed extension levels in `priceTargets` using the response schema's shape — each side is an object, never a bare list: `priceTargets.bullish.targets` / `priceTargets.bearish.targets` hold `{ price, basis }` items (basis cites ratio and horizon), and that side's `condition` states what must happen first.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**스윙 구간**: [해당 호라이즌의 Fib anchor 행 인용, 예: "Fib anchor: 스윙 저점 $138 → 스윙 고점 $175 (상승 스윙)"]
**주요 되돌림 레벨**: [## Market Reference의 Fib N% 행 인용, 예: "Fib 38.2%=$160.87, Fib 50%=$156.50, Fib 61.8%=$152.13"]
**현재 가격 위치**: [가격이 어느 레벨 근처에 있는지, 예: "Fib 50%($156.50) 근처에서 지지 테스트 중"]
**클러스터 존**: [감지된 피보나치 클러스터, 예: "$155-157 구간에 2개 호라이즌의 Fib 38.2%와 Fib 61.8%가 수렴" / "클러스터 미감지"]
**확장 목표가**: [Point C가 있으면 ## Market Reference의 Fib ABC ext N% 행(및 Fib ABC anchor) 우선 인용, 없으면 Fib ext N% 행 인용, 예: "Fib ABC ext 127.2%=$185.10, Fib ABC ext 161.8%=$197.83" / "Fib ext 161.8%=$197.83"]
**매매 신호**: [현재 신호, 예: "Fib 61.8%에서 망치형 캔들 확인 — 반등 매수 적합" / "명확한 피보나치 신호 없음"]
**상세 분석**: [스윙 구조, 되돌림 깊이 해석, 지지·저항 수렴 여부, 엘리어트 파동과의 관계(해당 시), 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- If price is within about 1% of a listed level, describe the reaction there.
- Highlight a cluster as the stronger zone; call a level with no confluence weak.
- If price has closed beyond a listed 78.6% retracement, note that the trend is likely invalidated.
- Set the `trend` field: `bullish` if price is bouncing from a retracement level in an uptrend, `bearish` if rejecting from a retracement level in a downtrend, `neutral` if between levels or no clear trend.

<!-- PROMPT_DIGEST:START -->
피보나치 전략 (confidence_weight 0.5)
Fibonacci levels are reference levels the market watches, not predictions (Batchelor & Ramyar 2006: no clustering beyond chance). Weight them only where they coincide with other structure (prior swing, MA, volume node).

Retracement 23.6/38.2/50/61.8/78.6% of a completed swing (50% = midpoint, not Fibonacci). Uptrend: levels = support on pullbacks; downtrend: resistance on bounces. Price reacts in a zone, not at the exact price. Depth: <38.2% strong trend; 38.2–50% ordinary pullback; 50–61.8% deep, momentum weakening; 61.8–78.6% trend questionable; close beyond 78.6% = trend likely broken.
Extension 100/127.2/161.8/200/261.8% = profit-target zones, not entries. Two-point `Fib ext` projects the anchor swing; three-point A-B-C (A swing start, B swing end, C retracement end) is valid only once C exists. 100% conservative, 161.8% primary, 200/261.8% only in strong trends (near 261.8% warn of exhaustion).
Cluster: listed levels from different horizons, or a level meeting S/R / MA / volume node = stronger zone; a lone level is weak.
Entry use: pullback to a listed 38.2/50/61.8% + ≥1 confirmation (reversal candle, RSI divergence, volume dry-up then expansion, S/R or MA coincidence); stop beyond the next deeper listed level; targets = swing extreme, then listed extensions.

Market Reference (per horizon Short/Medium/Long, under Resistance-above / Support-below): nearest-list rows `Fib N%` and `Fib ext N%`; a complete `Fib table:` line (every standard ratio — use it for a ratio further than the rows cover); a `Fib anchor: swing low X → swing high Y (leg)` line — cite it for the swing, never pick your own. Only when Point C exists: `Fib ABC ext 100%`…`261.8%` rows + `Fib ABC table:` + `Fib ABC anchor: A x → B y → C z (up|down)` — prefer these for targets; absent → say no A-B-C extension yet. Never calculate a level yourself. Listed retracements → keyLevels. Listed extensions → priceTargets.bullish.targets / priceTargets.bearish.targets as {price, basis} items (basis = ratio + horizon) plus that side's condition — each side is an object, never a bare list.

Output (one **label**: value per line):
**스윙 구간**: [Fib anchor 인용, 예: 저점 $138 → 고점 $175 (상승 스윙)]
**주요 되돌림 레벨**: [Fib N% 행 인용, 예: Fib 38.2%=$160.87, Fib 61.8%=$152.13]
**현재 가격 위치**: [어느 레벨 근처]
**클러스터 존**: [수렴 구간 / 클러스터 미감지]
**확장 목표가**: [Point C 있으면 Fib ABC ext N% 우선, 없으면 Fib ext N%]
**매매 신호**: [현재 신호 / 명확한 신호 없음]
**상세 분석**: [스윙 구조, 되돌림 깊이, S/R 수렴, 엘리어트 관계(해당 시), 주의사항]
Within ~1% of a listed level → describe the reaction. trend: bullish if bouncing from a retracement in an uptrend, bearish if rejecting in a downtrend, else neutral.
<!-- PROMPT_DIGEST:END -->
