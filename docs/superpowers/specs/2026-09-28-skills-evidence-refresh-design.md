# 2026-09-28 Skills 근거 기반 최신화 — SP1 (siglens `skills/` 전용)

`skills/` 82개 파일을 근거 문헌·최신 통계와 대조한 검토(2026-09-28 세션)의 결과 중 **core 변경 없이
siglens만으로 끝나는 부분**을 다룬다. core 신규 탐지기(SP2)와 그 소비(SP3)는 별도 스펙.

## 0. 결론

| 축 | 변경 |
|---|---|
| 사실 오류 | Bulkowski 최신 통계와 다른 패턴·캔들 수치 수정, 출처 없는 승률·성공률 삭제 |
| 가중치 | 패턴·캔들 `confidence_weight`를 §2.1·§2.3 규칙으로 재산정 |
| 상시 주입 | 차트 always_on 약 12.4k → 약 6.9k 토큰 (엘리어트·피보나치·MTF·피봇 압축, 일목 gated) |
| 신규 캔들 가이드 | core가 이미 탐지하지만 가이드 없는 캔들 라벨 약 30종 → 패밀리 파일 약 8개 |
| 뉴스·펀더멘털 | 국면 조건부 매크로 규칙, PEAD·지수편입 효과 소멸 반영, KR·크립토 문구 |
| 문서 | `skills/CLAUDE.md` 카탈로그 동기화, indicator-core 문구 정정, `ma-cycle` category |

범위 밖: 눌림목(`strategies/mean-reversion.md`)은 **그대로 둔다**(사용자 결정 — trader의 RSI(2) 규칙과
같은 셋업이며 이미 측정 근거 포함). core 코드·프롬프트 빌더·검증기 카탈로그는 건드리지 않는다.

## 1. 근거

| 주장 | 출처 |
|---|---|
| 다우 추세 비율이 피보나치 비율에 몰리는 빈도는 무작위와 차이 없음 | Batchelor & Ramyar, "Magic numbers in the Dow" (2006) |
| PEAD는 대형주에서 2006년 이후 소멸, 초소형주도 최근 소멸 | Martineau, "Rest in Peace Post-Earnings Announcement Drift", CFR (2022) |
| DJIA 종목에서 캔들 전략은 무작위 대비 초과수익 없음 | Marshall, Young & Rose, JBF 30(8) (2006) |
| 이평 교차 등 단순 규칙의 우위는 1986년 이후 표본 밖에서 소멸 | Sullivan, Timmermann & White, JF (1999) 및 후속 out-of-sample |
| H&S 조건부 전략 위험조정 초과수익 연 5~7% | Savin, Weller & Zvingelis, JFEC (2007) |
| S&P 500 편입 초과수익 1990년대 7.4% → 최근 10년 1% 미만 | Greenwood & Sammon, "The Disappearing Index Effect", JF (2025) |
| SPY에서 ICT/SMC 4개 개념 모두 유의성 미달(최고 t=1.22) | StatOasis ICT backtest |
| 패턴 성과가 1990년대 대비 거의 절반 | Bulkowski, thepatternsite.com (dt.html) |

Bulkowski 실측값(thepatternsite.com, 2026-09-28 조회):

| 패턴 | 스킬 기존 주장 | 실측 |
|---|---|---|
| 하락삼각형 | 하방 64%, 상방 13%, 성공 87%, 가중치 0.8 | **상방 53% / 하방 47%**, 실패율 22/23%, 하방 목표 도달 50% |
| 상승삼각형 | 상방 ~70%, 하방 ~25% | 상방 63% / 하방 37%, 상방 실패율 17% |
| 대칭삼각형 | 직전 추세 방향 65~70% | 상방 60 / 하방 40, 39개 중 36위("performance is awful") |
| 삼중천장 | Bulkowski ~88% 성공 | 36개 중 24위, 실패율 25%, 목표 도달 49% (88%는 원문에 없음) |
| 상승쐐기 | — | 하방 60%, 하방 실패율 51% |
| 하락쐐기 | — | 상방 68%, 실패율 26%, 39개 중 31위 |
| 컵앤핸들 | Bulkowski "very reliable" | 39개 중 3위, 실패율 5% |
| H&S 천장 | — | 36개 중 9위, 실패율 19%, 목표 도달 51% |
| 상승장악형 | "57%" | 반전 63%, 성과 103개 중 84위 |
| 하락장악형 | "57%" | 반전 79% |
| 마루보주 | "추세 지속 확인" | 흑색 마루보주는 상승추세 속에서 상방 재개(지속 53%), 백색 마루보주는 하락추세 속에서 하방 재개(56%) |
| three inside up | (가이드 없음) | 반전 65%, Bulkowski 8대 캔들 |

## 2. 설계

### 2.1 G1 — 패턴 사실 수정 + 가중치 (skills/patterns/*.md, skills/_core/pattern-index.md)

가중치 규칙 — 패턴의 **주 방향** break-even 실패율(Bulkowski):

| 실패율 | weight |
|---|---|
| ≤ 10% | 0.8 |
| 11–20% | 0.7 |
| 21–30% | 0.6 |
| > 30% | 0.5 |

- 주 방향 돌파 비율이 55% 미만이면 −0.05.
- 학술 근거가 따로 있는 H&S·역H&S는 +0.05(Savin 외 2007).
- 확정값: 컵앤핸들 0.8, 헤드앤숄더 0.75, 하락삼각형 0.55(`category: neutral`로 변경), 삼중천장 0.6,
  대칭삼각형 0.5, 상승쐐기 0.5. 나머지 11개는 구현 시 Bulkowski 원문 페이지를 조회해 같은 규칙으로 산정하고
  근거 문장(`confidence_weight: X — Bulkowski: …`)에 수치와 페이지를 남긴다.
- 원문에서 확인 못한 수치(원형바닥 75–82%, 삼중바닥 80–85% 등)는 삭제하거나 원문 값으로 교체.
- `pattern-index.md`에 한 줄: "Bulkowski 측정상 차트 패턴 성과는 1990년대 대비 절반 수준 — 패턴 단독 판정 금지."
- 판정 기준(detection/geometry/출력 계약)은 바꾸지 않는다 — 수치 주장과 weight만.

### 2.2 G2 — 상시 주입 다이어트 + 전략 정리

| 파일 | 변경 | digest 목표 |
|---|---|---|
| strategies/elliott-wave.md | weight 0.68→0.4. 오류 수정: 절단 5파는 **5파 구조(임펄스/엔딩 다이아고날)**로 세분(“5-3-5-3-5 지그재그” 삭제), 원문에 없는 규칙("W4/B의 61.8% 이상", "3파 내부 5파 절단 불가") 삭제, 4파 겹침 예외에서 triangle 삭제. 출력에 `**대안 카운트**`·`**무효화 가격**` 필드 추가(필수). 근거 한 줄(Batchelor & Ramyar, 주관성). 복합 조정 표·세부 비율표는 압축 | ≤ 450 토큰 |
| strategies/fibonacci.md | support-resistance/fibonacci-retracement.md·fibonacci-extension.md 내용을 흡수. weight 0.65→0.5. "예측이 아니라 시장이 참조하는 레벨" 프레이밍 + Market Reference 인용 규칙 유지 | ≤ 700 토큰 |
| support-resistance/fibonacci-retracement.md, fibonacci-extension.md | **삭제** | — |
| strategies/multi-timeframe.md | 입력은 단일 시간대 — 하위·중간 시간대 필드(`**하위 시간대 타이밍**`, `**중간 시간대 셋업**`)와 그 예시 삭제. "상위 RSI>70이면 하위 매수 무시" 삭제(indicator-core의 강추세 규칙과 충돌). 출처 없는 "대부분의 손실 제거" 삭제. 남는 것: MA50/MA200·구조로 본 상위 추세 필터 + 정렬도 서술 | ≤ 350 토큰 |
| support-resistance/pivot-points.md | "전일 HLC 기반 장중 도구 — 일봉 이상에선 참고만" 명시, 압축 | ≤ 350 토큰 |
| indicators/ichimoku-cloud.md | `tier: always_on` → `gated`, `signal_kind: event`, `triggers: [ichimoku_cloud_breakout, ichimoku_cloud_breakdown]` | 변경 없음 |
| strategies/ma-cycle.md, macd-cycle.md | weight 0.8/0.75 → 0.55. 근거 한 줄(Sullivan 외). `ma-cycle`에 `category: neutral` 추가 | 유지 |
| indicators/smart-money-concepts.md | weight 0.8→0.5, "실무 프레임 — 통계 검증 미달" 한 줄 | 유지 |
| strategies/divergence.md | "RSI+MACD ~73% / 3종 ~78%" 등 승률 삭제, "MACD 다이버전스가 더 큰 움직임" 삭제, `1:2 R:R` 목표 삭제(수치 R:R 금지 규칙과 통일) | 축소 |
| strategies/breakout.md | "거짓 돌파 40-50% / 필터 후 25-35%" 삭제 → "패턴별 실패율은 해당 패턴 스킬 참조" | 축소 |

메모: SMC full guide는 이미 압축 노트로 대체돼 주입되므로 토큰 절감 대상이 아니다.

### 2.3 G3 — 탐지 중인 캔들 가이드 (skills/candlesticks/)

**기존 파일 수정**
- `engulfing.md` → `bullish-engulfing.md`(반전 63%) + `bearish-engulfing.md`(반전 79%)로 **분리**(두 방향이 가중치 밴드 2칸 차이). 기존 파일 삭제.
- `marubozu.md` 해석 재작성: "추세와 반대 색 장대봉 뒤 기존 추세 재개"(Bulkowski 8대 캔들 — 지속 53~56%, 10일 성과 상위). 같은 색 마루보주를 추세 확인으로 과대평가하지 않는다.
- `doji.md`에 `spinning_top` 트리거 추가(같은 우유부단 패밀리).
- 나머지 기존 캔들 파일: 반전율을 원문 값으로 확인·교체, weight를 아래 규칙으로 재산정.
- `_core/candle-primer.md`: core가 탐지하지 않는 "Three-method-style sequences" 언급 삭제.

**신규 파일(패밀리 단위, 이름·설명은 영문 — 기존 캔들 스킬 관례)**

| 파일 | triggers |
|---|---|
| piercing-dark-cloud.md | piercing_line, dark_cloud_cover |
| three-inside-outside.md | three_inside_up, three_inside_down, three_outside_up, three_outside_down |
| tweezers.md | tweezers_top, tweezers_bottom |
| abandoned-baby-tri-star.md | bullish_abandoned_baby, bearish_abandoned_baby, bullish_triple_star, bearish_triple_star |
| counterattack-belt-hold.md | bullish_counterattack_line, bearish_counterattack_line, bullish_belt_hold, bearish_belt_hold |
| gap-continuation.md | upside_gap_tasuki, downside_gap_tasuki, on_neck, in_neck |
| gap-two-crows-rabbits.md | upside_gap_two_crows, downside_gap_two_rabbits |
| advance-block-ladder-bottom.md | advance_block, ladder_bottom |

- 각 파일: `type: candlestick`, `category: neutral`, `gating: { tier: gated, signal_kind: event, triggers: [...] }`,
  본문 = 형태·맥락·Bulkowski 수치(페이지 링크)·AI 지시, 끝에 PROMPT_DIGEST(≤ 400 토큰).
- 트리거 이름은 core `CandlePattern`/`MultiCandlePattern` 라벨 그대로(검증기가 교차 확인).

**캔들 가중치 규칙** — 주장 방향의 반전(또는 지속)율:

| 비율 | weight |
|---|---|
| ≥ 75% | 0.75 |
| 65–74% | 0.65 |
| 55–64% | 0.55 |
| < 55% | 0.4 + 본문에 "무작위에 가까움" 명시 |

- 캔들 weight 상한 0.75(Marshall 외 2006 — 단독 초과수익 없음).
- 한 파일의 여러 라벨은 **가장 약한 라벨** 기준. 원문 수치를 못 찾으면 0.4.

### 2.4 G4 — 뉴스·펀더멘털 + 문서

**news/macro-impact.md**
- FOMC 표를 국면 조건부 규칙으로 교체: (a) 성장·생산성 견조 속 인상 — 금리↑와 주도주↑ 공존 가능,
  (b) 침체형 인상/동결, (c) 인하 + 커브 스티프닝 — 은행 NIM 개선(“인하=금융 피해” 단선 규칙 삭제).
- 추가 변수: PCE(연준 기준 지표), 관세·무역정책, AI 설비투자 사이클·메가캡 집중도, 기간 프리미엄·재정, 유가.
- "다음 FOMC·CPI 일정 언급" → **입력에 일정이 있을 때만**. 없으면 날짜를 만들지 말 것. Citi Surprise Index도 입력에 있을 때만.
- 크립토 문단: 달러·실질금리·유동성, 현물 ETF 자금 흐름, 스테이블코인 공급.
- 현재 금리 수준 등 시점 수치는 넣지 않는다(두 달이면 낡음).

**news/earnings-reaction.md**
- PEAD → "대형주에선 2006년 이후 사실상 소멸(Martineau 2022), 소형주·저커버리지에서만 약하게".
- Whisper를 옵션 IV로 추적한다는 주장, "공매도 급증 = 기관 Miss 예측" 삭제 → 옵션 **implied move 대비 실제 반응** 프레임 추가(입력에 있을 때만).
- 첫 줄: "실적이 없는 자산(암호화폐 등)에는 이 프레임을 적용하지 않는다."

**news/event-driven.md**
- PEAD 문장 교체(위와 동일).
- 지수 편입: "편입 초과수익 1990년대 7.4% → 최근 1% 미만(Greenwood & Sammon 2025) — 편입 뉴스 단독으로 큰 움직임 기대 금지".
- FDA ±50~100%/-50~70% → "단일 파이프라인 소형 바이오에 한정, 대형 제약은 훨씬 작다".
- 관세·수출 규제 항목 유지, 공급망 노출도 차별화 강조.

**fundamental/**
- growth-investing: Rule of 40(매출성장률% + FCF마진%), SBC(주식보상) 차감 FCF·희석률.
- quality-investing: gross profitability(매출총이익/총자산, Novy-Marx 2013). 출처 없는 "이탈율 <5%" 삭제.
- value-investing: EV/EBITDA "8~12배 통상 합리적" → "섹터·자기 과거 대비 상대 평가". "PBR<1 = 청산가치 이하" 옆에 "한국 상장사는 PBR<1이 흔함 — 밸류업 프로그램·지배구조 할인 맥락 고려". FCF yield 추가.

**문서**
- `skills/CLAUDE.md`: state pair 표를 검증기(`scripts/validate-skills.ts` `VALID_STATE_PAIRS`) 19개와 일치, 신호 카탈로그에 `bollinger_percentb_oversold/overbought` 추가, "~70 skills" 수치 갱신, 피보나치 병합 반영.
- `_core/indicator-core.md`: "every computed indicator" → "핵심 지표; 보조 지표(MACD-V·Connors RSI·Hurst 등)는 notable일 때 개별 가이드가 주입된다"로 정정(토큰 추가 없음).

### 2.5 i18n

- 한국어 `name`/`description`을 바꾸거나 지우면 `messages/{ko,en,ja,zh}.json`의 `shared.skillName`·`shared.skillDescription`
  키를 같이 바꾼다(키 = 원문, `.`은 `．`로 치환 — `toSkillDescriptionKey`). ko 값 = 원문, en/ja/zh = 번역.
- 삭제된 스킬(피보나치 되돌림·확장, engulfing)의 키는 4개 로케일에서 제거.
- 신규 캔들 스킬은 영문이라 i18n 불필요. 한국어 설명 변경은 꼭 필요한 파일로 한정해 churn을 줄인다.
- 완전성 테스트: `src/shared/i18n/__tests__/skillDescription.test.tsx`, `skillLabel.test.tsx`.
- 손으로 번역한 키는 `messages/_meta/hashes.json`도 갱신한다 — 키 `shared.skillName.<원문>` /
  `shared.skillDescription.<원문>`, 값 `sha1(ko 값)` 앞 12자(`scripts/i18n/translate.mjs`의 `hashOf`). 빠뜨리면 다음
  `i18n:translate` 실행이 그 키를 다시 번역한다. 삭제한 키의 해시도 지운다.
- `messages/*`는 병렬 작업자가 건드리지 않고 통합 단계에서 한 명이 일괄 수정한다(충돌 방지).

### 2.6 공통 규칙

- 본문을 바꾼 파일은 PROMPT_DIGEST를 **손으로 다시 쓴다**(자동 생성 금지). 병렬 작업 중엔 `yarn skills:digest-update`를
  실행하지 않고 통합 단계에서 한 번 실행한다.
- 가격·목표가·R:R을 모델이 계산하게 하는 문구 금지(기존 anti-fabrication 계약 유지).
- 출처 없는 퍼센트·승률 금지. 수치를 쓰면 출처(저자/페이지)를 같은 줄에.

## 3. 검증

- `yarn validate:skills`, `yarn skills:digest-verify`
- `yarn test src/entities/skill src/shared/i18n` (스코프), `npx tsc --noEmit`, `yarn i18n:verify`, `yarn lint`
- 상시 주입 합계: always_on 파일의 `token_cost` 합(뉴스·펀더멘털·SMC 제외) ≤ 7,000.
- `src/entities/skill/__tests__/api.test.ts`가 삭제·분리된 파일명을 참조하면 갱신.

## 4. 배포·캐시

- core 변경 없음. `hashSkillCatalog`은 name/gating/tokenCost를 해싱하므로 이 셋이 바뀐 스킬은 캐시 키가 바뀌고,
  본문만 바뀐 경우 분석 캐시 TTL 경과 후 반영(self-healing). `PROMPT_TEMPLATE_VERSION` bump 불필요.
- siglens-trader의 `skills/` 재동기화는 SP3 마지막 단계에서 한 번에.

## 5. 적용하지 않은 것

- 눌림목 스킬 변경 — 사용자 결정으로 유지.
- 새 탐지기(three methods, above the stomach, 3-line strike, rounding top, 채널, 갭, 52주 신고가 등), 뉴스 프롬프트
  매크로 캘린더 주입, 자산군별 스킬 필터, 시간대 기반 게이팅 — core 작업(SP2).
- 하모닉·Gann·울프 웨이브 — 검증 근거 없음, 추가하지 않는다.
- 엘리어트 완전 삭제 — 전략 카드 UI 유지를 위해 압축으로 대체.
