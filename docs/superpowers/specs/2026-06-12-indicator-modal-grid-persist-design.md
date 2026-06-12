# 보조지표 모달 — 그리드 레이아웃 + 선택 영속 설계

- **작성일**: 2026-06-12
- **상태**: 설계(사용자 직접 지시 기반), 구현 진행
- **브랜치**: `feat/indicator-modal-grid-persist` (base: `master` = 보조지표 렌더링 9-PR 머지본, core 0.21.1)

## 1. 배경 / 문제

보조지표 렌더링 스택 머지 후 실증 중 사용자가 발견한 두 UX 문제:
1. **모달이 너무 김** — 34개 지표가 카테고리별 **단일 세로열**(`flex flex-col`)로 쌓여, 특히 모바일에서 모달이 화면을 넘겨 가려진다.
2. **영속 없음** — `useIndicatorVisibility`·overlay 훅·MA/EMA period 모두 `useState`만 사용 → **새로고침하면 선택이 전부 초기화**된다. 사용자는 선택/해제가 새로고침 후에도 유지되길 기대.

## 2. 요구사항 (사용자 지시)

- 모달 체크리스트를 **그리드(가로·세로 2D)** 배치 — 길이를 줄여 모달이 가려지지 않게. **모바일** 포함.
- 선택 **자동 영속**(즉시 적용 + localStorage, 별도 저장 버튼 없음). 새로고침·재접속 후 복원.
- **검증 매트릭스**: ① 체크 → 차트/별도 pane 렌더 ② 체크 해제 → pane/차트에서 제거 ③ 새로고침 → 선택 복원 ④ 해제 상태도 복원 ⑤ 모바일에서 모달 안 가려짐.

## 3. 아키텍처

### 3.1 신규 공통 훅 `usePersistentState<T>(key, default)` (`shared/hooks`)
SSR-safe localStorage 영속:
- `useState(default)` (서버·초기 렌더는 default — hydration mismatch 방지).
- 마운트 `useEffect`: localStorage[key] 읽어 있으면 set(파싱 실패/없음은 default 유지).
- 값 변경 `useEffect`: localStorage[key]에 JSON 저장. `typeof window` 가드.
- 반환 `[value, setValue]` (useState와 동일 시그니처 → 드롭인 교체).

### 3.2 영속 대상(드롭인 교체 — API 무변경)
- `useIndicatorVisibility`: `useState(initialVisibility)` → `usePersistentState('siglens.chart.visible', initialVisibility())`. 키 누락/레지스트리 증가 대비, 복원 시 `{ ...initialVisibility(), ...stored }`로 머지(신규 키 default 보강).
- overlay 훅 8개(bollinger/keltner/donchian/supertrend/parabolicSar/chandelier/ichimoku/volumeProfile): `useState(false)` → `usePersistentState('siglens.chart.overlay.<key>', false)`.
- `useMovingAverageOverlay`(MA/EMA 공용): `useState<number[]>(defaultPeriods)` → `usePersistentState(storageKey, defaultPeriods)`. **storageKey를 파라미터로 추가**해 useMAOverlay='siglens.chart.ma.periods', useEMAOverlay='siglens.chart.ema.periods'로 구분.

토글/해제는 기존 경로 그대로(즉시 적용·removeSeries) + 상태가 영속되므로 새로고침 후 복원.

### 3.3 모달 그리드 (`ui/IndicatorSettingsModal.tsx`)
- 각 카테고리 `<section>`의 항목 컨테이너 `flex flex-col gap-0.5` → **`grid grid-cols-2 gap-x-4 gap-y-0.5`**(데스크톱), 모바일도 2열 유지(좁으면 `grid-cols-2`가 충분히 짧음). period 행(MA/EMA)은 칩이 넓으므로 `col-span-2`(전체폭) 유지.
- 모달 폭 `max-w-md` → 그리드 수용 위해 `max-w-lg`로 약간 확대. `max-h-[calc(100vh-2rem)] overflow-y-auto`는 유지(세로 넘치면 내부 스크롤).
- 모바일: 2열 그리드로 높이 대폭 감소 → 뷰포트 내 수용. `p-4` 컨테이너 패딩 유지.

## 4. 테스트

- **`usePersistentState`** 단위: 초기 default, localStorage 복원, 변경 시 저장, 파싱 실패 graceful, SSR(window 없음) 안전.
- **useIndicatorVisibility** 테스트: 영속 키 read/write, 신규 키 머지 복원, 기존 toggle/paneIndices 회귀.
- overlay/MA 훅 테스트: 영속 키로 초기화·저장 확인(기존 토글 동작 회귀 유지).
- 모달 테스트: 그리드 클래스 적용·항목 렌더·period 행 col-span 회귀.
- **실증(Chrome)**: 검증 매트릭스 ①~⑤ — 토글 렌더, 해제 제거, 새로고침 복원, 모바일 그리드 수용.

## 5. FSD / 범위
- `usePersistentState`는 `shared/hooks`(범용). 차트 훅·모달은 `widgets/chart`. localStorage는 클라 전용(브라우저 영속) — core 무관, 도메인 로직 아님. 레이어 정상.

## 6. 비범위
- 저장 버튼/스테이징(사용자가 자동 영속 선택). period 외 지표 파라미터 커스터마이즈. 서버 동기화(클라 localStorage만).

## 7. 실증 결과 (2026-06-12, Chrome)

prod-like 빌드(`E2E_TEST=1` + `.env.e2e`, docker Postgres/Redis/SRH, `http://localhost:4300`), 시드 AAPL. 검증 매트릭스 ①~⑤ **전부 PASS**:

- **① 토글 ON → 렌더**: BB(overlay)→좌상단 "BB Upper/Middle/Lower" 범례+밴드, RSI(pane)→별도 pane "RSI(14)" 라벨, Elder Impulse(candle-paint)→메인 캔들 teal 재색칠. 동시에 localStorage에 `siglens.chart.visible`(rsi/elderImpulse=true), `siglens.chart.overlay.bollinger="true"` 기록.
- **② 토글 OFF → 제거**: 3종 해제 시 범례·pane·재색칠 모두 사라지고 기본 캔들 복귀, localStorage 값 false 갱신.
- **③ 새로고침 → 복원**: 재토글 없이 BB 범례·RSI pane·Elder Impulse 색칠 복원.
- **④ 해제 상태 영속**: 해제 후 새로고침해도 OFF 유지(깨끗한 기본 차트).
- **⑤ 모바일 모달**: 390px 폭에서 2열 그리드 정상 reflow, 가로 오버플로우 0(dialog scrollWidth=clientWidth=356), 세로는 viewport 내 수용+내부 스크롤, 라벨 클리핑 없음.
- 전 과정 **콘솔 에러 0**. 단위 661 pass, tsc/lint/prettier 클린.
