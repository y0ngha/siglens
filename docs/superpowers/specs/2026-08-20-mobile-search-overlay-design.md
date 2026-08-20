# 모바일 검색 UX 재설계 — 전체화면 오버레이

> 2026-08-20 · 대상: 모바일(`< lg`, 1024px 미만) 헤더 검색 및 홈 히어로 검색
> 설계 검토(Opus) 반영 완료 — BLOCKER 5 / CONCERN 9

## 1. 문제

`/[symbol]` 등 전 페이지 헤더에서 종목 검색이 못 쓸 폭으로 눌려 있다. iPhone 390×844 프로덕션 실측:

```
헤더 390×57
  로고 x=8 w=32 · 입력창 x=86 w=104 · 검색버튼 x=197 w=48 · 회원가입 x=254 w=72 · 햄버거 x=334 w=44
```

드롭다운이 `absolute w-full`이라 **104px를 상속** → `KOSPI 005…` / `미국 OTC SS…`로 잘려 종목 판별이 불가능하다.
키보드가 올라오면 화면 45%를 먹어 드롭다운에 남는 세로가 ~140px(항목 2~3개).

홈 히어로(`size="lg"`)는 폭 문제는 없으나 **키보드 문제는 동일**하다.

검색은 핵심 동선이다 — 사용자가 종목을 여러 개 본다. 종목↔종목 이동의 관문이 가장 좁은 컨트롤이 되어 있다.

## 2. 레퍼런스

| 서비스 | 패턴 |
|---|---|
| 토스증권 · Robinhood | 검색이 독립 목적지. 전체화면. 입력 전 최근·인기 노출 |
| Yahoo Finance · Investing.com | 헤더 아이콘 → 전체화면 오버레이 |
| TradingView 모바일 | 아이콘 → 바텀시트 |
| 네이버 증권 | 검색바가 독립된 줄을 차지해 전폭 사용 |

**공통점: 좁은 인라인 입력 + 앵커드 드롭다운을 쓰는 곳이 없다.**

## 3. 확정 결정

| # | 결정 | 근거 |
|---|---|---|
| D1 | 아이콘 트리거 + 전체화면 오버레이 | 결과가 전폭을 쓰고 입력 전에도 쓸 게 있다 |
| D2 | 하단 탭바 **미도입** | 차트 페이지 `100dvh` 첫 화면 설계와 충돌 |
| D3 | 오버레이 + `pushState` (라우트 아님) | 검색은 경유지. 뒤로가기가 `AAPL → NVDA`여야 한다 |
| D4 | 결과 행에 **시세 없음** | 추가 왕복 0. LAX 라우팅(RTT 165ms·128KB/s)에서 비용이 실재 |
| D5 | 홈 최근 검색 칩 **유지**, 모바일 4개 | 칩은 탭 0회 노출·1회 이동 (오버레이는 2회) |
| D6 | 홈 검색창은 모바일에서 **트리거** | 폭이 아니라 키보드가 문제. 경험을 한 벌로 유지 |
| D7 | 데스크톱(`lg` 이상) **변경 없음** | 문제가 존재하지 않는다 |
| **D8** | **브레이크포인트는 `lg`(1024px)로 통일** | `Header.tsx:82`·`HeaderMobileMenu.tsx:113`과 동일. 세 종류(sm/md/lg) 혼재 금지 |

## 4. 구조

```
features/ticker-search/
├─ ui/
│  ├─ TickerAutocomplete.tsx      (기존) 데스크톱 인라인 — resultDisplay로 전환
│  ├─ SymbolSearchPanel.tsx       (기존) 홈 히어로 — 트리거 분기 + 칩 개수
│  ├─ HeaderSearch.tsx            ★신규 헤더 검색 표면(브레이크포인트 분기 + ml-auto 계약)
│  ├─ SearchOverlay.tsx           ★신규 전체화면 오버레이 (포털)
│  ├─ SearchTriggerButton.tsx     ★신규 돋보기 아이콘 버튼 + SearchGlyph
│  ├─ SearchResultRow.tsx         ★신규 결과 행
│  ├─ MarketBadge.tsx             ★신규 시장 배지 (TickerAutocomplete에서 **추출**)
│  └─ NavigationProgressBar.tsx   ★신규 이동 중 상단 진행 바 (§5.10)
├─ model/
│  └─ SearchOverlayContext.tsx    ★신규 단일 오버레이 호스팅 + 이동 소유
├─ lib/
│  ├─ resultDisplay.ts            ★신규 배지·이름 로직 (TickerAutocomplete에서 **추출**)
│  ├─ searchLabels.ts             ★신규 공용 문구·행 클래스·티커 정규식·칩 상한
│  └─ popularPreview.ts           ★신규 3자산군 인기 종목 미리보기
└─ hooks/
   ├─ useSearchOverlay.ts         ★신규 열림 상태 + 히스토리 배선
   └─ useTickerSearch.ts          (기존) `debouncedQuery` 노출 추가

app/
├─ layout.tsx                     SearchOverlayProvider 삽입
└─ globals.css                    nav-progress 키프레임
```

### 4.1 `resultDisplay.ts` — 복사가 아니라 추출

`marketBadgeSpec`과 이름 우선순위(`koreanName ?? name`, 국내 종목 영문명 억제)가 현재
`TickerAutocomplete.tsx:197,274-281`에 비공개로 있다. 그 주석은 이렇게 경고한다:

> `buildDisplayName`·`SymbolLayoutHeader`와 **같은 조건**이어야 한다 — 여기만 빠지면
> 자동완성에서만 영문명을 달고 나와 페이지 타이틀과 표기가 어긋난다
> (MISTAKES.md "서버/클라이언트 도메인 조건 불일치")

새 컴포넌트에 복사하면 그 드리프트를 재현한다. **`lib/resultDisplay.ts`로 추출하고 양쪽이
import**한다. `TickerAutocomplete`의 동작은 불변이며 기존 테스트가 가드다.

### 4.2 인기 종목 — 값은 슬라이스에, 드리프트는 테스트로

초안은 `shared/config/popular-tickers.ts`의 `TICKER_CATEGORIES`를 직접 import해 `id`로
찾아 잘랐다. 단일 소스라는 점은 좋았지만 비용이 붙었다 — 이 슬라이스 배럴은 헤더와
root layout이 소비해 **33개 전 라우트의 first-load 청크**에 들어가고 `package.json`에
`sideEffects`가 없다. 실측: 9행을 그리려고 **gzip 2,017B**가 전 라우트에 실렸고, 쓰지도
않는 `altcoin` 카테고리와 `CURATED_KOREAN_NAMES`의 `flatMap` 실행까지 따라왔다.

확정: `lib/popularPreview.ts`에 9개 항목을 값으로 둔다. 드리프트는 import가 아니라
**테스트**가 막는다 — `__tests__/popularPreview.test.ts`가 원본 config를 테스트 쪽에서만
(번들 비용 0) 읽어 심볼과 **표시 이름**이 모두 원본과 일치하는지 확인한다. 원본에서
종목이 빠지거나 이름이 바뀌면 테스트가 먼저 깨진다.

`features/*/config/`는 만들지 않는다 — 관행이 없고, `.oxlintrc.json`의 deep-import 금지
목록(`model|hooks|ui|lib|api`)에 `config`가 빠져 있어 배럴 규칙을 조용히 우회한다.


### 4.3 기존 파일 변경

| 파일 | 변경 |
|---|---|
| `Header.tsx` | `ml-auto`를 트리거로 이관(§5.5). 래퍼는 `hidden lg:flex`, `min-w-0` 유지 |
| `SymbolSearchPanel.tsx` | 모바일 입력 탭 → 오버레이. 칩 `lg` 기준 4/7 |
| `TickerAutocomplete.tsx` | `resultDisplay` import로 전환 (동작 불변) |

## 5. 구현 제약 (검토에서 확정)

### 5.1 포털 필수 — `backdrop-filter` 함정

`Header`는 `sticky z-50 backdrop-blur-md`(`Header.tsx:28`)다. CSS 명세상 `backdrop-filter`는
**`position: fixed` 자손의 containing block이 된다.** 헤더 안에서 렌더한 `fixed inset-0`는
뷰포트가 아니라 **56px 헤더 박스** 기준으로 잡힌다.

이 레포는 이미 겪었고 `HeaderMobileMenu.tsx:91-108`에 기록돼 있다.
**`createPortal(document.body)` + `mounted` 게이트**(React #418 하이드레이션 불일치 방지)로
같은 패턴을 따른다.

### 5.2 포커스 — `autoFocus`, `useFocusTrap` 자동 포커스 아님

`useFocusTrap`은 활성화 시 `container.querySelector(FOCUSABLE_SELECTOR)`의 **첫 요소**에
포커스한다(`useFocusTrap.ts:65-85`). 닫기 버튼이 DOM에서 앞서면 **키보드가 안 올라온다** —
이 설계의 존재 이유가 무너진다. 게다가 그 포커스는 `useEffect`(passive)라 탭 태스크보다 늦다.

따라서:
- **입력이 DOM 순서상 첫 포커서블**이어야 한다. 닫기 컨트롤은 입력 뒤에 둔다(iOS의 "취소는 오른쪽" 관행과 일치)
- 포커스는 **`autoFocus`**로 준다 — React가 commit 단계에서 동기 호출하므로 discrete click 태스크 안에 머문다
- `useFocusTrap`은 **가두는 용도로만** 쓴다

### 5.3 히스토리 — `pushState(state, '')`, url 인자 생략

Next 16이 `history.pushState`를 패치한다(`app-router.js:258-260`). 3번째 인자 `url`이 truthy면
`applyUrlFromHistoryPushReplace`가 `ACTION_RESTORE`를 디스패치하고, 그 후속 동기 effect가
`replaceState({ __NA: true, ... })`로 **우리 마커를 덮어쓴다**. 추가로 `pingVisibleLinks`
재프리페치까지 돈다 — 키보드를 올려야 할 바로 그 탭에서 메인스레드를 뺏는다.

```ts
history.pushState({ siglensSearch: true }, '');   // ← url 생략
```

url을 생략하면 패치의 `if (url)` 가드에 걸려 전부 스킵된다. URL도 그대로 유지된다.
**`history.state`를 신뢰하는 로직은 만들지 않는다** — 별도 ref로 "푸시했는지"를 추적한다.

### 5.4 닫기 — `usePathname()` 변화로 통합

`Header`는 root layout에 있어 클라이언트 내비게이션에도 **언마운트되지 않는다**.
`router.replace` 후에도 오버레이가 목적지 위에 남는다.

`HeaderMobileMenu.tsx:117-130`의 선례대로 **`usePathname()` 변화 시 자동 닫기**를 쓴다 —
select-close·back-close·forward-close가 한 effect로 해결된다. 푸시 여부 ref도 여기서 리셋한다
(리셋 누락 시 두 번째 열기가 `pushState`를 건너뛰어 안드로이드 뒤로가기가 사이트를 떠난다).

### 5.5 `ml-auto` 이관

`Header.tsx:86`의 `ml-auto`가 유저메뉴·햄버거를 오른쪽으로 미는 유일한 장치다. 래퍼를
`hidden lg:flex`로 만들면 모바일에서 `display:none`이 되어 **CTA·햄버거가 로고 쪽으로 붕괴**한다.
`ml-auto`는 `SearchTriggerButton`으로 옮긴다. `min-w-0`은 데스크톱 콤보박스 축소에 필요하므로 유지.

### 5.6 z-index — `z-70`

| 요소 | z | 범위 |
|---|---|---|
| Header | 50 | 전역 |
| MobileSheetPlaceholder | 40 | `/[symbol]` |
| MobileAnalysisSheet(vaul) | 50 | `/[symbol]` |
| AnalysisSignupNudgeModal | 50 | `/[symbol]/*` |
| **FloatingChatButton** | **60** | `/[symbol]/*` 무조건 |
| PopoverSurface 모바일 | 60 | `/[symbol]` |

`z-50`이면 **채팅 FAB이 오버레이 위에 뜬다**. 오버레이는 `z-70`.

### 5.7 프리페치 금지 (PR #719 회귀 방지)

`useAutocomplete.prefetch`는 `router.prefetch`를 호출하며 이는 **`prefetch={false}`를 우회**한다.
`CDN_CACHING.md §1` 실측으로 `/AAPL` RSC가 1.71MB다. 10행 목록에 걸면 오버레이 1회 열 때마다
~17MB가 오리진에서 나간다.

- 오버레이는 `useTickerSearch`를 **직접** 쓴다(`useAutocomplete` 미사용)
- 결과·최근·인기 행은 **전부 `<button>`** — `<Link>` 금지. `<Link>`는 `router.push`라
  히스토리가 `[NVDA, SEARCH, AAPL]`이 되어 뒤로가기가 유령 항목에 걸린다
- 모든 행은 같은 `onSelect` → `addSearch` → `router.replace` 경로

### 5.8 뷰포트·스크롤

- 셸은 **`h-dvh`**(`HeaderMobileMenu.tsx:161` 선례). iOS에서 `fixed inset-0`는 visual viewport가
  아니라 layout viewport 기준이라 키보드 뒤로 입력이 숨을 수 있다
- 결과 목록에 **`overscroll-contain`**(`MobileAnalysisSheet.tsx:77` 선례)
- 배경 스크롤 잠금은 `HeaderMobileMenu.tsx:84-89`와 같은 방식. 둘이 동시에 마운트되면
  저장값이 서로를 오염시키므로, 오버레이가 열린 동안 햄버거는 도달 불가여야 한다

### 5.9 복원 세션 가드

탭이 재로드·복원되면 중복 URL 항목만 남고 `isOpen`은 `false`라 **뒤로가기가 아무 일도 안 한다**.
마운트 시 마커 ref가 없으면 그대로 두고, 오버레이가 닫힌 채 시작한다 —
`pushState`는 항상 열기 시점에만 하므로 유령 항목은 생기지 않는다.

### 5.10 이동 중 피드백 — 오버레이 **밖**에

`router.replace`는 LAX 경로에서 2~3초가 걸린다(`/AAPL` RSC 1.71MB, 압축 ~340KB, 128KB/s).
그리고 **Next가 그 사이를 채워 주지 않는다** — `app/[symbol]/loading.tsx`는 `[symbol]`의
자식 슬롯을 감싸는데 종목→종목 이동은 그 세그먼트 자체를 바꾸므로 서스펜스가 경계 위에서
일어난다. 루트 `loading.tsx`도 `<Suspense>`도 없어 React가 옛 화면을 붙들고 있는다.

초안은 "오버레이를 스피너와 함께 유지"였는데 그 설계가 버그 셋을 만들었다 —
이동이 멈추면 전체화면 모달에 갇히고(WCAG 2.1.2), 하드웨어 뒤로가기가 그 가드를 우회하며,
대기 중 `history.back()`이 늦게 도착한 응답과 경합했다. 셋 다 **오버레이를 열어둔 것**이
공통 원인이었다.

확정: **닫기는 즉시, 표시는 밖에.** 선택 즉시 오버레이를 닫고,
`SearchOverlayProvider`가 `useTransition`으로 상단 진행 바(`NavigationProgressBar`)를 띄운다.
순수 표시라 아무것도 막지 않으므로 위 세 버그가 구조적으로 불가능하다.

## 6. 접근성

- `role="dialog"` + `aria-modal="true"` + `aria-label="종목 검색"`
- 입력이 첫 포커서블 + `autoFocus` (§5.2)
- `useFocusTrap`으로 가두기, `useEscapeKey`로 닫기
- 결과 수 `aria-live="polite"`
- **`role="listbox"`/`role="option"`은 쓰지 않는다.** ARIA listbox는 단일 탭스톱 + 방향키 +
  `aria-activedescendant`를 갖춘 복합 위젯인데 이 오버레이엔 방향키 모델이 없고 각 행이
  네이티브 `<button>`이라 저마다 탭스톱을 갖는다. 역할만 빌려오면 스크린리더가 폼 모드로
  전환한 뒤 방향키가 먹지 않아 오히려 나빠진다(WCAG 4.1.2). 버튼 목록 그대로가 정확하고
  Tab으로 완전히 조작된다
- 탭 타깃 ≥ 44×44 (WCAG 2.5.8)

## 7. SEO — 영향 없음

- 새 라우트 없음 → sitemap·robots 무변경
- 오버레이는 포털 + `mounted` 게이트라 SSR HTML에 없다
- 데스크톱 `TickerAutocomplete`는 DOM에 유지하고 CSS로만 감춘다(`hidden lg:flex`).
  `display:none`은 접근성 트리와 포커스 순서에서 제거되므로 **중복 랜드마크·중복 라벨·이중 탭스톱이 없다**
- 홈 칩은 `useRecentSearches`의 `getServerSnapshot()`이 빈 배열이라 애초에 SSR HTML에 없다

## 8. 번들 영향 — 측정치

`.next/diagnostics/route-bundle-stats.json` 확인: `features/ticker-search` 배럴은 `Header`가
`'use client'` 안에서 소비하고 `package.json`에 `sideEffects`가 없어 **이미 33개 전 라우트의
first-load에 포함**돼 있다(청크 72,653B). 신규 파일은 같은 청크에 들어가 실증 증가분은
gzip 1~2KB, 128KB/s 기준 **10~15ms** — 노이즈 범위다.

**단, 구성이 비용을 만든다.** 아이콘 패키지·애니메이션 라이브러리·`vaul`을 끌어오면 얘기가
달라진다. 글리프는 `HeaderMobileMenu.tsx:130-141`처럼 **인라인 SVG**로 한다(§9 비목표).

`.oxlintrc.json:93`이 `@/features/*/ui/*` deep import를 금지하므로 오버레이만 모바일 청크로
분리하는 우회는 불가능하다. 측정된 비용이 작으므로 수용한다.

## 9. 테스트

| 대상 | 검증 |
|---|---|
| `useSearchOverlay` | `open()`이 `pushState` 1회(**url 인자 없이**), `popstate`가 닫음, pathname 변화가 닫고 ref 리셋, 중복 `open()` 방지 |
| `SearchOverlay` | 포털 렌더, `mounted` 전 SSR 무출력, 입력 전 최근+인기, 입력 시 결과, `role="dialog"`/`aria-modal` |
| 포커스 | 입력이 첫 포커서블, `autoFocus` 존재 |
| `SearchResultRow` | 이름·티커·배지 렌더 · **시세 미포함**(D4 가드) · **`onMouseEnter` prefetch 없음**(§5.7 가드) · `<button>`이지 `<Link>` 아님 |
| `resultDisplay` | 추출 전후 동작 동일 — 국내 종목 영문명 억제 포함 |
| `Header` | 모바일 트리거에 `ml-auto`, 데스크톱 콤보박스 `hidden lg:flex` |
| 통합 | 트리거 → 오버레이 → 선택 시 `router.replace` 호출(`push` 아님) |
| 회귀 | `TickerAutocomplete`·`HoldingForm` 기존 테스트 전부 통과 |

## 10. 비목표

- 하단 탭바 (D2)
- 데스크톱 검색 변경 (D7)
- 검색 결과 시세 (D4)
- `/search` 라우트 — 필요해지면 별건
- 검색 알고리즘·랭킹 변경 — **표현 계층만** 다룬다
- 오버레이에 아이콘·애니메이션 라이브러리 도입 (§8)
- 데스크톱 hover-prefetch 구멍(`TickerAutocomplete.tsx:290`) 수정 — #719가 못 덮은 별개 사안. 별도 이슈로 남긴다

## 11. 배포 후 확인

- Cloudflare Web Analytics에 검색 열기당 **중복 URL 페이지뷰**가 잡히는지(`layout.tsx:171-179` 비콘이
  history API를 자동 추적). §5.3의 url 생략으로 발생 가능성은 낮으나 실측 확인 필요
