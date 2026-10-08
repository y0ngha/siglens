---
name: 엘리어트 파동
description: 엘리어트 파동 이론 기반 현재 파동 위치 및 목표가 분석
type: strategy
category: neutral
indicators: []
confidence_weight: 0.4
overlay_kind: elliott
gating:
  tier: always_on
token_cost: 655
digest_hash: "d6640aac"
---

## Evidence and Reliability

Elliott Wave counts are subjective: two competent analysts can count the same chart differently, and a count is often clear only in hindsight. Batchelor & Ramyar ("Magic numbers in the Dow", 2006) found no Fibonacci clustering in Dow trend ratios beyond chance.

confidence_weight: 0.4 — use Elliott as a structural vocabulary, not a forecast. Every count must come with an alternate count and an invalidation price.

## Absolute Rules (Frost & Prechter, *Elliott Wave Principle*)

Any count that violates one of these is invalid — discard it and recount:

1. **Wave 2** never retraces more than 100% of Wave 1.
2. **Wave 3** is never the shortest of Waves 1, 3 and 5.
3. **Wave 4** never enters the price territory of Wave 1. Exception: diagonals only.

## Wave Characteristics

- **W1**: often mistaken for a bounce inside a downtrend.
- **W3**: typically the longest and strongest; breaks the W1 extreme on expanding volume.
- **W5**: in stocks usually weaker momentum than W3 (divergence is common); may extend or truncate.
- **A**: often read as an ordinary pullback. **B**: a false recovery, usually on lighter volume; can exceed the prior extreme in an expanded flat. **C**: the decisive, impulsive leg.

## Motive Waves

- **Impulse** 5-3-5-3-5: W3 is always an impulse; W2 is never a lone triangle. Usually only one of W1/W3/W5 extends — most often W3.
- **Leading diagonal** (W1 or A): 5-3-5-3-5; W4 overlaps W1.
- **Ending diagonal** (W5 or C): 3-3-3-3-3; W4 overlaps W1; momentum fades; usually followed by a sharp reversal.
- Contracting diagonal = converging trendlines, each motive leg shorter; expanding = diverging, each leg longer.

## Corrective Waves

- **Zigzag** 5-3-5: B does not retrace beyond the start of A; C usually ends beyond the end of A.
- **Flat** 3-3-5: B ends near the start of A (regular), beyond it with C ending beyond A (expanded), or beyond it with C falling short of A (running).
- **Triangle** 3-3-3-3-3 (A-B-C-D-E): only in W4, in wave B, or as the final leg of a combination; contracting, or rarely expanding; a thrust follows completion.
- **Combinations** — double three (W-X-Y) and triple three (W-X-Y-X-Z) join simple corrections with X waves; a triangle appears only as the final leg.

## Alternation

W2 and W4 tend to differ in form: if one is sharp (zigzag), the other tends to be sideways (flat, triangle, combination). W2 is usually the deeper retracement.

## Truncation

A truncated fifth (or C) fails to move beyond the end of W3 (or A), typically after an unusually strong W3. It still subdivides into five waves — an impulse or an ending diagonal. Treat it as confirmed only once price breaks back through the end of W4 (or B); before that, report it as a suspicion.

## Fibonacci Ratios

Ratio reference only — e.g. W2 commonly 50–61.8% of W1, W4 commonly 38.2% of W3, W5 commonly equal to W1. Per Batchelor & Ramyar these ratios do not occur more often than chance, so a ratio is never grounds for a price by itself. A numeric price is valid only when that ratio is listed in `## Market Reference` (nearest-list row or that horizon's `Fib table:` / `Fib ABC table:` line), or when it is a value copied verbatim from a computed `### Elliott waves` candidate (see below) — never compute one.

## AI Analysis Instructions

Use the **last 120 bars maximum**. Count only the **most recent** identifiable structure at the end of the data — do not label the whole history. Apply the three absolute rules strictly.

**Wave-ratio targets (mandatory rule)**: a numeric target or retracement is valid only when the matching ratio appears as a `Fib N%` / `Fib ext N%` / `Fib ABC ext N%` row, or in that horizon's `Fib table:` / `Fib ABC table:` line, in `## Market Reference` for the relevant swing — cite that price — or is the `thrust target`, `wave 5 cap` or C target of the computed `### Elliott waves` candidate you cite, copied verbatim. Never compute a price from a ratio, and never re-derive a candidate's value. Every standard ratio (23.6/38.2/50/61.8/78.6/100/127.2/161.8/200/261.8%) is always available one of those two ways; only a non-standard ratio (76.4%, 85.4%) may be absent — then describe the zone qualitatively without a number.

**Computed counts (use first)**: `### Elliott waves` under `## Chart Overlay Candidates (computed)` lists wave counts already measured against the rules — impulses, diagonals and contracting triangles — each with its pivots, state, `invalidation`, wave ratios and, where defined, `thrust target` (triangle), `wave 5 cap` (diagonal) or C targets (A-B-C). When one fits the latest structure, make it your primary count: put its id first in `candidateIds` (optionally a second candidate id for your alternate count), use its structure as **파동 유형**, and quote its invalidation, ratios and targets verbatim instead of deriving them. A triangle candidate fits only where a triangle may occur — wave 4, wave B, or the last leg of a combination; otherwise do not adopt it. Count on your own only when no listed candidate fits, and present that count simply as your reading of the waves (never mention candidates, rule checks or a computed list).

**Writing the card**: the card describes the waves, not how they were found. Never write that a count or target was or was not provided, checked, computed or listed. When no target applies, say why from the price structure instead ("포인트 C가 아직 없어 A-B-C 확장 목표는 없습니다").

**Invalidation price**: name the price that breaks the primary count under the rules above (e.g. W1 start for a W2 count, W1 extreme for a W4 count). Prefer the candidate's `invalidation`; otherwise use only a price present in `## Market Reference` or in the bar data — never a computed one.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**현재 파동 위치**: [현재 위치 설명, 예: "5파 진행 중 (임펄스 완성 직전)"]
**파동 진행**: [봉 데이터의 스윙 가격 포함, 예: "1파($120→$180) → 2파($180→$145) → 3파($145→$240) → 4파($240→$200) → 5파 진행 중"; 완료 시 "완료" 명시]
**파동 유형**: [임펄스 / 다이아고날 / 지그재그 / 플랫 / 삼각형 / 복합 조정 중 하나]
**목표가**: [인용한 후보의 thrust target·wave 5 cap·C 목표가, 또는 ## Market Reference의 Fib/Fib ext/Fib ABC ext 행이나 Fib table/Fib ABC table 행 인용, 예: "Fib ext 161.8%=$229 기준"; 둘 다 없으면 숫자 없이 정성적 서술]
**무효화 가격**: [주 카운트를 무효화하는 가격 — 인용한 후보의 invalidation 우선, 없으면 Market Reference나 봉 데이터에 있는 값만, 예: "1파 시작점 $120 하회 시 무효 (2파 100% 규칙)"]
**대안 카운트**: [주 카운트가 틀릴 때의 두 번째 해석, 예: "5파가 아니라 ABC 조정의 C파일 가능성"]
**절단 여부**: [절단 감지 없음 / 5파 절단 의심 — 4파 끝($xxx) 이탈 시 확정 등]
**상세 분석**: [파동 구조, 규칙 점검 결과, 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- Corrective wave in progress → cite retracement levels only from listed `Fib N%` rows or that horizon's `Fib table:` line. Motive wave in progress → cite extensions only from listed `Fib ext N%` / `Fib ABC ext N%` rows or the `Fib table:` / `Fib ABC table:` line, or a cited Elliott candidate's thrust target / wave 5 cap / C target copied verbatim.
- Set the `trend` field: `bullish` if in a motive (impulse/extension) wave, `bearish` if in a corrective wave, `neutral` if unclear or consolidating.

<!-- PROMPT_DIGEST:START -->
엘리어트 파동 (confidence_weight 0.4)
Evidence: Batchelor & Ramyar (2006) found no Fibonacci clustering in Dow trend ratios beyond chance; counts are subjective — always give an alternate count.

Rules (violation = invalid count): (1) W2 never retraces >100% of W1. (2) W3 never the shortest of W1/W3/W5. (3) W4 never enters W1 price territory — exception: diagonals only.
Impulse 5-3-5-3-5, W3 always impulse, usually one motive wave extends (most often W3). Leading diagonal (W1/A) 5-3-5-3-5; ending diagonal (W5/C) 3-3-3-3-3.
Corrections: zigzag 5-3-5 (B stays within A's start, C usually beyond A's end); flat 3-3-5 (B near/beyond A's start); triangle 3-3-3-3-3 only in W4, B, or last leg of a combination (WXY/WXYXZ). W2/W4 alternate sharp vs sideways.
Truncation: W5 (or C) fails to pass W3 (or A) end, usually after a strong W3; still subdivides into five (impulse or ending diagonal). Confirmed only when price breaks the W4 (or B) end.
Ratios are reference only: a numeric target/retracement must be a Market Reference `Fib N%`/`Fib ext N%`/`Fib ABC ext N%` row or that horizon's `Fib table:`/`Fib ABC table:` line, or a cited Elliott candidate's thrust target / wave 5 cap / C target copied verbatim — never compute or re-derive. Standard ratios always exist; a missing non-standard one (76.4/85.4%) → qualitative only.

Computed counts first: `### Elliott waves` candidates (impulse/diagonal/triangle) are measured against the rules. If one fits the latest structure, it is your primary count — its id first in candidateIds (optional second id = alternate count), use its structure as 파동 유형 (a triangle only in W4, B or a combination's last leg), quote its invalidation, ratios and thrust target / wave 5 cap / C targets verbatim (never derive them). Count yourself only if none fits, presented simply as your reading (never mention candidates, rule checks or a computed list). When no target applies, give the price-structure reason (e.g. point C not formed yet), never that a computed target or count is missing.
Count only the latest structure in the last 120 bars. Output (one **label**: value per line):
**현재 파동 위치**: [예: 5파 진행 중]
**파동 진행**: [스윙 가격 포함, 예: 1파($120→$180)→2파($180→$145)→…; 완료 시 "완료"]
**파동 유형**: [임펄스 / 다이아고날 / 지그재그 / 플랫 / 삼각형 / 복합 조정]
**목표가**: [후보의 thrust target·wave 5 cap·C 목표 또는 Fib 행/테이블 인용, 예: Fib ext 161.8%=$229 / 없으면 정성 서술]
**무효화 가격**: [후보의 invalidation 우선 — 없으면 Market Reference·봉 데이터 값만]
**대안 카운트**: [주 카운트가 틀릴 때의 두 번째 해석]
**절단 여부**: [감지 없음 / 5파 절단 의심 — 4파 끝($xxx) 이탈 시 확정]
**상세 분석**: [구조, 규칙 점검, 주의]
trend: bullish in a motive wave, bearish in a corrective wave, neutral if unclear.
<!-- PROMPT_DIGEST:END -->
