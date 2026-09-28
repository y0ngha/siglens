# Skills Evidence Refresh (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `skills/` 콘텐츠를 근거 문헌·Bulkowski 최신 통계에 맞춰 수정·압축·추가한다 (spec: `docs/superpowers/specs/2026-09-28-skills-evidence-refresh-design.md`).

**Architecture:** 코드 변경 없음 — 스킬 `.md`(frontmatter + 본문 + `PROMPT_DIGEST`)와 `messages/*` 번역 키만 바뀐다. Task 1–4는 서로 겹치지 않는 파일 묶음이라 병렬 실행하고, Task 5(통합)에서 digest 해시·i18n·검증을 한 번에 돌린다.

**Tech Stack:** Markdown + YAML frontmatter, `scripts/validate-skills.ts`, `scripts/skills-digest.ts`, next-intl 카탈로그(`messages/*.json`).

---

## 공통 규칙 (Task 1–4 모든 작업자)

- 작업 디렉터리: `/Users/y0ngha/Project/siglens-skills-refresh` (워크트리, 브랜치 `feat/skills-evidence-refresh`). 다른 디렉터리 수정 금지.
- **금지**: `git` 쓰기 명령 전부(add/commit/checkout/restore/stash/reset), `yarn skills:digest-update`, 포맷터 쓰기 모드, `messages/*` 수정, 자기 Task 밖 파일 수정.
- 본문을 바꾼 파일은 `<!-- PROMPT_DIGEST:START -->` … `<!-- PROMPT_DIGEST:END -->`를 **손으로 다시 쓴다**. 파일당 마커 쌍 정확히 1개, `END` 뒤에는 공백만.
- `token_cost`·`digest_hash` 줄은 건드리지 않는다(Task 5가 갱신).
- 출처 없는 퍼센트·승률 금지. 수치를 쓰면 같은 줄에 출처(저자 또는 `thepatternsite.com/<page>`).
- 가격·목표가·R:R을 모델이 계산하게 하는 문구 금지 — 기존 "cite Market Reference / geometry, never compute" 계약 유지.
- digest 토큰 추정(목표 확인용):
  ```bash
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8");const m=t.match(/<!-- PROMPT_DIGEST:START -->([\s\S]*?)<!-- PROMPT_DIGEST:END -->/);console.log(Math.ceil(m[1].trim().length/4))' skills/strategies/elliott-wave.md
  ```
  (스크립트의 실제 산식과 ±몇 토큰 차이는 무방.)
- 작업 후 게이트: `yarn validate:skills` 통과(전체 레포 기준 — 다른 작업자의 진행 중 파일 때문에 실패하면 자기 파일 관련 에러만 0인지 확인).
- 한국어 `name:`/`description:`을 바꾸거나 파일을 삭제하면 **최종 보고에 "old → new" 목록**으로 남긴다(Task 5가 i18n 처리).
- Bulkowski 수치는 `WebFetch`로 원문 페이지에서 확인하고, 확인 못한 수치는 쓰지 않는다. 보고에 사용한 URL과 인용 수치를 남긴다.

---

### Task 1: G1 — 패턴 사실 수정 + 가중치

**Files:**
- Modify: `skills/patterns/*.md` (17개), `skills/_core/pattern-index.md`

**가중치 규칙** (주 방향 break-even failure rate, Bulkowski):
`≤10% → 0.8`, `11–20% → 0.7`, `21–30% → 0.6`, `>30% → 0.5`. 주 방향 돌파 비율 < 55% → −0.05. H&S·역H&S → +0.05(Savin, Weller & Zvingelis 2007). 변형이 여러 개(예: Adam/Eve 이중바닥)면 변형 실패율의 중앙값.

**확정값**(원문 확인 완료): cup-and-handle 0.8 (rank 3/39, failure 5%) · head-and-shoulders 0.75 (rank 9/36, failure 19%, +0.05) · descending-triangle 0.55 (up 53%/down 47%, failure 22/23%; `category: neutral`로 변경) · triple-top 0.6 (rank 24/36, failure 25%, meets target 49%) · symmetrical-triangle 0.5 (up 60/down 40, failure 25/37%, rank 36/39) · ascending-wedge 0.5 (down 60%, down failure 51%). descending-wedge: up 68%, failure 26% → 0.6. ascending-triangle: up 63%, up failure 17% → 0.7.

**원문 조회 필요**(thepatternsite.com 검색): inverse-head-and-shoulders, double-top, double-bottom, triple-bottom, bull-flag, bear-flag, pennant, rectangle, rounding-bottom.

- [ ] **Step 1:** 각 패턴 원문 조회 → 실패율·돌파 방향·순위 기록 → 규칙으로 weight 산정.
- [ ] **Step 2:** 각 파일 수정:
  - frontmatter `confidence_weight` 교체.
  - 본문 "Confidence Weight Rationale"(또는 동등 문단)과 digest의 `Confidence (weight X): …` 줄을 원문 수치로 교체. 원문에 없는 수치 삭제 — 알려진 것: descending-triangle "87% / 64% / 13%", ascending-triangle "~70% / ~25% / 75–87%", triple-top "~88%", rounding-bottom "75–82%", triple-bottom "80–85%", symmetrical-triangle "65–70%", cup-and-handle "very reliable"(→ rank/failure 수치로), rectangle·pennant의 Bulkowski 인용(원문 대조).
  - descending-triangle: 설명·digest를 "방향 중립에 가까움(상방 53%) — 하방 확정은 지지선 종가 이탈 후에만"으로. "bull trap risk" 문장은 수치 제거 후 유지 가능.
  - detection/geometry/출력 계약·트리거는 변경 금지.
- [ ] **Step 3:** `skills/_core/pattern-index.md` 본문과 digest에 한 줄 추가: `Bulkowski: chart-pattern performance has roughly halved since the 1990s (thepatternsite.com/dt.html) — never call a trade on a pattern alone.` 개별 패턴 1줄 요약에 확정/산정 weight가 적혀 있으면 새 값으로 맞춘다.
- [ ] **Step 4:** `yarn validate:skills` → 자기 파일 에러 0. `grep -nE "88%|87%|75–82|80–85|65-70|65–70" skills/patterns` → 0건.
- [ ] **Step 5:** 보고: 파일별 old→new weight, 사용 URL·수치, 한국어 name/description 변경 목록(없으면 "없음").

---

### Task 2: G2 — 상시 주입 다이어트 + 전략 정리

**Files:**
- Modify: `skills/strategies/elliott-wave.md`, `skills/strategies/fibonacci.md`, `skills/strategies/multi-timeframe.md`, `skills/support-resistance/pivot-points.md`, `skills/indicators/ichimoku-cloud.md`, `skills/strategies/ma-cycle.md`, `skills/strategies/macd-cycle.md`, `skills/indicators/smart-money-concepts.md`, `skills/strategies/divergence.md`, `skills/strategies/breakout.md`
- Delete: `skills/support-resistance/fibonacci-retracement.md`, `skills/support-resistance/fibonacci-extension.md` (내용을 fibonacci.md로 흡수한 뒤 `rm`)

- [ ] **Step 1: elliott-wave.md** (digest ≤ 450 토큰)
  - `confidence_weight: 0.4`.
  - 규칙 수정: 절단된 5파/C파는 **5파 구조(임펄스 또는 엔딩 다이아고날)로 세분**된다 — "5-3-5-3-5 zigzag" 문구 삭제. "W5/C must retrace ≥61.8% of W4/B", "W3's internal W5 cannot be truncated" 삭제. 3번 절대규칙 예외는 "diagonals only"(triangle 삭제).
  - 근거 한 줄: "Evidence: Batchelor & Ramyar (2006) found no Fibonacci clustering in Dow trend ratios beyond chance; counts are subjective — always give an alternate count."
  - 출력 형식에 두 필드 추가(필수): `**대안 카운트**: [주 카운트가 틀릴 때의 두 번째 해석]`, `**무효화 가격**: [주 카운트를 무효화하는 가격 — Market Reference나 봉 데이터에 있는 값만]`. 기존 필드(현재 파동 위치/파동 진행/파동 유형/목표가/절단 여부/상세 분석) 유지.
  - 압축 대상: 복합 조정(WXY/WXYXZ) 표 → 1줄, 교대 원칙 → 2줄, 피보나치 비율표 → 1줄("ratio reference only; cite Market Reference rows, never compute"). 목표가 인용 규칙과 trend 규칙은 유지.
  - `description` 변경하지 않는다(i18n churn 방지).
- [ ] **Step 2: fibonacci.md** (digest ≤ 700 토큰)
  - retracement/extension 두 파일의 핵심(되돌림 레벨 해석, 확장 목표 레벨, Market Reference `Fib N%`/`Fib ext N%`/`Fib table` 인용 규칙)을 흡수.
  - `confidence_weight: 0.5`. 프레이밍 한 줄: "Fibonacci levels are reference levels the market watches, not predictions (Batchelor & Ramyar 2006: no clustering beyond chance). Weight them only where they coincide with other structure (prior swing, MA, volume node)."
  - `description`을 병합 내용에 맞게 변경 가능(변경 시 보고). 기존 출력 형식이 있으면 유지.
  - 두 S/R 파일 `rm`.
- [ ] **Step 3: multi-timeframe.md** (digest ≤ 350 토큰)
  - 입력은 단일 시간대라는 전제로 재작성: 상위 추세를 MA50/MA200·가격 구조로 추정하는 **필터**만 남긴다.
  - 삭제: `**중간 시간대 셋업**`, `**하위 시간대 타이밍**` 출력 필드와 예시, "HTF RSI>70 → ignore lower-TF bullish", "eliminates majority of losing trades", 시간대 조합표, 인디케이터×시간대 표.
  - 남는 출력: `**상위 시간대 추세**`, `**시간대 정렬도**`(가용 데이터 기준), `**방향성 판단**`, `**상세 분석**`. "하위 시간대 확인이 필요하면 사용자에게 권고"는 1줄로.
- [ ] **Step 4: pivot-points.md** (digest ≤ 350 토큰): "Floor pivots are computed from the prior session's H/L/C — an intraday tool. On daily or longer charts treat them as secondary references only." 압축, 인용 규칙 유지.
- [ ] **Step 5: ichimoku-cloud.md**: frontmatter만 변경
  ```yaml
  gating:
    tier: gated
    signal_kind: event
    triggers: [ichimoku_cloud_breakout, ichimoku_cloud_breakdown]
  ```
- [ ] **Step 6:** `ma-cycle.md` → `confidence_weight: 0.55` + `category: neutral` 추가; `macd-cycle.md` → `0.55`. 두 파일 근거 문단/digest의 weight 표기 갱신 + 한 줄: "Simple MA-crossover edges vanished out of sample after 1986 (Sullivan, Timmermann & White 1999) — use as a regime description, not a timing edge."
- [ ] **Step 7:** `smart-money-concepts.md` → `confidence_weight: 0.5` + 한 줄: "Practitioner framework: on SPY none of order block / FVG / liquidity sweep / BOS showed a statistically significant forward edge (best t=1.22)." (digest가 있으면 동일 반영)
- [ ] **Step 8:** `divergence.md`: "Multi-oscillator win rates" 블록 삭제, "MACD divergences precede larger moves than RSI" 삭제, 진입 규칙의 "or 1:2 R:R" 삭제(목표 = 직전 스윙/지지·저항만).
- [ ] **Step 9:** `breakout.md`: "False breakouts occur 40-50% without filters; even with filters expect 25-35%" → "Failure rates differ by pattern — cite the matching pattern skill's Bulkowski figures, not a generic rate."
- [ ] **Step 10:** 토큰 확인(공통 규칙의 node 한 줄) — elliott ≤450, fibonacci ≤700, MTF ≤350, pivot ≤350. `yarn validate:skills` 자기 파일 에러 0.
- [ ] **Step 11:** 보고: 파일별 digest 토큰 추정, 한국어 name/description 변경·삭제 목록.

---

### Task 3: G3 — 캔들 가이드

**Files:**
- Delete: `skills/candlesticks/engulfing.md`
- Create: `skills/candlesticks/bullish-engulfing.md`, `bearish-engulfing.md`, `piercing-dark-cloud.md`, `three-inside-outside.md`, `tweezers.md`, `abandoned-baby-tri-star.md`, `counterattack-belt-hold.md`, `gap-continuation.md`, `gap-two-crows-rabbits.md`, `advance-block-ladder-bottom.md`
- Modify: `skills/candlesticks/marubozu.md`, `doji.md`, `hammer-shooting-star.md`, `harami.md`, `morning-evening-star.md`, `three-soldiers-crows.md`, `skills/_core/candle-primer.md`

**가중치 규칙**(주장 방향 반전/지속율, Bulkowski `thepatternsite.com`): `≥75% → 0.75`, `65–74% → 0.65`, `55–64% → 0.55`, `<55% → 0.4`(본문·digest에 "near random — needs confirmation" 명시). 파일 내 여러 라벨 → 가장 약한 라벨 기준. 원문 수치를 못 찾은 라벨 → 0.4 + "no published rate". 상한 0.75.

알려진 값: bullish engulfing reversal 63% (rank 84/103) · bearish engulfing reversal 79% · three inside up reversal 65% · kicker 53% · three white soldiers reversal 82% (rank 3/103) · dragonfly doji(8대 캔들, reversal rank 55/103) · white/black marubozu continuation 56%/53%.

**신규 파일 템플릿**(기존 `harami.md` 구조 따름):
```markdown
---
name: Tweezers Pattern Guide
description: Tweezers Top/Bottom candlestick pattern interpretation guide
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.55
gating:
  tier: gated
  signal_kind: event
  triggers: [tweezers_top, tweezers_bottom]
token_cost: 0
digest_hash: "00000000"
---

## Overview
(형태 정의 — 봉 수, 몸통/꼬리 조건, 앞선 추세 요건)

## Measured Behavior
(Bulkowski 반전/지속율·순위, URL. 없으면 "No published rate — treat as a weak hint.")

## Signal Interpretation
(강/중/약 조건 — 추세 길이, 거래량, 지지/저항 위치)

## Caveats
(오인 사례, 횡보장에서의 신뢰도, 확인봉 필요)

## AI Analysis Instructions
<!-- PROMPT_DIGEST:START -->
(위 내용 압축 — ≤ 400 토큰. "Interpret only if listed in the detected-pattern section" 1줄 포함)
<!-- PROMPT_DIGEST:END -->
```
(`token_cost: 0` / `digest_hash: "00000000"`은 자리표시 — Task 5의 `digest-update`가 실제 값으로 바꾼다. 다른 필드는 실제 값으로 채운다.)

| 신규 파일 | name | triggers |
|---|---|---|
| bullish-engulfing.md | Bullish Engulfing Guide | [bullish_engulfing] |
| bearish-engulfing.md | Bearish Engulfing Guide | [bearish_engulfing] |
| piercing-dark-cloud.md | Piercing Line / Dark Cloud Cover Guide | [piercing_line, dark_cloud_cover] |
| three-inside-outside.md | Three Inside / Outside Guide | [three_inside_up, three_inside_down, three_outside_up, three_outside_down] |
| tweezers.md | Tweezers Pattern Guide | [tweezers_top, tweezers_bottom] |
| abandoned-baby-tri-star.md | Abandoned Baby / Tri-Star Guide | [bullish_abandoned_baby, bearish_abandoned_baby, bullish_triple_star, bearish_triple_star] |
| counterattack-belt-hold.md | Counterattack / Belt Hold Guide | [bullish_counterattack_line, bearish_counterattack_line, bullish_belt_hold, bearish_belt_hold] |
| gap-continuation.md | Gap Continuation Guide (Tasuki / Neck) | [upside_gap_tasuki, downside_gap_tasuki, on_neck, in_neck] |
| gap-two-crows-rabbits.md | Upside Gap Two Crows / Downside Gap Two Rabbits Guide | [upside_gap_two_crows, downside_gap_two_rabbits] |
| advance-block-ladder-bottom.md | Advance Block / Ladder Bottom Guide | [advance_block, ladder_bottom] |

- [ ] **Step 1:** 라벨별 Bulkowski 원문 조회 → 반전/지속율·순위 기록. (on_neck/in_neck는 Bulkowski 기준 실제로는 bullish reversal로 더 자주 작동하는 것으로 알려져 있음 — 원문 확인 후 본문에 그대로 적는다. 교과서 해석과 측정이 다르면 측정을 따르고 차이를 명시.)
- [ ] **Step 2:** `engulfing.md`의 내용을 두 파일로 나누고(각 방향 수치·weight) `rm skills/candlesticks/engulfing.md`.
- [ ] **Step 3:** 8개 패밀리 파일 작성(위 템플릿, 영문).
- [ ] **Step 4:** `marubozu.md` 재작성: Bulkowski "Eight Best-Performing Candles"(S&C V.29:11) — 흑색 마루보주가 상승추세에서 상방 돌파 시 추세 재개(지속 53%, 10일 +4.39%), 백색 마루보주가 하락추세에서 하방 돌파 시 추세 재개(56%). "같은 색 마루보주 = 추세 확인"을 과대평가하지 말 것, "반대 색 장대봉은 추세 속 일시적 역행일 수 있음". weight 규칙 적용.
- [ ] **Step 5:** `doji.md` triggers에 `spinning_top` 추가 + 본문/digest에 스피닝 탑 1~2줄. `hammer-shooting-star.md`, `harami.md`, `morning-evening-star.md`, `three-soldiers-crows.md`: 수치 원문 대조·교체, weight 재산정.
- [ ] **Step 6:** `_core/candle-primer.md` 본문·digest에서 "Three-method-style sequences" 삭제(“Gap patterns / Tasuki” 는 유지 — tasuki는 탐지됨). 신규 가이드가 생긴 패턴은 primer 문구 그대로 둬도 된다.
- [ ] **Step 7:** `yarn validate:skills` — 트리거 이름 오류 0. `ls skills/candlesticks | wc -l` → 16.
- [ ] **Step 8:** 보고: 라벨별 수치·URL·weight, 신규/삭제 파일 목록(모두 영문이라 i18n 변경 없음을 확인).

---

### Task 4: G4 — 뉴스·펀더멘털 + 문서

**Files:**
- Modify: `skills/news/macro-impact.md`, `skills/news/earnings-reaction.md`, `skills/news/event-driven.md`, `skills/fundamental/growth-investing.md`, `skills/fundamental/quality-investing.md`, `skills/fundamental/value-investing.md`, `skills/_core/indicator-core.md`, `skills/CLAUDE.md`

- [ ] **Step 1: macro-impact.md** — FOMC 표를 국면 조건부 규칙으로 교체:
  - (a) 성장·생산성 견조 속 인상/매파: 금리↑와 실적 주도주↑가 공존할 수 있음 — "인상=성장주 하락" 단정 금지, 실적 모멘텀과 실질금리 방향을 같이 본다.
  - (b) 둔화·침체 신호 속 인상/동결: 방어주·퀄리티 선호, 경기민감주·고부채 기업 압박.
  - (c) 인하 + 커브 스티프닝: 은행 순이자마진 개선 가능 — "인하=금융 피해" 단선 규칙 삭제. 인하 + 커브 평탄화/역전 심화는 은행 불리.
  - 추가 변수 각 1~2줄: PCE(연준 기준 물가), 관세·무역정책(수입 의존·공급망 노출 섹터), AI 설비투자 사이클·메가캡 집중도(지수와 동일가중 괴리), 기간 프리미엄·재정적자(장기금리), 유가(에너지 전가·인플레 기대).
  - "다음 FOMC·CPI 일정 언급" → "Mention upcoming macro dates only if they appear in the input; never state a date that is not in the input." Citi Surprise Index도 "입력에 있을 때만".
  - 크립토 문단: 달러·실질금리·글로벌 유동성, 현물 ETF 자금 흐름, 스테이블코인 공급 — "입력에 해당 데이터가 있을 때만 수치 인용".
  - 시점 수치(현재 금리 수준 등) 금지.
- [ ] **Step 2: earnings-reaction.md**
  - 본문·digest 첫 줄: "이 프레임은 실적 발표가 있는 기업에만 적용한다 — 암호화폐 등 실적 없는 자산에는 적용하지 않는다."
  - PEAD 문단 교체: "대형주에서 PEAD는 2006년 이후 사실상 소멸(Martineau 2022, Critical Finance Review) — 소형·저커버리지 종목에서만 약하게 남아 있다. 대형주에서 1~3개월 추가 상승을 기대 근거로 쓰지 말 것."
  - 삭제: "Whisper Number 추적 지표: 옵션 IV", "Short Interest 급증 = 기관 Miss 예측 신호", "Pre-earnings 드리프트: 4~6주 전부터 기관 포지션 구축"(근거 없음).
  - 추가: "옵션 implied move(내재 변동폭) 대비 실제 반응 — 입력에 implied move가 있을 때만 비교. 큰 Beat에도 implied move보다 작게 움직이면 기대가 이미 반영된 것."
- [ ] **Step 3: event-driven.md**
  - PEAD 문장 → Step 2와 같은 취지로 교체.
  - 추가: "지수 편입(S&P 500): 편입 초과수익은 1990년대 평균 7.4% → 최근 10년 1% 미만(Greenwood & Sammon, JF 2025). 편입 뉴스만으로 큰 움직임을 기대하지 말 것."
  - FDA 줄: "단일 파이프라인 소형 바이오에서 허가 +50~100%, 거부 −50~70%까지 나올 수 있다 — 대형 제약은 훨씬 작다."
- [ ] **Step 4: growth-investing.md** — 추가: "Rule of 40: 매출 성장률(%) + FCF 마진(%) ≥ 40이면 성장과 수익성 균형 양호(SaaS·소프트웨어 기준)", "SBC(주식보상): FCF에서 SBC를 뺀 값과 연간 희석률(주식 수 증가율)을 함께 본다 — SBC가 큰 기업의 FCF는 과대평가된다."
- [ ] **Step 5: quality-investing.md** — 추가: "Gross profitability(매출총이익 ÷ 총자산): 학술적으로 가장 견고한 퀄리티 지표 중 하나(Novy-Marx 2013)". 삭제: "신규 경쟁자 진입 시 이탈율 <5%면 해자 확인"(출처 없음).
- [ ] **Step 6: value-investing.md** — "EV/EBITDA 8~12배가 통상 합리적" → "EV/EBITDA는 섹터 중앙값·자기 과거 범위 대비 상대 평가(절대 기준 없음)". PBR 줄에 "한국 상장사는 PBR<1이 흔하다 — 밸류업 프로그램(주주환원 확대) 진행 여부와 지배구조 할인을 함께 보고, PBR<1만으로 청산가치 이하라 단정하지 말 것" 추가. "FCF yield(FCF ÷ 시가총액)" 1줄 추가.
- [ ] **Step 7: indicator-core.md** — 본문·digest의 "one-line reference for every computed indicator" → "one-line reference for the core indicators; supplementary indicators (MACD-V, Connors RSI, Force Index, Elder-Ray/Impulse, Chandelier, Hurst, Variance Ratio, R², Yang-Zhang, EWMA) get their own guide only when notable". `description`은 바꾸지 않는다.
- [ ] **Step 8: skills/CLAUDE.md** — (a) "state pairs" 표를 `scripts/validate-skills.ts`의 `VALID_STATE_PAIRS` 19개로 교체, (b) 신호 카탈로그에 `bollinger_percentb_oversold`, `bollinger_percentb_overbought` 추가, (c) "all ~70 of them" → "all ~90", (d) always_on 설명에서 Ichimoku 제거(이제 event-gated), fibonacci는 `strategies/fibonacci.md` 하나로 병합됐다고 명시.
- [ ] **Step 9:** 뉴스·펀더멘털은 `description` 변경 금지(i18n churn 방지). `yarn validate:skills` 자기 파일 에러 0.
- [ ] **Step 10:** 보고: 파일별 변경 요약, 한국어 name/description 변경(없어야 정상).

---

### Task 5: 통합 (orchestrator)

**Files:**
- Modify: `messages/ko.json`, `messages/en.json`, `messages/ja.json`, `messages/zh.json`, `messages/_meta/hashes.json`, 모든 변경 스킬의 `token_cost`/`digest_hash` 줄

- [ ] **Step 1:** Task 1–4 보고 취합, `git status`로 변경 파일 목록이 계획과 일치하는지 확인.
- [ ] **Step 2:** `yarn skills:digest-update` → `yarn skills:digest-verify` (0 issue).
- [ ] **Step 3:** i18n — 보고된 한국어 name/description 변경·삭제를 4개 로케일에 반영. 삭제 대상: `shared.skillName`의 "피보나치 되돌림", "피보나치 확장"; `shared.skillDescription`의 두 파일 설명. 변경된 설명은 옛 키 삭제 + 새 키 추가(ko=원문, en/ja/zh=번역, `.`→`．`). `hashes.json`의 해당 키 갱신/삭제:
  ```bash
  node -e 'const c=require("crypto");console.log(c.createHash("sha1").update(process.argv[1]).digest("hex").slice(0,12))' "<ko 값>"
  ```
- [ ] **Step 4:** 게이트
  ```bash
  yarn validate:skills
  yarn skills:digest-verify
  yarn i18n:verify
  yarn test src/entities/skill src/shared/i18n
  npx tsc --noEmit
  yarn lint
  ```
  모두 통과.
- [ ] **Step 5:** always_on 합계 확인:
  ```bash
  grep -rl "tier: always_on" skills | grep -v -e news/ -e fundamental/ -e smart-money -e CLAUDE.md | xargs grep -h "^token_cost" | awk '{s+=$2} END{print s}'
  ```
  Expected: ≤ 7000.

### Task 6: 리뷰 → PR → 리뷰 루프 (orchestrator)

- [ ] **Step 1:** 리뷰 전 백업: `git diff HEAD > $SCRATCH/sp1-pre-review.diff` + untracked tar.
- [ ] **Step 2:** `review-agent` 호출(포맷터 쓰기·git 쓰기·파일 수정 금지 명시) → findings 수정 → round N 재호출(최대 3).
- [ ] **Step 3:** `mistake-managing-agent` → `git-agent`(PR 생성).
- [ ] **Step 4:** CI·Claude Code Review 코멘트 모니터링 → 반영 → 재푸시(git-agent) → approved + CI green까지 반복.
