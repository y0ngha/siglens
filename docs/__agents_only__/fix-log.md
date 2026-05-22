
# Fix Log

## [PR #445 Round 3 | fix/analysis-snapshot-ui | 2026-05-22]
- S1: `src/components/analysis/AnalysisPanel.tsx` — `showStaleBanner` 파생 변수가 `captureNow` (useEffectEvent) + 새 `useEffect` 뒤에 위치해 MISTAKES.md §17 이상적 순서(derived → handlers → useEffect)와 어긋남. props/state만 의존하므로 핸들러·effect 앞으로 이동.
  - Rule: MISTAKES.md §17 — Hook 선언 순서.
- S2: `src/components/analysis/AnalysisPanel.tsx` — `<time aria-label="분석 완료 시각">`이 AT에 visible text(타임스탬프 값)를 덮어써 사용자가 실제 시각을 들을 수 없게 만듦. `aria-label` 제거. `<time dateTime={iso}>{formatted}</time>` 구조에서는 visible text가 SR로 그대로 읽혀 충분.
  - Rule: WCAG 4.1.2 (Name, Role, Value) — `aria-label`은 의미 명확하지 않은 비텍스트 요소용. text content가 이미 정확한 정보면 abuse.
- S3: PR diff 상의 "어차임" 오탈자는 워크트리 실제 파일에서 이미 "어차피"로 정상이라 코드 변경 없음. Reviewer가 본 diff 표시 오해로 추정.
- S4: `src/__tests__/components/analysis/StaleAnalysisBanner.test.tsx` — `fireEvent.click`(JSDOM이 disabled 버튼 동작을 완전 재현하지 않음) → `@testing-library/user-event`의 `userEvent.click`으로 마이그레이션. 비동기 setup 패턴(`userEvent.setup()` + `await user.click(...)`)을 적용해 실제 브라우저 동작과 일치하는 disabled 버튼 click 차단을 검증.
  - Rule: 회귀 신뢰도 — disabled 동작 같은 native 브라우저 동작은 userEvent로 검증해야 정확.
- S5: `src/__tests__/domain/analysis/staleThreshold.test.ts` — `15Min`/`30Min` 버킷에 boundary 케이스 누락. `15Min` beyond(+1min → true), `30Min` within(-1min → false)을 추가해 5분 임계값을 공유하는 세 단기 버킷 모두 회귀 안전망 확보.
  - Rule: MISTAKES.md §Tests — 임계값 버킷별 boundary 명시 검증.

## [PR #445 Round 2 | fix/analysis-snapshot-ui | 2026-05-22]
- B1: `src/components/analysis/AnalysisPanel.tsx` — round 1에서 hydration 회피를 위해 추가한 `useEffect` + `setNow(new Date())`에 `// eslint-disable-next-line react-hooks/set-state-in-effect`를 사용했음. MISTAKES.md §13(eslint-disable 사용 금지) + §10(setState in useEffect의 canonical fix는 `useEffectEvent`) 위반. `captureNow = useEffectEvent(() => startTransition(() => setNow(new Date())))` 패턴으로 변경하고 useEffect는 `captureNow()` 호출만. 동일 워크트리 `useChat.ts:382` / `useDMIChart.ts` 패턴과 일치.
  - Rule: MISTAKES.md §13 — eslint-disable 억제 금지. §10 — `setState in useEffect` canonical = `useEffectEvent` + 내부에서 setState (필요 시 `startTransition`).
- S1: `src/components/analysis/StaleAnalysisBanner.tsx` — `disabled` 버튼의 `title` 속성은 키보드 포커스 시 노출되지 않음(WCAG 2.4.7). `aria-describedby="stale-banner-cooldown-tooltip"`로 가리키는 `<span id role="tooltip" className="sr-only">` 보조 요소를 추가해 SR/키보드 사용자도 쿨다운 이유를 인지할 수 있게 함. `title`은 마우스 사용자 fallback으로 유지.
  - Rule: WCAG 2.4.7 (Focus Visible) / WCAG 4.1.2 (Name, Role, Value).
- S2: `src/domain/analysis/staleThreshold.ts` — `5Min`/`15Min`/`30Min`이 모두 5분 임계값을 공유하는 정책이 의도적임에도 코드만으로는 알 수 없어 reviewer가 Question 제기. `STALE_THRESHOLD_MS` 위에 WHY 주석(단기는 5분 일률, 중기는 30분, 장기는 4시간)을 추가해 정책 합의를 코드 옆에 명시.
  - Rule: FF Readability — non-obvious policy decision은 코드 옆 WHY 주석.

## [PR #445 Round 1 | fix/analysis-snapshot-ui | 2026-05-22]
- B1: `src/components/analysis/StaleAnalysisBanner.tsx` — `'use client'` 디렉티브 누락. `<button onClick={onReanalyze}>` 등록은 컨벤션상 클라이언트 경계 명시가 필수. async Server Component 트리에서 import 시 runtime 오류 위험. 파일 첫 줄에 `'use client';` 추가.
  - Rule: CONVENTIONS.md L306 (Registers event handlers → `'use client'` 필수), components/CLAUDE.md L15. Phase 2.4 라운드 1의 내부 review-agent 권고("leaf parent already client니까 불필요")가 컨벤션 문자 해석과 충돌했고, 외부 reviewer가 정확히 지적 — 컨벤션 우선으로 결정.
- B2: `src/domain/analysis/staleThreshold.ts` — `isAnalysisStale`의 `now: Date = new Date()` 기본 파라미터가 `Date.now()` 호출과 동등한 부작용. 도메인 순수 함수 규칙 위반. 기본값 제거 후 `now`를 필수 인자로 선언하고 호출부(`AnalysisPanel.tsx`)에서 `new Date()`를 명시 주입.
  - Rule: CONVENTIONS.md L397 (`No side effects: fetch, console.log, Date.now() are all prohibited` in domain layer).
- B3: `src/__tests__/domain/analysis/staleThreshold.test.ts` — 경계값 테스트에서 `4 * MS_PER_HOUR`를 로컬 재정의해 production `STALE_THRESHOLD_MS['1Day']`와 silent drift 가능. `STALE_THRESHOLD_MS`를 `staleThreshold.ts`에서 export하고 테스트는 직접 import해 임계값 변경을 자동 추적하도록 변경.
  - Rule: MISTAKES.md §Tests §4 — boundary 테스트 상수는 source에서 import (로컬 재정의 금지).
- B4: `src/components/analysis/StaleAnalysisBanner.tsx` — 툴팁 문자열이 `재분석은 5분에 한 번만 실행할 수 있어요.`로 하드코딩됐는데 `reanalyzeCooldownMs` prop이 실제 ms 정책을 담음. 정책 변경 시 UI 텍스트가 drift. `Math.ceil(reanalyzeCooldownMs / MS_PER_MINUTE)`로 분 단위를 계산해 템플릿 리터럴로 메시지 생성.
  - Rule: MISTAKES.md §15 drift trap — 상수와 표시 텍스트의 단일 source.
- S1: `src/components/analysis/AnalysisPanel.tsx` — `analysis.analyzedAt !== undefined` 두 곳을 truthy check `analysis.analyzedAt`로 단순화. `OptionsAiAnalysis.tsx`(ternary 패턴)와 표현 일관화.
  - Rule: FF Cohesion — 동일 의미는 동일 표현으로.
- S2: `src/components/analysis/StaleAnalysisBanner.tsx` — `mb-3` className 제거. 부모(`AnalysisPanel`)의 outer wrapper가 `flex flex-col gap-4`로 자식 spacing을 일괄 처리하므로 자식의 `mb-3`은 중복 spacing.
  - Rule: FF Cohesion — layout spacing single source of truth.
- S3: `src/components/analysis/AnalysisPanel.tsx` — SSR/hydration mismatch 회피. `isAnalysisStale`이 렌더 중 `new Date()`를 평가하면 서버 시각과 클라이언트 시각이 다를 때 임계값 근처에서 stale 판정이 갈리며 hydration warning 발생. `now: Date | null` state로 client mount 후에만 시각을 캡쳐하고 `analyzedAt` 변경 시 재캡쳐 (`useEffect` + `react-hooks/set-state-in-effect` disable + WHY 주석). 첫 SSR/hydration 동안 banner는 노출되지 않는다.
  - Rule: CONVENTIONS.md L374 (`new Date()` in Server Component → hydration mismatch).
- S4: `src/__tests__/domain/analysis/staleThreshold.test.ts` — 30분 임계값 버킷(`1Hour`/`4Hour`) 경계 회귀를 잡기 위해 within(`1Hour`, 29min ago → false), beyond(`4Hour`, boundary + 1min → true) 케이스 추가.
  - Rule: MISTAKES.md §Tests — 임계값 버킷별 boundary 명시 검증.
- S5: `src/components/analysis/StaleAnalysisBanner.tsx` — UI 메시지 두 종(`STALE_MESSAGE`, `REANALYZE_LABEL`)을 컴포넌트 내 상수로 추출. 향후 동일 메시지를 다른 위치(예: 토스트, 모바일 시트)에서도 사용할 때 content drift 방지의 기반.
  - Rule: 공통 UI 패턴 추출 시 message string은 상수로 통합.

## [PR #442 Round 5 | fix/oi-tooltip-floating | 2026-05-22]
- S1: `src/components/options/OpenInterestChart.tsx` — tooltip JSX 주석이 "`hidden`으로 숨겨 스크린리더가 대상을 찾되 시각적으로만 숨김"이라고 표기. 실제로 HTML `hidden` 속성은 접근성 트리에서도 완전히 제거함. 사실관계 정정: "screen reader도 참조를 따라올 수 없지만 하단 sr-only 테이블이 대체 제공하므로 pointer-only tooltip에선 허용 가능 트레이드오프"로 재작성.
  - Rule: MISTAKES.md §15.3 — 사실관계가 잘못된 주석은 미래 독자에게 오해를 준다.
- S2: 같은 파일 — `hoveredRow` 표현이 `||` 기반(`(hoveredIndex !== null && oiByStrike[hoveredIndex]) || null`)이라 row 객체 falsy 처리에 암묵 의존. `??` ternary(`hoveredIndex !== null ? (oiByStrike[hoveredIndex] ?? null) : null`)로 "배열 범위 초과 → null" 의도를 명시화.
  - Rule: CONVENTIONS.md FP — 의도가 명확한 표현 방식 선호.
- S3: `src/components/options/utils/computeTooltipPos.ts` (신규) + `src/__tests__/components/options/computeTooltipPos.test.ts` (신규) — pure 함수 `computeTooltipPos`와 tooltip 레이아웃 상수 6종을 별도 utility 파일로 분리하고 5건 단위 테스트 추가(가운데 정상 / 좌측 클램핑 / 우측 클램핑 / 상단 클램핑 / container 오프셋 상대좌표). OpenInterestChart.tsx는 named import로 전환.
  - Rule: CONVENTIONS.md Coverage Targets — pure utility functions may be freely tested. 클램핑 분기는 상수(TOOLTIP_HALF_WIDTH_PX 등) 변경 시 회귀가 즉시 잡히도록 명시 검증.

## [PR #442 Round 4 | fix/oi-tooltip-floating | 2026-05-22]
- B1: `src/components/options/OpenInterestChart.tsx` — `handlePointerEnter` / `handlePointerMove` / `handlePointerLeave` 세 핸들러가 파생 변수(`maxPainX`, `currentPriceX`, `peakOiLabel`)보다 앞에 선언됨. CONVENTIONS.md 처방 순서(`파생 변수 → 핸들러`)에 맞춰 핸들러를 `peakOiLabel` 뒤로 이동.
  - Rule: MISTAKES.md §17 — Hook 선언 순서: useState/useRef → useQuery/useMutation → useCallback/useMemo → 파생 변수 → 핸들러 → useEffect.
- S1: 같은 파일 — `TOOLTIP_HALF_WIDTH_PX = 90`이 className `min-w-[180px]`의 절반에 의존하지만 두 값이 별도라 한쪽만 바뀌면 클램핑 오작동. `TOOLTIP_MIN_WIDTH_PX = 180` single source of truth 도입 후 `TOOLTIP_HALF_WIDTH_PX = TOOLTIP_MIN_WIDTH_PX / 2`로 파생. className에서도 `min-w-[var(--tooltip-min-w)]` + style에 `--tooltip-min-w` 변수 주입해 한 곳에서 관리.
  - Rule: MISTAKES.md §15 / drift 방지 — 동일 값을 두 표현(상수 + 클래스 리터럴)에 중복하면 silent drift 위험.
- S2: 같은 파일 — `TOOLTIP_HALF_WIDTH_PX` 주석 첫 구절 "Tooltip의 가로 절반 너비" 제거. 상수명이 이미 표현. WHY(클램핑 용도)만 남김. S1과 함께 주석을 새 single source 의도("anchor 좌우로 절반씩 뻗으므로 절반 너비")로 재작성.
  - Rule: MISTAKES.md §15.3 — WHAT 코멘트 금지.

## [PR #442 Round 3 | fix/oi-tooltip-floating | 2026-05-22]
- B1: `src/components/options/OpenInterestChart.tsx` — Hook 선언 순서 재정정. CONVENTIONS.md 순서는 useState → useRef인데 R2에서 useRef를 먼저 선언해 두 번 반전됐다. useState 2개를 먼저, useRef 2개를 뒤로.
  - Rule: CONVENTIONS.md Custom Hook Declaration Order / MISTAKES.md §17. **이전 라운드(R2)에서 같은 룰에 대한 정정 → 부분 회귀**. 이번엔 useState → useRef 순서로 명확히 고정.
- B2: 같은 파일 — `{ x: number; y: number }` 인라인 객체 타입이 useState 타입 파라미터와 (R2의) `computeTooltipPos` 반환 타입 두 곳에 중복. 컴포넌트 위에 `TooltipPosition` 인터페이스를 추출해 모두 명명된 타입으로 통일.
  - Rule: MISTAKES.md TypeScript §5.3 — 함수 반환 타입과 상태 타입에 인라인 객체 리터럴 금지.
- S1: 같은 파일 — `computeTooltipPos`가 컴포넌트 상태/ref를 클로저하지 않음에도 컴포넌트 안에 정의돼 매 렌더마다 재생성. module-level 순수 함수로 추출.
  - Rule: MISTAKES.md §20 / CONVENTIONS.md FP — 클로저 의존이 없는 헬퍼는 module-level로.
- S2: 같은 파일 — `const rawX = event.clientX - rect.left` 위 "viewport 기준 좌표 → container 기준 좌표" 코멘트가 WHAT. 제거. 그 아래 클램핑 WHY 코멘트는 유지.
  - Rule: MISTAKES.md §15.3 — WHAT 코멘트 금지.
- S3: 같은 파일 — `as CSSProperties` safe-cast에 guarantee 주석 추가. CSS 커스텀 프로퍼티(--*)는 런타임 유효하지만 React `CSSProperties` 타입에 포함 안 되는 TS 한계 우회임을 명시.
  - Rule: MISTAKES.md TypeScript §7 — 모든 safe-cast `as`에 guarantee 주석 필수.
- S4: 같은 파일 — hit-rect의 `aria-describedby={TOOLTIP_ELEMENT_ID}`가 가리키는 tooltip div가 hover 시에만 조건부 렌더링되어 스크린리더가 anchor를 찾지 못함. tooltip div를 항상 DOM에 두고 비활성 시 `hidden` 속성으로 숨기는 WAI-ARIA tooltip 패턴 적용. 내부 컨텐츠는 hoveredRow가 있을 때만 렌더.
  - Rule: WAI-ARIA tooltip 패턴 — describedby anchor는 항상 DOM에 있어야 한다.

## [PR #442 Round 2 | fix/oi-tooltip-floating | 2026-05-22]
- B1: `src/components/options/OpenInterestChart.tsx` — Hook 선언 순서 위반. `useMemo`(derived)가 `useRef`(containerRef)/`useState`(hoveredIndex, tooltipPos)보다 먼저 선언돼 있었음. CONVENTIONS.md "Custom Hook Declaration Order"에 맞춰 useRef/useState를 함수 본문 최상단으로 끌어올리고 useMemo는 그 다음에 배치.
  - Rule: MISTAKES.md §17 / CONVENTIONS.md Custom Hook Declaration Order.
- B2: 같은 파일 — tooltip 위치를 인라인 style(`{ left, top }`)로 주고 있었음. CSS 커스텀 프로퍼티(`--tooltip-x`, `--tooltip-y`) + Tailwind arbitrary value(`top-[var(--tooltip-y)] left-[var(--tooltip-x)]`) 패턴으로 변환. `style` 객체는 `as CSSProperties` 단언이 필요해 React import도 갱신.
  - Rule: MISTAKES.md §19 — 동적 런타임 값도 CSS 커스텀 프로퍼티 + Tailwind arbitrary로 처리.
- B3: 같은 파일 — `role="tooltip"`만 있고 id 없음, hit-rect의 `aria-describedby`도 누락. `TOOLTIP_ELEMENT_ID = 'oi-chart-tooltip'` 상수로 anchor를 만들고 tooltip div의 `id`와 각 hit-rect의 `aria-describedby`에 연결.
  - Rule: MISTAKES.md Accessibility §3 — ARIA tooltip 패턴.
- B4: 같은 파일 — tooltip 위치 계산에 viewport 경계 체크 없음(`-translate-x-1/2 -translate-y-full`만 적용). `computeTooltipPos` 헬퍼 추가: 좌우는 `TOOLTIP_HALF_WIDTH_PX + TOOLTIP_VIEWPORT_PADDING_PX` 이내로 clamp, 상단은 `TOOLTIP_APPROX_HEIGHT_PX + offset` 이상으로 clamp.
  - Rule: MISTAKES.md UX §2 — Tooltip 위치 계산 시 뷰포트 경계 체크 필요.
- H1: 같은 파일 — `oiByStrike`가 만기 전환으로 짧아지면 `hoveredIndex`가 stale 상태로 남아 `hoveredRow.strike` 접근 시 런타임 에러 가능. `hoveredRow = (hoveredIndex !== null && oiByStrike[hoveredIndex]) || null` 패턴으로 인덱스 lookup 결과를 직접 정규화.
  - Rule: FF Predictability — 데이터 변경 사이의 stale state도 안전하게 처리.
- M1: 같은 파일 — `onPointerMove`에서 매번 `getBoundingClientRect()` 호출 → 마우스 빠르게 움직이면 reflow 폭증. `cachedRectRef`(useRef)로 enter 시점 한 번 측정 후 캐시; move는 캐시된 rect만 사용. touchmove 같은 enter-skip 경로엔 lazy 측정 fallback 추가.
  - Rule: 성능 — DOMRect 측정은 reflow를 강제하므로 mousemove 핸들러 안에서 반복 호출 금지.
- M2: 같은 파일 — tooltip 위치 계산의 매직 넘버 `8` (커서 위로 띄우는 오프셋) 등을 module-level 상수로 추출. `TOOLTIP_CURSOR_OFFSET_Y_PX`, `TOOLTIP_HALF_WIDTH_PX`, `TOOLTIP_VIEWPORT_PADDING_PX`, `TOOLTIP_APPROX_HEIGHT_PX` 4종.
  - Rule: MISTAKES.md §13 — 매직 넘버 module-level 상수 추출.

## [PR #442 Round 2 | fix/oi-tooltip-floating | 2026-05-22]
- B1: `src/components/options/OpenInterestChart.tsx` — Hook 선언 순서 위반. `useMemo`(derived)가 `useRef`(containerRef)/`useState`(hoveredIndex, tooltipPos)보다 먼저 선언돼 있었음. CONVENTIONS.md "Custom Hook Declaration Order"에 맞춰 useRef/useState를 함수 본문 최상단으로 끌어올리고 useMemo는 그 다음에 배치.
  - Rule: MISTAKES.md §17 / CONVENTIONS.md Custom Hook Declaration Order.
- B2: 같은 파일 — tooltip 위치를 인라인 style(`{ left, top }`)로 주고 있었음. CSS 커스텀 프로퍼티(`--tooltip-x`, `--tooltip-y`) + Tailwind arbitrary value(`top-[var(--tooltip-y)] left-[var(--tooltip-x)]`) 패턴으로 변환. `style` 객체는 `as CSSProperties` 단언이 필요해 React import도 갱신.
  - Rule: MISTAKES.md §19 — 동적 런타임 값도 CSS 커스텀 프로퍼티 + Tailwind arbitrary로 처리.
- B3: 같은 파일 — `role="tooltip"`만 있고 id 없음, hit-rect의 `aria-describedby`도 누락. `TOOLTIP_ELEMENT_ID = 'oi-chart-tooltip'` 상수로 anchor를 만들고 tooltip div의 `id`와 각 hit-rect의 `aria-describedby`에 연결.
  - Rule: MISTAKES.md Accessibility §3 — ARIA tooltip 패턴.
- B4: 같은 파일 — tooltip 위치 계산에 viewport 경계 체크 없음(`-translate-x-1/2 -translate-y-full`만 적용). `computeTooltipPos` 헬퍼 추가: 좌우는 `TOOLTIP_HALF_WIDTH_PX + TOOLTIP_VIEWPORT_PADDING_PX` 이내로 clamp, 상단은 `TOOLTIP_APPROX_HEIGHT_PX + offset` 이상으로 clamp.
  - Rule: MISTAKES.md UX §2 — Tooltip 위치 계산 시 뷰포트 경계 체크 필요.
- H1: 같은 파일 — `oiByStrike`가 만기 전환으로 짧아지면 `hoveredIndex`가 stale 상태로 남아 `hoveredRow.strike` 접근 시 런타임 에러 가능. `hoveredRow = (hoveredIndex !== null && oiByStrike[hoveredIndex]) || null` 패턴으로 인덱스 lookup 결과를 직접 정규화.
  - Rule: FF Predictability — 데이터 변경 사이의 stale state도 안전하게 처리.
- M1: 같은 파일 — `onPointerMove`에서 매번 `getBoundingClientRect()` 호출 → 마우스 빠르게 움직이면 reflow 폭증. `cachedRectRef`(useRef)로 enter 시점 한 번 측정 후 캐시; move는 캐시된 rect만 사용. touchmove 같은 enter-skip 경로엔 lazy 측정 fallback 추가.
  - Rule: 성능 — DOMRect 측정은 reflow를 강제하므로 mousemove 핸들러 안에서 반복 호출 금지.
- M2: 같은 파일 — tooltip 위치 계산의 매직 넘버 `8` (커서 위로 띄우는 오프셋) 등을 module-level 상수로 추출. `TOOLTIP_CURSOR_OFFSET_Y_PX`, `TOOLTIP_HALF_WIDTH_PX`, `TOOLTIP_VIEWPORT_PADDING_PX`, `TOOLTIP_APPROX_HEIGHT_PX` 4종.
  - Rule: MISTAKES.md §13 — 매직 넘버 module-level 상수 추출.

## [PR #441 Round 6 | fix/symbol-options-issues | 2026-05-22]
- S3: `src/__tests__/infrastructure/options/YahooOptionsAdapter.test.ts` — dedupe 테스트 제목이 "초기·추가 응답에 모두 있으면"이었지만 실제 시나리오는 초기 응답에 동일 만기가 두 항목으로 들어오는 케이스(추가 fetch 발생 안 함)였음. 제목을 "초기 응답 안에 동일 만기 항목이 중복될 경우 Map이 마지막 항목으로 dedupe한다"로 정정.
  - Rule: 가독성 — 테스트 제목과 실제 검증 시나리오 일치.

## [PR #441 Round 4 | fix/symbol-options-issues | 2026-05-22]
- B1: `src/__tests__/infrastructure/options/YahooOptionsAdapter.test.ts` — 새로 추가된 `missingIsos` 병렬 fetch / 실패 격리 / dedupe 분기가 기존 FULL_FIXTURE의 만기가 너무 가까워 한 번도 실행되지 않음. `mapExpirationsToSlots` mock과 함께 신규 it() 3건 추가(추가 fetch 병합 / 추가 fetch 실패 시 부분 누락 / 동일 만기 dedupe).
  - Rule: CONVENTIONS.md "infrastructure/ 100% (필수)", MISTAKES.md Infrastructure §2 — 모든 conditional branch는 dedicated test case가 있어야 한다.
- B3: `src/__tests__/infrastructure/options/YahooOptionsAdapter.test.ts` — `mapExpirationsToSlots`가 실제 구현으로 실행되면 `new Date()`에 의존해 테스트가 flaky. `jest.mock` 객체에 `mapExpirationsToSlots: jest.fn()`을 추가하고 beforeEach에서 기본값 `[]` 주입.
  - Rule: MISTAKES.md Tests §8.5 — 호출되는 외부 의존성은 모두 mock해야 한다. §14 — 시간 의존 함수는 명시적으로 mock해야 한다.
- S1: `src/infrastructure/options/YahooOptionsAdapter.ts` Yahoo Finance 병렬 호출을 sequential로 바꿀 것 — **거부**. 이유: 본 PR의 이슈 7(옵션 페이지 SSR 속도) 의도와 직접 충돌(wall-clock 6배), Yahoo는 MISTAKES.md §0.8 rate-limit 목록(FMP/Alpaca/Gemini) 미포함, 호출 수 ≤ 6의 사용자당 일회성 burst라 누적 부하 작음. 거부 사유는 PR #441 코멘트로 등록(comment 4511337388).
  - Rule: PR_FIX_FLOW §1-6 Reject #5 — Reviewer Lacks Project Context (PR이 명시적으로 해결하려는 다른 보고 사항과 충돌).

## [PR #441 Round 3 | fix/symbol-options-issues | 2026-05-22]
- B3: `src/app/[symbol]/options/loading.tsx` — Tailwind 동적 클래스 조합에 템플릿 리터럴(`` `bg-secondary-700 ... ${w}` ``) 사용. `cn()` 유틸로 교체.
  - Rule: MISTAKES.md §7.5 — Tailwind 클래스 결합은 반드시 `cn()` 사용; 템플릿 리터럴은 production tailwind purge가 인식 못하거나 우선순위 충돌을 일으킬 수 있다.


## [PR #440 Round 2 | fix/disable-cache-components | 2026-05-22]
- B1: `src/app/[symbol]/layout.tsx` + `SymbolLayoutClient.tsx` — `children`이 async RSC(`SymbolLayoutChrome`) 내부에 위치하여 `getAssetInfoCached` + `prefetchQuery(bars)` 완료까지 페이지 본문 LCP가 차단됨. 6ad891ff 리버트로 인해 master 패턴으로 회귀했으나, 해당 master 패턴은 cacheComponents 비활성 상태에서 streaming SSR LCP를 악화시킴. 수정: `children`을 Suspense 밖으로 빼고 `SymbolLayoutClient`를 `SymbolLayoutProviders`/`SymbolLayoutHeaderClient`/`SymbolLayoutFloatingChat` 3개로 분리. layout은 provider subtree 안에 chrome Suspense + children + FloatingChat Suspense를 형제로 구성.
  - Rule: vercel-react-best-practices `async-suspense-boundaries` — Suspense 경계는 페이지 본문이 layout 비동기 작업을 기다리지 않도록 chrome 단위로 좁혀야 함
- S1: `src/app/[symbol]/fundamental/fundamentalData.ts` + `news/newsData.ts` — `'use cache'` 제거로 인해 동일 요청 내 `getProfile`/`getNewsList` 등이 여러 호출 사이트(page 본문 + Section 내부)에서 중복 HTTP/DB 조회를 발생시킴. 수정: `react.cache`로 wrap하여 per-request memoization 적용 (cross-request 캐싱은 별개).
  - Rule: MISTAKES.md §6 — 데이터 페칭 helper에서 동일 요청 내 dedup이 명시적으로 보장되어야 함


## [PR #432 Round 4 | fix/cancel-job-on-page-unload | 2026-05-09]
- Violation: `route.ts` body validation used `!j.type` (falsy check only), allowing invalid type strings (e.g. `"unknown"`) to pass and silently return 204
  - Rule: Infrastructure Functions — validate all inputs at API boundaries; invalid values must return 400
  - Context: Added `VALID_JOB_TYPES` Set check so unrecognized job types are rejected with 400 rather than logged as a warning and treated as success

## [PR #432 Round 2 | feat/pagehide-cancel | 2026-05-09]
- Violation: None — review-agent approved with zero findings
- Rule: N/A
- Context: All round 1 findings fixed and approved; no additional issues identified in round 2.


## [PR #430 | feat/analysis-key-routing | 2026-05-08]
- Violation: `AnalysisGateBlockedResult` interface defined independently in 4 action files instead of being centralized in `byokGate.ts`
  - Rule: MISTAKES.md Architecture #1 — Shared infrastructure interfaces must be defined once in the module that owns them, not duplicated in consumers
  - Context: Each of the 4 action files redeclared the same interface with identical shape; moved to byokGate.ts as the single source of truth and re-exported from consumers
- Violation: `AnalysisGateErrorCode` type duplicated in `submitAnalysisAction.ts` despite already being defined in `byokGate.ts`
  - Rule: MISTAKES.md Coding Paradigm #6 — Repeating identical type/logic across modules without a shared source
  - Context: `buildGateError` was moved to byokGate.ts in a previous refactor but its dependent type was left behind as a stale duplicate; removed

## [PR #428 Round 16 | feat/per-stock-fear-greed-ui | 2026-05-08]
- S1: `src/components/symbol-page/hooks/useDefaultModelId.ts` JSDoc — `'모든 분석 탭(뉴스·펀더·종합·차트 패널 내 공포지수 카드)'` → `'AI 분석 탭(뉴스, 펀더멘털, 종합)'`. fear-greed는 AI 모델이 필요 없는 순수 산출(`computeFearGreedIndex`)이라 이 hook을 사용하지 않음. NewsAugment 제거 라운드에서 잘못 갱신된 주석을 정확한 소비자 목록으로 정정.
  - Rule: MISTAKES.md §11 — JSDoc에 명시된 소비자 목록과 실제 사용처 동기화
- S2 (skipped — oscillation): `UseFearGreedResult`를 `domain/types.ts`로 이동 또는 inline 선언 권고. Round 15에서 duplicate type 제거를 위해 peer hook에서 import 패턴을 채택했으므로 round 16의 권고는 직전 결정과 직접 충돌. PR이 APPROVED 상태이고 reviewer 자신이 "참고만"이라 명시 → 사용자 결정으로 skip.

## [PR #428 Round 14 | feat/per-stock-fear-greed-ui | 2026-05-08]
- B1: 4개 test 파일에서 `jest.mock`/`const` 뒤에 위치하던 import 문을 모두 최상단으로 이동. `import/first` 위반 정정. 영향 파일: `__tests__/components/chart/FearGreedHistoricalChart.test.tsx`, `__tests__/components/fear-greed/FearGreedPage.test.tsx`, `__tests__/components/symbol-page/{FearGreedCardMounted,FearGreedHeaderChipMounted}.test.tsx`. babel-jest의 `jest.mock` hoisting으로 동작은 동일.
  - Rule: CONVENTIONS.md ESLint Rules — `import/first`
- S2: `useFearGreedFromSymbol` shared hook 신규 추출. `FearGreedPage`, `FearGreedCardMounted`, `FearGreedHeaderChipMounted` 3곳의 동일 hook 체인(useBars + useFearGreed + DEFAULT_TIMEFRAME)을 단일 호출로 단순화. `FearGreedPage.test.tsx` mock도 `useFearGreedFromSymbol`로 교체.
  - Rule: MISTAKES.md §1 — 동일 패턴 3곳 추출 임계값 도달

## [PR #428 Round 12 | feat/per-stock-fear-greed-ui | 2026-05-08]
- B1: `SnapshotConfidence` 타입을 `src/lib/fearGreedLabels.ts` → `src/domain/types.ts`로 이동. lib/CLAUDE.md "타입은 lib에 두지 않는다" 규칙 위반(향후 hook이 lib에서 타입을 import하는 드리프트 통로 차단). `lib/fearGreedLabels.ts`는 `@/domain/types`에서 import.
  - Rule: lib/CLAUDE.md — cross-layer 공유 타입은 `domain/types.ts`에만
## [PR #428 SEO sweep | feat/per-stock-fear-greed-ui | 2026-05-08]
- C1: `src/lib/seo.ts` — fear-greed 신규 axis가 사이트 전반 SEO 표면(SITE_DESCRIPTION, ROOT_KEYWORDS, sibling helper)에 반영되지 않은 점 정리. SITE_DESCRIPTION 4축 확장(매수 분위기 절). ROOT_KEYWORDS에 공포 탐욕 지수, 투자 심리 지표, 주식 매수 분위기, Fear Greed Index, 뉴스 분위기, 주식 호재/악재/이슈, 실적 발표/일정 등 9개 추가, '뉴스 sentiment' 제거. news description은 sentiment → 호재 분위기, 이슈, 소식, 분석 의견 자연어 재작성, 어닝/실적 동반. fear-greed description은 jargon 제거 후 sibling 톤(매수세가 강한지 약한지 궁금할 때)으로 재작성. overall description에 단기 매수 분위기 절 추가. 5개 sibling title의 `·` 모두 자연어 punctuation(쉼표/와)로 교체.
  - Rule: 사용자 톤 가이드(자연어, 사람이 쓴 친근한 화법) + 가운뎃점은 일반 검색자가 입력하지 않는 punctuation.
- C1b: `.claude/product-marketing-context.md` — 4축 → 5축 업데이트, fear-greed first-class 추가, sitemap priority 표 sync, Stock-specific patterns 보강, SEO Keywords — Fear Greed (NEW) 섹션 추가.
- C2: `src/app/page.tsx` — Hero 카피 5축 확장, 홈 FAQ "지금 이 종목에 매수세가 강한지" 신규 Q + sentiment → 분위기, 어닝 → 어닝과 실적, HowTo "단기 매수 분위기 확인" step 신규 추가.
- C3: 4 symbol page — news Article JSON-LD 자연어, chart에 FAQPage(3 Q) 신규 추가, overall에 FAQPage(3 Q) 신규 추가 + guide section 4축 확장, fundamental FAQ 동종업계 비교 Q 추가(2 Q → 3 Q), fear-greed의 모든 `공포·탐욕`/`sentiment` → 자연어 교체.
- 어닝/실적 동반: 사용자 지시 — `${ticker} 어닝 일정`/`${ticker} 실적 발표`, `${koreanName} 어닝`/`${koreanName} 실적`, ROOT_KEYWORDS '실적 발표'/'실적 일정' 모두 동반 노출.

## [PR #428 Round 4 | feat/per-stock-fear-greed-ui | 2026-05-08]
- B1: `src/components/symbol-page/CrossLinkCards.tsx` — master 머지 conflict marker(`<<<<<<<`/`=======`/`>>>>>>>`) 미해소로 빌드 실패. 사용자 지시에 따라 `fundamental: '펀더멘털 분석'`(master 측) 채택 + `'fear-greed': '공포·탐욕 지수'` 보존.
  - Rule: 머지 conflict marker는 어떤 경우에도 커밋되어선 안 됨. TypeScript 파서가 인식 불가 → 컴파일 실패.
- B2: `src/components/fear-greed/FearGreedComparisonGauges.tsx`, `FearGreedHero.tsx` — 상대 경로 `'./FearGreedGauge'` → path alias `'@/components/fear-greed/FearGreedGauge'`.
  - Rule: MISTAKES.md §7.6 / Components §0.1 — import는 `@/` path alias만 사용. 상대 경로 금지.
- S2: `src/components/fear-greed/SelfNormWarningBadge.tsx` — `aria-live="polite"` 제거. `role="status"`가 WAI-ARIA 명세상 `aria-live="polite"`를 묵시적으로 포함.
  - Rule: 중복된 ARIA 속성 제거 — implicit semantic은 명시하지 않음.

## [PR #426 Round 1 | feat/fundamental-info-tooltips-mobile-fixes | 2026-05-07]
- B1: `ValuationCard.tsx`, `ProfitabilityCard.tsx`, `FinancialHealthCard.tsx`, `FutureDirectionCard.tsx` — `'use client'` 불필요하게 추가됨. RSC가 Client Component 자식을 렌더링할 때 부모에 `'use client'`가 필요 없음. 4개 파일에서 모두 제거.
  - Rule: `'use client'`는 해당 컴포넌트 자체가 hooks/event handler/browser API를 사용할 때만 선언. Client Component를 import하는 RSC 부모는 directive 불필요.
- S1 (적용): `FutureDirectionCard.tsx` — '컨센서스' 목표주가 항목 툴팁을 `'애널리스트 목표주가 하단·중앙·상단 범위'` → `'애널리스트 목표주가 평균치'`로 변경. 기존 설명이 '컨센서스' 단일 항목이 아닌 전체 범위를 설명하는 오류.
- S2 (거부): `globals.css` `overflow-x: hidden` — iOS Safari layout viewport 확장 버그 대응 의도적 수정. sticky header는 y축만 사용, 자식 스크롤 컨테이너는 독립 overflow-x 설정.
- S3 (거부): `SymbolLayoutHeader.tsx` `z-50` — Tailwind z-index 스케일 유틸리티 클래스. 매직 넘버 아님. vaul Drawer.Content(z-40) 위에 헤더를 올리기 위한 의도적 값.

## [PR #423 Round 7 (S2) | feat/news-thinking-budget-and-refresh | 2026-05-07]
- S2: `src/components/news/hooks/useNewsPollingWithInvalidation.ts` 신규 훅 생성. `useQueryClient` + 캐시 무효화 로직을 `NewsList.tsx`에서 분리. `NewsList`는 `useNewsPollingWithInvalidation` 단일 호출로 단순화(useState 2개만 유지). `NewsList.test.tsx` mock 대상도 함께 교체(`useNewsCardPolling` → `useNewsPollingWithInvalidation`).
  - Rule: 단일 책임 — 컴포넌트는 렌더링에 집중, React Query 캐시 무효화 결정은 전용 훅으로 분리

## [PR #423 Round 6 | feat/news-thinking-budget-and-refresh | 2026-05-07]
- S1 (부분 적용): `ensureNewsCardsAnalyzedAction.ts` — `thinkingBudget: 0` → `DISABLED_THINKING_BUDGET` 로컬 상수로 추출. `'use server'` 파일은 async function만 export 가능하여 test import 동기화 불가. GitHub 코멘트로 제약 사유 설명.




## [PR #422 Round 2 | fix/post-9e88a2f9-audit | 2026-05-07]
- S3: `src/components/chat/hooks/useChat.ts` `MODEL_STORAGE_KEY` export + `useChat.test.tsx`에서 로컬 재정의 제거 후 import.
  - Rule: MISTAKES.md Tests 13 — 테스트는 production 코드를 직접 import해 검증
- S4: `src/components/news/NewsAiSummary.tsx` `useMemo` 본문 내 dead code 위치 주석을 호출 앞 docblock에 통합.
  - Rule: 주석은 실행 흐름이 도달하는 위치에 둔다
- S5 (skipped — 이전 라운드 결정): `useSelectedModel.ts` `eslint-disable` 근본 수정은 별도 이슈로 트래킹.



## [PR #420 Round 8 | master | 2026-05-05]
- B3: `registerAction.test.ts` `expect.anything()` → `expect.objectContaining({ emailTokens, db })` 명시 검증. db mock에 `transaction` 함수 추가.
  - Rule: 의존성 주입 검증 — db 인자 포함 여부 명시

## [PR #420 Round 6 | master | 2026-05-04]
- B2: `PolicySection.tsx`의 `export type { TocItem }` backward-compat re-export 제거. `LegalPageShell.tsx`가 `@/lib/legal-toc`에서 직접 import하도록 변경.
  - Rule: CLAUDE.md — 역호환 re-export 금지
- S1: `consume` 비원자적 get+del → `client.getdel()` 단일 원자 연산으로 교체. 테스트 mock에 `getdel` 추가.
- S2: `[WebkitTapHighlightColor:transparent]` → `[-webkit-tap-highlight-color:transparent]` (Tailwind arbitrary 벤더 접두사 소문자 하이픈)

## [PR #420 Round 5 | master | 2026-05-04]
- S1: `finalizeOAuthSignupAction.ts` — 소비처 없는 `export type { FinalizeOAuthSignupState }` re-export 제거 (YAGNI).

## [PR #420 Round 3 | master | 2026-05-04]
- S1: `route.ts` GET handler — `pendingStore.save()` not wrapped in try-catch. Redis failure would cause unhandled 500. Wrapped in try-catch, redirects to `oauth_unknown` on failure (consistent with existing error handling pattern).

## [PR #420 Round 2 | master | 2026-05-04]
- S1: Replaced custom `slugify` in `legal-toc.ts` with `github-slugger` (already transitive dep). Added `transformIgnorePatterns` to `jest.config.js` to handle ESM-only package.

## [PR #420 Round 1 | master | 2026-05-04]
- B6: `[...versions].sort()` — spread was unnecessary since `toSorted()` doesn't mutate. Changed to `versions.toSorted()`.
- B7: `legal-toc.ts` used imperative `for + push` — refactored to declarative `map`.
- Fix: `consent/page.tsx` had `export const dynamic = 'force-dynamic'` incompatible with `cacheComponents: true`. Removed — searchParams already makes page dynamic.
- Fix: `privacy/page.tsx`, `terms/page.tsx` — DB access in async page component triggers "Uncached data outside Suspense" with `cacheComponents: true`. Split into inner async components wrapped in Suspense.

## [PR #417 Round 5 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: 워크트리 \`CLAUDE.md\` 갱신 누락 — R4 fix-log에 갱신 완료로 기재되어 있으나 실제로는 main 레포의 CLAUDE.md만 수정되어 있고 워크트리의 같은 파일은 옛 내용("infrastructure ← May import from domain only")을 그대로 갖고 있었다
- Rule: 변경 사항은 실제 commit 대상(워크트리)의 파일에 적용해야 함
- Context: R4에서 절대경로로 \`/Users/y0ngha/Project/siglens/CLAUDE.md\`(메인 레포)를 수정해 워크트리의 같은 파일은 미반영. 워크트리의 \`CLAUDE.md\`도 동일하게 \"May import from domain and lib (lib must be pure utilities/constants only)\"로 갱신.

## [PR #417 Round 4 | worktree-seo-overhaul-49 | 2026-05-04]
- Doc policy update (REJECTED B1 → 문서 수정으로 처리): `infrastructure ← lib` 금지 규칙 완화
- Rule: ARCHITECTURE.md, CLAUDE.md(root), src/lib/CLAUDE.md 일괄 갱신
- Context: lib/og.ts에 색상/레이아웃 순수 상수만 두고 사이드 이펙트 함수(loadKoreanFont)는 R2에서 이미 infrastructure로 옮겼다. 그러나 색상 상수는 lib에 남아 infrastructure(buildSymbolOgImage.tsx)에서 import해야 했고, 이는 기존 "infrastructure ← domain only" 규칙 위반. 사용자 결정으로 규칙을 "infrastructure ← domain + lib (lib must be pure utilities/constants only)"로 명시 완화. 단 cross-layer 타입은 여전히 domain/types.ts에만 두기로 유지(hook 측 import 경로 보호).

- Doc policy clarification (REJECTED B3 → 문서 수정으로 처리): MISTAKES.md #0 적용 범위 명시
- Rule: MISTAKES.md #0 (Non-component function or Route Handler missing explicit return type)
- Context: 사용자 의도는 "순수 함수/로직 함수"의 반환 타입 명시였고, Next.js 파일 컨벤션(page.tsx, layout.tsx, opengraph-image.tsx, sitemap.ts, robots.ts, manifest.ts 등)은 Next가 시그니처를 보장하므로 예외라는 점을 문서화. 룰 제목과 본문 모두 "Pure function or logic-bearing function" + 예외 목록으로 갱신.

- Suggestion S2 적용: SymbolPageClient bottomSlot 주석 WHAT → WHY로 교체
- Rule: 주석은 코드로 자명하지 않은 이유를 적는다
- Context: "차트 컨테이너 아래에 렌더" → "서버 컴포넌트가 SEO용 cross-link를 주입하기 위한 슬롯".

## [PR #415 Doc Policy Removal | chore/upgrade-siglens-core-0.7.3 | 2026-05-04]
- Policy removed: MISTAKES.md Documentation Sync 규칙 4 (다중 라인 JSDoc 금지) — PR #415 review comments triggered by this rule were rejected; rule removed per user decision
- Context: Three review comments (Blockers #3178568999, #3178569205 and Suggestion #3178569415) cited the multi-line JSDoc policy. User decided the policy was overly restrictive; removed from MISTAKES.md.

## [chore/upgrade-siglens-core-0.7.3 | Round 1 | 2026-05-04]
- Violation: None — review-agent approved with zero findings
- Rule: N/A
- Context: Branch upgrades @y0ngha/siglens-core from 0.7.2 to 0.7.3 and applies five fixes for consumer-side breakages (useOverallAnalysis limit_error case, submitOverallAnalysisAction newsItems rename, chatAction key semantics, router comment). All changes approved on round 1.

## [Task 2.11 | feat/fundamental-news-analysis | 2026-05-02]
- Violation: OverallContent.tsx used `style={{ width: '...' }}` inline for skeleton widths
- Rule: MISTAKES.md rule 7 — Never use inline style for layout/styling; use CSS custom property + Tailwind pattern
- Context: Changed to `style={{ '--skeleton-w': '...' } as CSSProperties}` + `className="w-[var(--skeleton-w)]"`.

## [PR #405 Round 2 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: tokenEncryption.ts 헤더 문구에 "sync obligation" 언급 (Phase 6 완료했으므로 불필요)
- Rule: Phase 6 마이그레이션 완료 후 더 이상 siglens-core와의 동기화 의무 없음 — 헤더를 과거시제로 갱신
- Context: tokenEncryption.ts의 "Sync obligation" 문구를 "Phase 6 of the scope-realignment refactor moved the DB layer fully into siglens"로 변경; 동기화 명령문 제거.

## [PR #389 round 2 | feat/369/auth-email | 2026-04-28]
- Violation: Next.js error.tsx 컴포넌트 props 인터페이스에 `error: Error & { digest?: string }` 누락
- Rule: Next.js App Router 컨벤션 — error.tsx는 프레임워크가 `error`와 `reset` 두 prop을 모두 전달하므로 인터페이스에 양쪽 다 선언 필요
- Context: src/app/login/error.tsx가 reset만 prop으로 선언하고 error를 누락. 표시에 사용하지 않더라도 타입 안전성을 위해 선언 추가.


## [PR #384 Round 2 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: WHY 주석 삭제 — EMA index 매핑 및 SQUEEZE_MOMENTUM_MIN_BARS 알고리즘 유도 주석 제거
- Rule: CLAUDE.md 코멘트 규칙 ("WHY is non-obvious" 주석은 유지)
- Context: 마이그레이션 과정에서 비자명 인덱스 매핑 주석(20-period EMA, 60-period EMA)과 알고리즘 유도 주석(2*kcLength-1 이유)이 삭제됨. 독자가 EMA_DEFAULT_PERIODS를 열어봐야만 확인 가능한 숨겨진 매핑이므로 반드시 유지해야 함.

## [Round 1 — Skipped findings]
- `src/app/[symbol]/page.tsx:144` and `src/app/market/page.tsx:13` (recommended): RSC에서 siglens-core 함수를 직접 호출하는 패턴은 기존 관례이며 이번 PR이 도입한 변경이 아님. RSC는 underlying async 함수를 직접 호출하고, 클라이언트용 Server Action wrapper는 별도 hook 경로로 사용하는 분리 패턴이 의도됨. PR 범위 밖이므로 skip.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: OAuth 콜백에서 쿠키에 저장된 next 경로를 검증 없이 그대로 redirect로 사용
- Rule: Open Redirect 방어 — 사용자 변조 가능 입력은 사용 시점마다 sanitize (defense-in-depth)
- Context: state 쿠키는 HMAC 서명 없이 base64url JSON으로만 저장되므로 next 값이 변조 가능. /start에서 한 번 sanitize했더라도 콜백에서 redirect 직전에 sanitizeNextPath를 다시 적용해야 안전.



## [PR #395 Round 4 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: code 단계에서 동일한 codeState.error.message가 AuthErrorAlert와 AuthFieldGroup.error prop 두 곳에 동시 표시
- Rule: 동일 정보를 두 채널로 동시 노출하지 않음 — 하나의 에러는 하나의 UI 위치에서만 표시
- Context: SignupForm.tsx code phase에서 AuthErrorAlert와 AuthFieldGroup error prop에 모두 codeState.error.message를 전달하여 사용자에게 동일 에러가 중복 노출됨. AuthFieldGroup error prop 제거로 AuthErrorAlert 단일 표시로 통일.
## [PR #391 코멘트 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: describe 레이블과 실제 테스트 케이스 의미 불일치
- Rule: MISTAKES.md Tests #9 — describe 텍스트는 내부 it()들의 공통 전제조건만 커버해야 함
- Context: describe('이메일 검증 (email_mismatch)') 블록 안에 이메일이 일치하여 성공하는 케이스가 포함됨. 별도 describe('이메일 정규화') 블록으로 분리.



## [PR #393 | feat/388/비밀번호-재설정-ui | 2026-05-01]
- Violation: 동기 토큰 생성/해시 함수 테스트에서 불필요한 await 사용
- Rule: 테스트는 실제 함수 계약을 반영해야 하며 동기 API를 비동기처럼 보이게 작성하지 않는다
- Context: passwordResetTokenService 테스트가 string을 반환하는 generatePasswordResetToken/hashPasswordResetToken 호출에 await를 붙여 API 성격을 흐리게 했음. await와 async 테스트 선언을 제거.

## [PR #403 | feat/398/contact-us-form | 2026-05-01]
- Violation: cn()을 aria-describedby ID 조합에 오용
- Rule: cn()은 Tailwind 클래스 병합 전용 유틸리티로 ARIA ID 문자열 조합에 사용 금지
- Context: ContactTextareaField의 aria-describedby 값 조합에 cn()을 사용. 배열 filter+join 방식으로 교체.


## [PR #405 follow-up | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: future siglens work risked re-introducing analysis logic locally instead of in siglens-core
- Rule: SCOPE.md §3 (dependency direction) — analysis secret sauce stays in core
- Context: added siglens-side §0 work-boundary checklist + CLAUDE.md cross-repo scope guard so that analysis-related task descriptions trigger an explicit redirect-or-confirm step before any code is written.

## [PR #413 R8 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: SymbolTabsSkeleton.tsx nav element had both `aria-hidden="true"` and `aria-label="분석 종류"`
- Rule: MISTAKES.md Accessibility 1.5 — aria-hidden removes element from a11y tree; aria-label on hidden element is meaningless
- Context: Removed aria-label since aria-hidden="true" already hides from screen readers.


## [PR #413 R10 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: FinancialHealthCard had nested ternary (3 levels) for conditional BadgeVariant class assignment
- Rule: MISTAKES.md Coding Paradigm 7 — Nested ternaries 3+ times; extract to helper or declarative map
- Context: Replaced with `BADGE_VARIANT_CLASS: Record<BadgeVariant, string>` object map + extracted `BadgeVariant` type alias per CONVENTIONS.md declarative paradigm.


## [PR #413 R12 | feat/fundamental-news-analysis | 2026-05-03 — Deferred]
- Question: Hooks importing infrastructure (useFundamentalAnalysis, useNewsAnalysis, useOverallAnalysis, useNewsAugment)
- Rule: CLAUDE.md hook→infrastructure imports limited to queryFn/mutationFn or useActionState Server Action connection
- Context: Current code uses useEffect polling state machines instead of Server Action callback. Architecture sufficient for async job-poll pattern (polling model was intentional design choice for stale background analysis). Deferred to separate cleanup pass requiring architectural rework not warranted in this PR scope.

## [PR #413 R15 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: useAnalysis.ts: eslint-disable react-hooks/set-state-in-effect with poll useEffect pattern reverted to poll-async-IIFE + cooldown async-IIFE useEffect
- Rule: MISTAKES.md #13 — eslint-disable suppresses lint warnings instead of fixing root cause; restructure code to eliminate the warning
- Context: Partial React Query refactor reverted; poll/cooldown use async-IIFE patterns where setState happens inside callback, not synchronously in effect body. Pattern does not trigger rule because setState is wrapped in async callback scope.

## [PR #413 R18 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: NewsDisplayItem.sentiment and .category were `string | null`, losing type safety
- Rule: MISTAKES.md TypeScript 7 — Using `as` type assertions instead of type guards; DB columns backed by domain enums must be cast at repository boundary
- Context: Now typed `NewsSentiment | null` / `NewsCategory | null` from @y0ngha/siglens-core with trust model comment in toNewsRow: "DB는 sentiment/category를 raw text로 저장하므로 LLM 결과를 신뢰해 좁혀준다."
## [Phase 7 OAuth Consent Flow | Spec compliance R2 | 2026-05-04]
- Violation: finalizeOAuthSignupAction.ts variable `let createdUserId` may be uninitialized from TypeScript perspective when returned
- Rule: MISTAKES.md Coding Paradigm 0 — Non-null return type implies value is always assigned; use const + ternary/null coalescing
- Context: Must guarantee createdUserId is assigned before return in all code paths.


## [PR #420 Round 16 | master | 2026-05-05]
- S2 (skipped — intentional design): `registerUser.ts` DI pattern (`createTransactionalRepositories` factory) — reviewer noted "현 설계가 의도적이라면 pass". Confirmed intentional, skipped.

## [Phase 7 OAuth Consent Flow | Code quality R1 | 2026-05-04]
- Violation: route.ts cast comment inaccurate — stated narrowing was "isOAuthProvider narrows profile.provider" when actually narrowing URL param
- Rule: Narrowing guard comments must accurately describe which variable is being constrained
- Context: Comment should explain that isOAuthProvider checks the URL param, not a profile field.

## [Multi-domain audit + 7-task patch | Round 2 (approved) | 2026-05-07]
- B3: `src/__tests__/components/chat/hooks/useChat.test.tsx:79` — ESLint react/display-name error: anonymous component returned from makeWrapper(). Fixed by giving it a named function declaration TestQueryWrapper.
  - Rule: MISTAKES.md Components Rule 9 — Custom hooks in test wrapper components must have display name
- B4: `src/__tests__/components/chat/hooks/useChat.test.tsx:107` — test failed because lastWrittenModelRef started as null and triggered redundant write-back of stored model on hydration. Fixed by initializing the ref to stored value in useChat.ts hydration effect before flipping isModelHydrated.
  - Rule: MISTAKES.md Components Rule 12 — Internal refs affecting state must be initialized before first use to prevent stale state propagation


## [PR #433 round 2 | feat/bot-redis-trigger-block | 2026-05-11]
- Violation: Shared helper class placed at component-folder root instead of an exception/utility subfolder
- Rule: components/CLAUDE.md folder structure — non-component, non-hook helpers belong in a dedicated subfolder (here: `exceptions/`); user requested `src/components/symbol-page/exceptions/` specifically for this case
- Context: Blocker 1 — `BotBlockedError` was at `src/components/symbol-page/BotBlockedError.ts`; moved to `src/components/symbol-page/exceptions/BotBlockedError.ts` and updated 3 hook imports (fundamental/news/overall).
- Violation: New dependency passed to a function is not asserted in the test call chain
- Rule: Tests — when an Action gains a new parameter forwarded to a dependency, the test must explicitly assert that the parameter is received and that both true/false branches are covered
- Context: Blocker 2 — 4 Server Actions started passing `skipEnqueueIfMiss` to siglens-core submit functions, but no test asserted it. Added bot-UA and non-bot-UA cases (2 each × 4 Actions = 8 new tests) using `mockHeaders.mockResolvedValueOnce(new Headers({...}))` to control isBot, and `expect.objectContaining({ skipEnqueueIfMiss: <bool> })` on the submit mock.




## [PR #446 Round 3 | fix/options-oi-stale-fraction | 2026-05-22]
- Violation: 동일 값(`allContracts.length`)을 같은 함수 안에서 두 번 접근
- Rule: MISTAKES.md §2 — Identical values queried or computed multiple times → Extract to a local const
- Context: Suggestion — `isOpenInterestSnapshotStale` 안 `allContracts.length`가 가드와 나눗셈 두 곳에서 사용. `const totalCount = allContracts.length` 로 추출.
- Violation: `reduce`로 합산 후 `=== 0`만 확인 — sum 값이 버려져 의미가 흐려지고 short-circuit 기회를 놓침
- Rule: 의미 정합성 — "모두 0인가" 는 합산이 아닌 `.every()`로 표현해야 의도가 직접 드러나고 첫 비-zero에서 short-circuit
- Context: Suggestion — `OpenInterestChart.tsx` `oiByStrike.reduce(sum, 0) === 0` 가드를 `oiByStrike.every(s => s.callOpenInterest === 0 && s.putOpenInterest === 0)` 으로 교체.


