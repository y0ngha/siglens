---
name: 갭 분석
description: 직전 봉 범위를 완전히 벗어난 갭 상승·하락을 위치·추세·거래량 맥락으로 돌파(브레이크어웨이)·진행(런어웨이)·소멸(이그조스천) 갭으로 분류하는 전략 — "갭은 반드시 메워진다" 속설은 쓰지 않는다
type: strategy
category: neutral
indicators: ['atr', 'dmi']
confidence_weight: 0.45
gating:
  tier: gated
  signal_kind: event
  triggers: [gap_up, gap_down]
token_cost: 462
digest_hash: "23be6cc4"
---

## Overview

A price gap is a range of prices where no trading happened between two bars. What a gap means depends almost entirely on **where** it appears — at the edge of a range, in the middle of a trend, or after an extended run. This skill classifies the detected gap by that context; it does not predict whether the gap will be filled.

**What the core detects**

- `gap_up`: the latest bar's **low** is above the previous bar's **high** (the gap stayed open through the whole bar).
- `gap_down`: the latest bar's **high** is below the previous bar's **low**.
- The gap must be at least 0.25 × ATR(14) (when ATR is available), so tiny gaps are ignored.
- These signals only gate this skill in — the signal name is **not printed** anywhere in the prompt. This guide appears only when the engine detected a gap on the latest bar; the `- Gap (last bar vs previous bar):` line in ## Indicator State gives the direction, size and ATR multiple. If that line is absent, tell the direction by comparing the last bar's low/high with the previous bar's high/low in the recent bar data.
- Only the latest bar is checked. Instruments that trade around the clock (crypto) rarely gap on daily bars; intraday bars gap mostly at the session open.

## Gap Types (classical classification — Edwards & Magee)

Classify by context, never by the gap alone:

- **Common gap**: inside a sideways range, ordinary volume, no follow-through. Little meaning.
- **Breakaway gap**: price gaps **out of** a range, base, or chart pattern boundary, ideally with clearly above-average volume. Starts a new move; the most meaningful type.
- **Runaway (measuring) gap**: appears **mid-trend**, in the direction of an established trend (ADX rising, MAs aligned). Shows the trend accelerating.
- **Exhaustion gap**: appears **late in an extended move**, often on a volume spike, and is followed within a few bars by a reversal back through the gap. It can only be confirmed after that reversal — at the gap bar itself, call it a possibility, not a fact.

## What This Skill Does Not Use

- **"Gaps always get filled."** This is folklore, not a measured rule. Breakaway and runaway gaps often stay open for a long time; only the exhaustion type characteristically fills quickly. Never argue for a reversal because "the gap must be filled", and never quote a fill rate.
- No target from the gap size (the "measuring gap" projection is a folk rule without a sourced hit rate here) — cite targets only from a detected chart pattern's app-computed geometry.

## Confidence Weight Rationale

0.45 — the classification is long-standing practitioner framing without a well-established measured edge for a single gap; it is useful mainly to decide which *other* signals the gap confirms.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
갭 분석 (confidence_weight 0.45)
- This guide is injected only when the engine detected a gap on the latest bar (size ≥ 0.25×ATR(14)). The `- Gap (last bar vs previous bar):` line in ## Indicator State states its direction, size, ATR multiple and whether it counts — copy that verdict; do not compare the bars yourself. Only if that line is absent: last bar's low above the previous bar's high = gap up; last bar's high below the previous bar's low = gap down.
- Classify by CONTEXT (Edwards & Magee), never by the gap alone:
  - Common: inside a sideways range, ordinary volume — little meaning.
  - Breakaway: gaps out of a range / base / detected pattern boundary, ideally with above-average volume (cite the computed volume line) — starts a new move, most meaningful.
  - Runaway: mid-trend in the trend's direction (ADX rising, MAs aligned) — trend accelerating.
  - Exhaustion: late in an extended move, often on a volume spike; confirmed only if price reverses back through the gap in the following bars — at the gap bar, a possibility only.
- Do NOT use "gaps always get filled" — folklore. Breakaway/runaway gaps often stay open; never argue a reversal from gap-fill and never quote a fill rate or any unsourced percentage.
- Never compute prices, targets, stops, or R:R; no target from the gap size. Cite levels only from Market Reference / S/R or a detected pattern's app-computed geometry. The gap's edges (previous bar's high/low) may be named as a level to watch.

### Output (one **label**: value per line)
**갭 방향**: [갭 상승 / 갭 하락]
**갭 유형**: [일반 / 돌파(브레이크어웨이) / 진행(런어웨이) / 소멸(이그조스천) 가능성 + 한 줄 근거]
**맥락**: [레인지·패턴 경계 대비 위치, 추세(ADX·이평 배열)]
**거래량 확인**: [계산된 거래량 라인 인용 / 확인 불가]
**상세 분석**: [유형 판단 근거, 갭 경계(직전 봉 고가/저가)를 지켜볼 레벨로, 반대 시나리오]
- trend: gap direction for breakaway/runaway; neutral for common gaps and for a possible exhaustion gap.
<!-- PROMPT_DIGEST:END -->
