# 모바일 [symbol] UI/UX 결함 4종 수정 — 설계

- 작성일: 2026-08-01
- 브랜치: `fix/mobile-ux-input-and-snapshot-clarity`
- 관련 상위 맥락: `docs/qa/MULTI_ENV_TESTING.md`, `docs/qa/STABILITY_AUDIT.md`

---

## 0. 요약

모바일 `[symbol]` 차트 페이지에서 **시트 밖 모든 텍스트 입력이 불가능**한 P0 결함을 포함해,
실측으로 확인된 UI/UX 결함 4건을 수정한다. 4건 모두 브라우저 실측(Playwright 터치
에뮬레이션 + 프로덕션 관측)으로 재현·계량했으며, 추정에 기반한 항목은 없다.

| # | 결함 | 심각도 | 원인 | 수정 |
|---|---|---|---|---|
| 1 | 시트 밖 입력 전면 차단 (평단·검색·챗봇) | P0 | vaul 1.1.2가 `modal` prop을 Radix에 미전달 | `yarn patch`로 passthrough 복구 |
| 2 | 헤더 팝오버가 화면 밖으로 넘치고 시트에 덮임 | P1 | ① `absolute right-0 w-72`가 앵커 왼쪽으로 넘침 ② 헤더 `relative z-40`이 스택 컨텍스트를 만들어 z-50 시트를 이길 수 없음 | 모바일은 body로 포털된 중앙 모달(공유 프리미티브), 데스크탑은 현행 유지 |
| 3 | "전일 기술적 분석 요약"을 실시간 분석으로 오인 | P1 | 라이브 카드와 제목·외형이 유사, 기준일 미표기 | 기준일 명시 + 배지 + 상호참조 문구 |
| 4 | 초기 시트가 차트를 덮음 | P1 | 초기 스냅이 `SNAP_HALF`인데 차트 패딩은 `SNAP_PEEK` 기준 | 초기 스냅을 `SNAP_PEEK`로 일치 |

---

## 1. 배경 — 실측 근거

### 1.1 재현 환경

로컬 E2E 백엔드(docker Postgres/Redis) + `.env.e2e` dev 서버(4300) 위에서
Playwright 터치 에뮬레이션(iPhone 14/WebKit, Pixel 7/Chromium, iPhone SE)으로 재현했다.
프로덕션(`siglens.io`)에서도 동일 증상을 관측했다.

### 1.2 결함 1 — 입력 차단 (P0)

시트가 마운트되는 모바일 차트 페이지에서, 시트 **밖**의 입력 3종이 모두 불가:

| 입력 | 수정 전 | 대조군 (`/AAPL/news`, 시트 없음) |
|---|---|---|
| 평단 팝오버 수량/평단 | ❌ 값 미반영 | — |
| 헤더 종목 검색 | ❌ 값 미반영 | ✅ 정상 |
| 플로팅 챗봇 | ❌ 값 미반영 | — |

진단 로그의 결정적 증거 — 입력을 탭한 직후 `document.activeElement`가 입력이 아니라
시트 컨테이너였다:

```
수량 focused after tap: false
수량 activeElement: DIV#radix-_r_2_ …fixed inset-x-0 bottom-0 z-50 … h-[97svh]
popover aria-hidden ancestry: HEADER
```

원인은 `node_modules/vaul/dist/index.mjs:1341`에서 확인했다. `Drawer.Root`에
`modal={false}`를 주어도 vaul은 내부 `DialogPrimitive.Root`에 그 값을 넘기지 않는다:

```js
return React.createElement(DialogPrimitive.Root, {
    defaultOpen, onOpenChange, open        // ← modal 없음
});
```

Radix 기본값 `modal=true`가 적용되어 세 가지 부작용이 동시에 발생한다.

1. **FocusScope 포커스 트랩** — 시트 밖 입력을 탭하면 `focusin` 핸들러가 포커스를 시트로 되돌린다. (입력 차단의 직접 원인)
2. **`hideOthers`** — 헤더를 포함한 앱 트리 전체에 `aria-hidden="true"` 부착. 스크린리더로 시트 밖 접근 불가.
3. **`disableOutsidePointerEvents`** — `body`에 `pointer-events: none`.

세 번째는 이미 `MobileAnalysisSheet.tsx`의 `useRestoreBodyPointerEvents()`
MutationObserver 핵으로 무마하고 있었다. 즉 **근본 원인은 알려져 있었으나 증상 하나만
땜질된 상태**였고, 1·2번은 남아 있었다.

업스트림에 미해결 이슈로 등록되어 있다(0.9.4의 PR #424 회귀):

- [vaul#496 — Input elements outside drawer are not interactable, even with "modal" set to false](https://github.com/emilkowalski/vaul/issues/496) (open)
- [vaul#497 — Focus is trapped inside drawers when always open even with modal=false](https://github.com/emilkowalski/vaul/issues/497)

1.1.2가 최신 배포판이므로 버전 상향으로는 해결되지 않는다.

### 1.3 결함 2 — 팝오버 오버플로우 **및 시트에 가려짐**

`PortfolioChipPopover`는 `absolute top-full right-0 w-72 max-w-[calc(100vw-2rem)]`이고,
`PortfolioChip`의 래퍼가 `relative inline-block`이므로 **칩 기준**으로 오른쪽 정렬된다.
칩이 화면 왼쪽에 놓이는 모바일에서는 패널(288px)이 앵커 왼쪽으로 넘쳐 제목·라벨이 잘린다.
`max-w`는 `100vw-2rem`(390px 뷰포트에서 358px)이라 288px보다 커서 구속력이 없다.

**추가로 발견된 두 번째 축(감사 지적 + 실측 확인): 시트가 팝오버를 덮는다.**

`SymbolLayoutHeader.tsx:50`의 `<header className="relative z-40">`은 **스택 컨텍스트를
생성**한다. 따라서 헤더 자손인 팝오버는 자기 `z-index`를 아무리 올려도 루트 스택 컨텍스트에서는
40레벨로 합성된다. 반면 분석 시트는 `Drawer.Portal`을 통해 `document.body` 직속으로
`fixed … z-50`(`MobileAnalysisSheet.tsx:89`)로 렌더된다. **50 > 40이므로 시트가 헤더 서브트리
전체를 덮는다.** 팝오버 내부에서 `z-60`을 주는 설계는 무효다.

헤더 팝오버 전수 실측(로그인 상태, 초기 스냅 HALF):

| 팝오버 | iPhone SE (320) | iPhone 14 (390) |
|---|---|---|
| 평단 설정 | x=**−88**..200 (좌측 넘침) · bottom 489 > sheetTop 273 → **가려짐** | x=**−18**..270 (좌측 넘침) · bottom 483 > sheetTop 319 → **가려짐** |
| 분석 설정(⚙) | x=16..304 (가로 정상) · bottom 341 > sheetTop 273 → **가려짐** | x=86..374 (가로 정상) · bottom 335 > sheetTop 319 → **가려짐** |

즉 **가려짐 문제는 평단 팝오버만의 문제가 아니다.** 분석 설정 메뉴도 동일하게 덮인다.
FIX 4(초기 스냅 PEEK)로 시트가 내려가면 초기 상태에서는 대부분 해소되지만, 사용자가 시트를
위로 올린 뒤 팝오버를 열면 다시 덮인다. 따라서 스택 컨텍스트 탈출이 근본 해법이다.

### 1.4 결함 3 — 전일 요약 혼동

프로덕션 관측(AAPL이 -7.35% 급락한 날):

| | 라이브 분석 | 전일 스냅샷 프로즈 |
|---|---|---|
| 현재가 | **$308.91** | "분석 시점 가격 **333.43달러**" |
| RSI | **43.2 (중립)** | "RSI **61.66**으로 과매수권에서 하락 중" |
| 제목 | "AAPL 기술적 지표 요약" | "기술적 분석 요약" |
| 기준 표기 | — | "· 전일 장마감 기준" (회색 작은 캡션) |

제목이 사실상 동일하고 기준일이 없어, 급변동일에는 **틀린 정보로 읽힌다**.

**노출 경로 정정(감사 지적)**: 차트 탭에서 프로즈는 첫 화면 아래에 있다 —
`page.tsx:274`가 `<main>`을 `overflow-y-auto` 스크롤러로 만들고 `:288`이 chart+AI 래퍼를
`h-full shrink-0`으로 고정하므로, 프로즈는 한 뷰포트 아래에 위치한다(모바일 실측:
`main scrollHeight=1122, clientHeight=400`). 즉 "먼저 눈에 들어온다"기보다 **스크롤하면
라이브 분석이 아직 도는 중에도 완성된 문장형 프로즈를 만나게 되는** 경로다. 나머지 6개
탭에서는 프로즈가 첫 화면 안에 들어와 오인 위험이 더 직접적이다.

`SnapshotSummarySection`은 7개 탭 렌더러가 공유하므로, 셸을 고치면 전 탭이 함께 개선된다.

### 1.5 결함 4 — 초기 스냅이 차트를 덮음

`useMobileSheet.ts:20`이 초기 스냅을 `SNAP_HALF`(0.55)로 잡는 반면,
`ChartContent.tsx:484-491`은 하단 패딩을 `SNAP_PEEK`(0.15) 높이만큼만 확보한다. 불일치의
결과로 초기 화면에서 차트가 가려진다. 3개 기기 실측:

| 기기 | 뷰포트 | 차트 하단 y | 차트를 안 가리는 최대 시트 비율 | 실제 초기 시트 |
|---|---|---|---|---|
| iPhone 14 | 664 | 527 | **0.206** | 0.520 ❌ |
| iPhone SE | 568 | 446 | **0.215** | 0.519 ❌ |
| Pixel 7 | 839 | 676 | **0.194** | 0.520 ❌ |

`SNAP_PEEK`(0.15)는 세 기기의 임계값(0.194~0.215) **아래**이므로 차트를 가리지 않는다.
또한 `SNAP_HALF`의 주석상 목적인 "분석 중 배너 노출"도 PEEK에서 충족된다 — 배너 실측
높이 36px, PEEK 가시 영역은 85px(SE)~126px(Pixel 7)이며 핸들 5px + 상단 패딩 12px을 빼도
여유가 있다. 즉 **HALF는 자기 목적에 비해 과도**하다.

---

## 2. 목표 / 비목표

### 목표

1. 모바일 차트 페이지에서 시트 밖 입력 3종이 모두 동작한다.
2. 시트 밖 앱 트리에 `aria-hidden`이 붙지 않는다(스크린리더 접근 복구).
3. 헤더 팝오버(평단·분석 설정)가 모든 지원 뷰포트에서 화면 안에 완전히 들어오고,
   분석 시트에 덮이지 않는다.
4. 전일 스냅샷 프로즈가 실시간 분석과 명확히 구분된다(기준일 명시 포함).
5. 초기 진입 시 캔들·거래량 차트가 시트에 가려지지 않는다.
6. 위 5개가 **자동 회귀 테스트로 고정**된다 — 특히 모바일 회원 동선은 현재 E2E 미커버다.

### 비목표

- vaul → vaul-base 마이그레이션 (별건, 리스크 대비 이득 없음)
- 시트 드래그 물리/스냅 알고리즘 변경
- `MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS` 제거 (vaul hydration 순서도 함께 방어하므로 유지)
- 분석 로직·프롬프트·지표 계산 (siglens-core 스코프. `docs/architecture/SCOPE.md` 준수)
- 전일 스냅샷의 생성·크론·캐시 정책

---

## 3. 설계

### 3.1 FIX 1 — vaul `modal` passthrough 복구

**접근법 비교**

| 안 | 내용 | 판단 |
|---|---|---|
| **A. `yarn patch`** | vaul dist에 `modal: modal,` 1줄 추가 | **채택.** 최소 변경, 실증 완료, 공개 이슈의 표준 워크어라운드 |
| B. vaul-base 1.0.0 마이그레이션 | Base UI 기반 후속 패키지로 이전 | 기각. API 전면 변경, 시트 드래그 회귀 위험, 이득은 A와 동일 |
| C. 시트 자체 구현 | Radix 없이 직접 구현 | 기각. 스냅 물리·접근성 재구현 비용 과다 |

**구현**

- `yarn patch vaul@npm:1.1.2` → `dist/index.mjs`(`DialogPrimitive.Root`)와
  `dist/index.js`(`DialogPrimitive__namespace.Root`) **양쪽** 모두에
  `modal: modal,` prop 추가 → `yarn patch-commit -s`.
- 산출물: `.yarn/patches/vaul-npm-1.1.2-*.patch` + `package.json`의 `resolutions` 엔트리. 둘 다 커밋.
- `MobileAnalysisSheet.tsx`에서 `useRestoreBodyPointerEvents()`와 관련 상수를 **제거**한다.
  non-modal 경로에서는 Radix가 `body`를 건드리지 않으며(실측 `bodyPE=auto`), vaul 자체도
  `!modal`일 때 rAF로 `auto`를 보장한다. 죽은 방어 코드를 남기면 다음 사람이 원인을 오독한다.
- 패치의 존재 이유와 업스트림 이슈 링크를 `MobileAnalysisSheet.tsx` 상단 주석으로 남긴다.

**리스크와 완화**

- ~~vaul 버전 상향 시 `yarn install`이 실패하므로 fail-loud~~ — **감사 지적으로 철회.**
  `resolutions`는 `vaul@npm:1.1.2`에 핀되므로 버전을 올리면 (a) 해상도가 구버전을 계속
  가리키거나 (b) 매치되지 않아 패치가 조용히 빠진다. **어느 쪽도 install을 실패시키지 않는다.**
  → 완화: **패치 무결성 테스트**를 둔다. vitest가 `vaul/dist/index.mjs`와 `dist/index.js`를
  읽어 `DialogPrimitive` Root 생성부에 `modal`이 전달되는지 단언한다. 패치가 빠지면 테스트가
  깨져 CI가 막는다.
- CI 3개 워크플로가 모두 `yarn install --immutable`이다(`ci.yml:61`, `e2e.yml:74`,
  `deploy.yml:46`). → **`yarn.lock`을 패치와 함께 재생성·커밋해야 한다.** 누락 시 전 워크플로 실패.
  `.gitignore`가 `.yarn/patches`를 이미 un-ignore 하고 있고 `nodeLinker: node-modules`이므로
  메커니즘 자체는 문제없다.
- 시트가 non-modal이 되어 외부 클릭에 닫힐 가능성 → `dismissible={false}`가 유지되고,
  vaul은 `!modal`일 때 `onPointerDownOutside`/`onFocusOutside`를 무조건 `preventDefault`한다.
  실측에서도 외부 탭 후 시트가 그대로 유지됨을 확인했다.
- non-modal에서 vaul `Overlay`는 `null`을 반환한다 — 시트 뒤 스크림이 사라지는 것은
  **의도된 결과**이며, 현재 코드는 `Drawer.Overlay`를 렌더하지 않으므로 시각적 변화가 없다.

**실증 결과 (수정 전 → 후)**

```
수량  focused after tap: false → true      value: "" → "10"
평단  focused after tap: false → true      value: "" → "150"
헤더 검색: BLOCKED → ok ("TSLA")
챗봇 입력: BLOCKED → ok ("hello")
popover aria-hidden ancestry: HEADER → none
body pointer-events / bad-ancestors: none
외부 탭 후 시트: STILL PRESENT
```

관련 E2E(`mobile-analysis-sheet`, `portfolio-holdings`, `portfolio-position`,
`personalized-analysis`, `symbol-analysis`)를 패치 상태에서 직렬 실행해 전부 통과를 확인했다.

### 3.2 FIX 2 — 헤더 팝오버 뷰포트 안전 배치 (공유 프리미티브)

모바일에서는 앵커드 팝오버를 포기하고 **`document.body`로 포털된 중앙 모달**로 승격한다.
데스크탑(`md+`)은 현행 앵커드 팝오버를 그대로 유지한다.

**포털이 필수인 이유**: CSS만으로는 해결되지 않는다. 헤더가 `relative z-40`으로 스택
컨텍스트를 만들므로(§1.3), 자손 팝오버는 `z-[60]`을 줘도 시트(z-50) 아래로 합성된다.
`createPortal`로 헤더 밖(body 직속)에 렌더해야 비로소 z-60이 유효해진다.

이 레포에 이미 같은 패턴이 있다 — `src/widgets/chart/ui/IndicatorSettingsModal.tsx:121-123`의
`createPortal(…, document.body)` + `fixed inset-0 z-60 flex items-center justify-center p-4`.
새 패턴을 발명하지 않고 이것을 따른다. `z-60`은 이 레포에서 이미 쓰이는 Tailwind v4 값이다
(`FloatingChatButton.tsx:24,29,47`).

**공유 프리미티브로 만드는 이유**: 실측 결과 평단 팝오버와 분석 설정 메뉴가 **둘 다** 시트에
덮인다. 헤더 컨트롤이 하나 더 늘면 다음 팝오버도 같은 방식으로 깨진다. 따라서 일회성 수정이
아니라 `shared/ui`의 공유 표면으로 만들고 두 곳에 적용한다.

- `src/shared/ui/popoverSurface.tsx`
  - `POPOVER_SURFACE_DESKTOP` / `POPOVER_SURFACE_MOBILE` 클래스 상수
  - `PopoverSurface` — `useIsMobileViewport()`가 true면 배경 + 패널을 `document.body`로
    포털하고, false면 현행 그대로 제자리에 렌더한다.
- 적용 대상: `PortfolioChipPopover`(가로 넘침 + 가려짐), `AnalysisSettingsMenu`(가려짐).
- 하단 고정(bottom sheet)은 채택하지 않는다 — 분석 시트가 하단을 점유해 충돌한다.
- 배경 오버레이는 `panelRef` 밖이므로 기존 `useOnClickOutside`(document `pointerdown`)가
  그대로 닫기를 처리한다 — 새 핸들러 불필요.
- `aria-modal`은 **추가하지 않는다**. 커밋 `34358ab4`가 "over-promised"로 제거한 결정을
  되돌리지 않으며, 포커스 트랩은 기존 `useFocusTrap`이 이미 제공한다.

**주의**: `useIsMobileViewport`는 초기값이 `false`이고 effect에서 동기화된다
(`src/shared/hooks/useIsMobileViewport.ts:8`). 두 팝오버 모두 **사용자 클릭 이후에만**
마운트되므로(`PortfolioChip.tsx:83`의 `{isOpen && …}`) 초기 페인트 시점에 이미 effect가
돌아 있어 데스크탑 레이아웃이 번쩍이지 않는다. SSR 렌더 경로도 없다
(`PortfolioChipPopover`는 `next/dynamic` `ssr: false`).

### 3.3 FIX 3 — 전일 스냅샷 명확화

**셸(`SnapshotSummarySection`) 변경 — 7개 탭 공통 적용**

- 선택적 `asOf?: Date` prop 추가. 값이 있으면
  - 제목 옆에 배지 `지난 AI 분석` 렌더 (테두리 + 약한 배경으로 라이브 카드와 시각적 분리)
  - 캡션을 `{displayName} · {YYYY년 M월 D일} 미국 장마감 기준`으로 대체
- 값이 없으면 기존 캡션(`… · 전일 장마감 기준`)으로 폴백 — 호출부 미전환 구간에서도 안전.

**배지 문구를 "전일"로 쓰지 않는 이유**

읽기 경로는 `SNAPSHOT_MAX_AGE_MS`(7일) 이내 행까지 허용한다(`src/entities/seo-snapshot/model.ts:25`).
따라서 현행 고정 문구 `전일 장마감 기준`은 크론이 며칠 밀린 구간에서 **이미 거짓**이 될 수 있다.
배지는 신선도를 주장하지 않는 `지난 AI 분석`으로 두고, 정확한 사실(실제 기준일)은 캡션의
날짜가 전달한다. 이 변경은 혼동 해소뿐 아니라 **정확도(E-E-A-T) 개선**이기도 하다.

**결정성 유지**

기존 JSDoc이 금지한 것은 렌더 중 `new Date()`(재검증 시점마다 값이 변함)이다.
`generatedAt`은 **DB 행의 값**이므로 같은 캐시 엔트리에서 항상 같은 문자열을 만든다 —
결정성 원칙을 위반하지 않는다. 포맷팅은 `Intl.DateTimeFormat('ko-KR', { timeZone:
'America/New_York', … })`로 고정해 서버 로케일·타임존에 의존하지 않게 한다.

**신규 순수 함수**

`src/shared/lib/formatSnapshotAsOf.ts` — `(date: Date) => string`. 외부 의존 없는 순수
함수이므로 shared에 둔다(레이어 규칙 준수: views → shared 허용).

**데이터 배선 — 렌더러는 7개지만 호출부는 11곳이다**

감사 지적으로 정정: 렌더러는 7개가 맞지만 **호출부는 11곳**이며, 그중 3곳은 스냅샷 행이
아니라 `content`만 받는 중간 래퍼다. 이들을 빠뜨리면 "한 탭만 날짜가 있는" 불일치가
정확히 발생한다.

| 호출부 | 형태 |
|---|---|
| `[symbol]/page.tsx:367`, `overall:351`, `news:383`, `congress:285`, `financials:293`, `fundamental:637` | 스냅샷 행 보유 → `generatedAt` 직접 전달 |
| `[symbol]/options/page.tsx:200`, `:233`, `:368` | 스냅샷 행 보유 (한 파일에 **3곳**) |
| `fundamental/FundamentalDegraded.tsx:16`, `financials/FinancialsDegraded.tsx:16`, `congress/CongressDegraded.tsx:16` | `snapshotContent?: unknown`만 받음 → **`snapshotGeneratedAt?: Date` prop 신설 후 호출부에서 전달** |

7개 렌더러 전부에 `generatedAt?: Date`를 열고, 위 11곳 전부를 배선한다.

**상호참조 문구**

라이브 AI 분석이 같은 화면에 존재하는 탭 — **차트(technical)와 종합(overall)** — 에서만
안내 한 줄을 렌더한다. 각 렌더러가 자기 children 최상단에 넣는다(셸에 새 prop을 만들지 않는다):

> 실시간 AI 분석 결과는 분석 패널에서 따로 제공됩니다.

라이브 분석 패널이 없는 나머지 5개 탭에는 넣지 않는다 — 존재하지 않는 패널을 가리키게 된다.

### 3.4 FIX 4 — 초기 스냅 정합

`useMobileSheet.ts`의 초기 상태를 `SNAP_HALF` → `SNAP_PEEK`로 변경하고,
`constants/mobileSheet.ts`의 주석을 실제 역할에 맞게 갱신한다(HALF는 더 이상 초기값이
아니라 드래그 중간 스냅). `ChartContent`의 `--snap-peek` 패딩 예약과 정합이 맞춰진다.

**기존 테스트 2개를 함께 고쳐야 한다(감사 지적)**:
- `src/views/symbol/__tests__/hooks/useMobileSheet.test.tsx`는 현재 `SNAP_HALF`를 단언한다.
  새 테스트를 추가하는 게 아니라 **기존 단언을 뒤집는다**.
- `src/views/symbol/__tests__/SymbolPageClient.test.tsx`가 `sheetSnap: 0.55`를 목값으로
  하드코딩한다. 동작에 영향은 없지만 일관성을 위해 갱신한다.

HALF에 의존하는 제품·분석 로직은 없다 — 다른 `SNAP_HALF` 소비자는 드래그 목표값인
`useMobileSheetDrag.ts:108`뿐이며 이번 변경의 영향을 받지 않는다.

---

## 4. 아키텍처 영향

- 레이어 위반 없음: `views → shared`, `features(ui) → shared` 모두 허용 방향.
- siglens-core 스코프 침범 없음 — 분석 로직·지표·프롬프트를 건드리지 않는다.
- 신규 런타임 의존성 없음. 신규 환경변수 없음.
- `package.json`에 `resolutions` 필드가 새로 생긴다(패치 적용용).

---

## 5. 테스트 전략

### 5.1 단위 (vitest)

| 대상 | 검증 |
|---|---|
| `formatSnapshotAsOf` | ET 기준 포맷, 자정/월말 경계, 동일 입력 → 동일 출력(결정성) |
| `SnapshotSummarySection` | `asOf` 있으면 배지+날짜 캡션, 없으면 기존 캡션 폴백 |
| `TechnicalSnapshotProse` | 상호참조 문구 렌더, 스냅샷 부재 시 `null` 유지 |
| `useMobileSheet` | 초기 스냅이 `SNAP_PEEK` |
| `MobileAnalysisSheet` | `useRestoreBodyPointerEvents` 제거 후에도 마운트/언마운트 정상 |

### 5.2 E2E (Playwright) — 회귀 고정

**테스트가 P0를 놓친 진짜 이유 (감사로 정정)**: 처음엔 "authed가 Desktop 전용이라 모바일
*회원* 동선이 무커버"라고 봤으나, 막힌 입력 3종 중 2종(헤더 검색, 챗봇)은 **비회원도 도달
가능**하다. 정확한 원인은 **모바일 뷰포트에서 차트 라우트를 열고 실제 입력을 시도하는
프로젝트가 아예 없었다**는 것이다. 기존 `mobile-analysis-sheet.spec.ts`는 `@webkit` 태그로
게이팅되어 있고 핸들 드래그만 검사한다.

따라서 두 갈래로 나눈다.

- **anon 모바일** — 기존 `webkit` 프로젝트(iPhone 14, storageState 없음)에 헤더 검색·챗봇
  입력 케이스를 `@webkit` 태그로 추가한다. `setup` 의존이 없어 저렴하다.
- **신규 `authed-mobile` 프로젝트** — `devices['Pixel 7']` + `storageState`, `setup` 의존.
  로그인이 필요한 평단 팝오버 케이스만 담당한다.

신규 스펙 `e2e/specs/mobile-input-reachability.spec.ts`(authed-mobile):
1. 평단 팝오버에 수량/평단을 **실제로 입력**해 값이 반영된다
2. 팝오버가 뷰포트 안에 완전히 들어온다(`x ≥ 0`, `right ≤ width`)
3. 팝오버가 시트에 가려지지 않는다(팝오버 z-context가 시트 위)
4. 시트 밖 트리에 `aria-hidden`이 없다
5. 초기 스냅에서 캔들·거래량 차트 하단이 시트 상단보다 위에 있다

**라우팅 정정(감사 지적)**: `ACCOUNT_SPECS`는 `authed.testMatch`와 anon 프로젝트의
`testIgnore`에 **동시에** 쓰이는 단일 상수다. 신규 스펙을 여기 추가하면 `authed`(Desktop
Chrome)에서도 매치되어 **중복 실행 + 데스크탑에서 실패**한다(데스크탑은 시트 자체가
마운트되지 않음). 별도 상수 `AUTHED_MOBILE_SPECS`를 만들고, anon 프로젝트의 `testIgnore`는
`[ACCOUNT_SPECS, AUTHED_MOBILE_SPECS]` 배열로 확장한다. `ACCOUNT_SPECS`는 손대지 않는다.

**타이밍 주의**: 시트는 rAF + `MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS`(50ms) 뒤에 열린다.
`goto` 직후 `aria-hidden`을 단언하면 시트가 아직 안 열려 **공허하게 통과**한다. 반드시 시트
핸들이 보일 때까지 기다린 뒤 단언한다.

기존 `mobile-analysis-sheet.spec.ts`는 그대로 통과해야 한다(시트 드래그/스냅 회귀 가드).

### 5.4 패치 무결성 테스트

vaul 버전 상향 시 패치가 조용히 유실되는 것을 막는 단위 테스트(§3.1 리스크 참조).
`vaul/dist/index.mjs`와 `dist/index.js`를 읽어 Radix `Root` 생성부에 `modal`이 전달되는지
단언한다.

### 5.3 실증 (브라우저)

- 수정 전/후 비교 스크립트를 iPhone 14 / iPhone SE / Pixel 7에서 재실행해 §1의 수치를 재측정한다.
- Claude Chrome으로 데스크탑·모바일 동선을 육안 확인한다(캡처 첨부).
- 커버리지는 직렬로만 측정한다(병렬 실행 시 `coverage/.tmp` 공유로 리포트가 깨짐).

---

## 6. 진행 절차

1. 본 스펙 → 구현 계획(`writing-plans`) 작성
2. 스펙·플랜 정합성 감사 (fresh-context Opus 서브에이전트)
3. `subagent-driven-development`로 구현
4. 테스트 케이스 작성 + Claude Chrome 실증
5. 배포 전 5종 감사 (`docs/qa/STABILITY_AUDIT.md`)
6. PR 생성

---

## 7. 롤백

- FIX 1: 패치 파일과 `resolutions` 제거 → vaul 원본 동작으로 복귀(단, P0 결함도 함께 복귀).
- FIX 2·3·4: 순수 프론트 변경이라 커밋 되돌리기로 즉시 복구. 데이터·스키마 변경 없음.
