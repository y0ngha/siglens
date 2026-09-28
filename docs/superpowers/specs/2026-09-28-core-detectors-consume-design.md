# 2026-09-28 새 core 탐지기·매크로 캘린더 소비 (SP3)

SP1(`2026-09-28-skills-evidence-refresh-design.md`) 위에 쌓는다. core SP2-A(`feat/pattern-signal-expansion`)·SP2-B
(`feat/news-macro-calendar`)가 릴리스된 core 버전을 소비한다.

## 0. 결론

| 축 | 변경 |
|---|---|
| core | `@y0ngha/siglens-core` 버전 bump (SP2-A + SP2-B 포함 릴리스) |
| 검증기 | `scripts/validate-skills.ts` `SIGNAL_CATALOG` += `new_52w_high`, `new_52w_low`, `gap_up`, `gap_down`; `PATTERN_TRIGGER_CATALOG` += 5개 id |
| 신호 라벨 | `SignalBadge.tsx`·`backtest-case/lib/tags.ts`의 `Record<SignalType, …>` + `messages` `shared.enumLabel.signalType.*` 4개 로케일 + hashes |
| 매크로 캘린더 | 단일 헬퍼 `loadNewsMacroCalendar()`(US·High impact·[오늘−2일, 오늘+14일], 실패 시 `[]`)를 **모든** `runNewsAnalysis`/`runOverallAnalysis` 호출처에 전달 — 캐시 키 일치 불변식 |
| 새 스킬 | 패턴 5, 캔들 3(영문), 전략 2 |
| 코어 문서 스킬 | pattern-index에 새 패턴 5줄, candle-primer에 three methods 복원 |
| i18n | 새 한국어 스킬 이름·설명 4개 로케일 + hashes |

## 1. 매크로 캘린더 호출처 (전부 같은 헬퍼)

- `src/entities/news-article/actions/submitNewsAnalysisAction.ts`
- `src/entities/news-article/api.ts` (`runNewsAnalysis`)
- `src/entities/analysis/actions/runOverallAnalysisAction.ts`
- `src/entities/analysis/api.ts` (`runOverallAnalysis`)
- `src/app/api/analysis/stream/runAnalysisBridge.ts` (news·overall)

헬퍼 위치: `src/entities/economy/`(서버 전용, `getEconomyProvider().getCalendar(from, to)` → `impact === 'High'` 필터 → 날짜 오름차순).
날짜 창은 서버 시각 기준 UTC 날짜. 같은 날 같은 입력이 나오도록 조회 결과를 짧게 캐시(기존 economy 캐시 레이어가 있으면 재사용).

## 2. 새 스킬

| 파일 | name | gating | weight 근거 |
|---|---|---|---|
| patterns/rounding-top.md | 원형천장 | event [rounding_top] | Bulkowski rounding tops |
| patterns/high-tight-flag.md | 하이 타이트 플래그 | event [high_tight_flag] | Bulkowski HTF |
| patterns/ascending-channel.md | 상승 채널 | event [ascending_channel] | 채널 — Bulkowski 통계 없으면 0.5 + 명시 |
| patterns/descending-channel.md | 하락 채널 | event [descending_channel] | 동일 |
| patterns/broadening-formation.md | 확장형 패턴(브로드닝) | event [broadening_formation] | Bulkowski broadening tops/bottoms |
| candlesticks/stomach.md | Above/Below the Stomach Guide | event [above_the_stomach, below_the_stomach] | Bulkowski 66% (above) |
| candlesticks/three-line-strike.md | Three-Line Strike Guide | event [bullish_three_line_strike, bearish_three_line_strike] | Bulkowski 65% / 84% (측정 방향 — core trend 매핑과 일치) |
| candlesticks/three-methods.md | Rising/Falling Three Methods Guide | event [rising_three_methods, falling_three_methods] | Bulkowski |
| strategies/52-week-high-momentum.md | 52주 신고가 모멘텀 | event [new_52w_high, new_52w_low] | George & Hwang(JF 2004) + Minervini 트렌드 템플릿(실무) |
| strategies/gap-analysis.md | 갭 분석 | event [gap_up, gap_down] | 갭 유형(breakaway/runaway/exhaustion) 서술, "갭은 반드시 메워진다" 속설 배제 |

- 가중치 규칙은 SP1 §2.1(패턴)·§2.3(캔들) 그대로. 전략 스킬은 근거 강도로: 52주 0.65, 갭 0.45.
- 패턴 스킬은 기존 패턴 파일 구조(Detection/Grading/Confirmation/False positives/Geometry/Output) 그대로, geometry 정의는 core `patternGeometry.ts` 실제 정의와 일치.

## 3. 검증

`yarn validate:skills`, `yarn skills:digest-verify`, `yarn i18n:verify`, 스코프 테스트(엔티티 economy/news-article/analysis, dashboard SignalBadge, backtest-case tags, skill, i18n), `npx tsc --noEmit`, `yarn lint`.

## 4. 후속

siglens-trader `skills/` 재동기화(별도 PR).
