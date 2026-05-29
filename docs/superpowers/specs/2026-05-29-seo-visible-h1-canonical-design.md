# SEO — symbol 라우트 가시 h1 + variant canonical 충돌 정리

- **작성일**: 2026-05-29
- **상태**: Design (사용자 리뷰 대기)
- **유형**: SEO / 렌더 (siglens 전용, core 무관)
- **출처**: SEO 점검 피드백 2건 (Medium)

---

## 1. 배경 & 문제

SEO 점검에서 Medium 등급 2건이 제기됐다. 전체 코드 확인 결과 각각의 실제 범위는 다음과 같다.

### 이슈 1 — symbol 라우트 가시 H1·본문 부재

피드백은 차트(`/[symbol]`)만 짚었으나, 실제로는 **6개 symbol 라우트 전부** 동일하게 h1이 `sr-only`다.

- `chart` (`[symbol]/page.tsx`), `news`, `fundamental`, `options`, `overall`, `fear-greed` 모두 페이지 h1이 `sr-only`.
- Google은 sr-only도 읽지만 가시 콘텐츠에 더 가중치를 둔다. 핵심 랜딩(ticker landing)의 텍스트 신호가 약하다.
- **이미 의도적 설계였다**: `SymbolLayoutHeader.tsx:53-59` 주석에, breadcrumb(`종목명, 회사명 (TICKER)`)를 6개 페이지 공통이라 일부러 h1이 아닌 plain `<span>`으로 두고 "페이지마다 주제가 다르므로 페이지별 h1을 살린다"고 명시. 즉 가시 텍스트(breadcrumb·탭·회사명)는 layout에 이미 있고, 빠진 건 "가시 **h1**"이다.
- 가시 본문 상태는 페이지마다 다르다:
  - `overall`, `fear-greed`: 가시 guidance section(h2 + 문단)이 이미 있음 (h1만 없음).
  - `news`, `fundamental`, `options`: 가시 본문 패널은 있음 (가시 h1 없음).
  - `chart`: 가시 본문이 거의 없음(차트 canvas뿐) — jail 제약(§3.3).

### 이슈 2 — variant URL noindex + canonical 신호 충돌

query-param variant URL이 (a) canonical은 clean URL을 가리키면서 (b) 동시에 자신에 `robots: noindex`를 거는 하이브리드. Google 가이드상 canonical(색인 통합)과 noindex(색인 금지)는 상충한다.

전체 코드 확인 결과 정확히 **3곳**:

| 파일 | variant | canonical | noindex 조건 |
|---|---|---|---|
| `[symbol]/page.tsx` | `?tf=` | clean `url` | `hasTfVariant` |
| `[symbol]/overall/page.tsx` | `?tf=` | clean `url` | `hasTfVariant` |
| `market/page.tsx` | `?sector=`·`?timeframe=` | `/market` | `hasQueryVariant` |

**오탐(수정 대상 아님)**: `options/page.tsx`(`hasOptions ? {} : noindex` — 데이터 조건 noindex + self-canonical이라 정상), auth/account(hard noindex), 나머지 라우트(variant 없음). 중앙 seo helper(`shared/lib/seo.ts`)는 clean URL만 생성하고 robots는 각 페이지 inline.

---

## 2. 목표 / 비목표

### 목표
- 6개 symbol 라우트 각각에 **페이지별 고유 가시 h1**을 노출한다(SSR HTML에 가시 텍스트로).
- variant noindex + clean-canonical 충돌을 3곳에서 제거해 canonical 통합 신호를 명확히 한다.
- 페이지당 가시 h1을 정확히 1개로 유지하고, layout breadcrumb는 plain `<span>`(non-heading) 유지(기존 의도 보존).

### 비목표 (명시적 배제)
- ❌ 차트의 가시 **요약 본문**(추세·지표 한 줄) 추가 — 별개 작업 `2026-05-29-ssr-content-injection`(미구현)이 `TechnicalFactsSummary`로 처리. 본 작업은 차트 h1만.
- ❌ 남는 sr-only 설명 `<p>`·`<h2>` 제거/가시화 — 그대로 둔다(sr-only도 색인됨, 손해 없음). 두 작업 어디에도 이 잔존분을 빼는 단계는 없다.
- ❌ chart-first viewport jail 동작 변경(§3.3 준수).
- ❌ breadcrumb를 h1으로 승격(6페이지 동일 h1 = 중복 신호, 기존 의도 위반).
- ❌ analysis 도메인 로직 변경(core 무관).

---

## 3. 아키텍처 — 이슈 1 (가시 h1)

### 3.1 공통 컴포넌트 — `SymbolPageHeading`

6개 페이지의 가시 h1 스타일을 한 곳에서 통일한다.

- 위치: `src/widgets/symbol-page/ui/SymbolPageHeading.tsx`
- 성격: **RSC-safe 순수 presentational**(`'use client'` 불필요). app layer의 page.tsx(RSC)가 import해 SSR로 가시 텍스트를 내보낸다(app → widgets 허용).
- props: `children: ReactNode`(제목 텍스트), optional `className`.
- 스타일: `/market`의 가시 h1(`text-2xl font-bold tracking-tight sm:text-3xl`) 톤을 sibling 본문 위계에 맞게 조정(예: `text-xl sm:text-2xl text-secondary-100 tracking-tight`). 최종 톤은 `frontend-design` / `web-design-guidelines`로 다듬는다.
- barrel(`widgets/symbol-page/index.ts`)에서 export(순수 컴포넌트라 server 의존성 누출 없음).

### 3.2 sibling 5개 적용 (jail이 `min-h` — 자유)

각 페이지의 `<main>`(자연 스크롤) 최상단에서, 기존 sr-only h1을 `SymbolPageHeading`(가시)로 전환한다. 그 아래 sr-only section(h2 + p)과 가시 guidance section은 **그대로 유지**.

| 페이지 | 현재 sr-only h1 | 처리 |
|---|---|---|
| news | `:271` 별도 `<h1 className="sr-only">` | 가시 h1으로 전환. sr-only section(h2+p) 유지 |
| fundamental | `:351-353` 별도 h1 | 동일 |
| overall | `:190-192` 별도 h1 | 가시 h1 → 기존 가시 guidance h2와 h1>h2 위계 자연 |
| fear-greed | `:171-173` 별도 h1 | 동일 |
| options | `:182-183` section **안** h1 | sr-only section 밖으로 빼 가시 h1. section의 p들은 sr-only 유지 |

h1 텍스트는 각 페이지가 이미 보유한 `displayName` 변수와 기존 sr-only h1 문구를 그대로 사용(예: `{displayName} 최신 뉴스와 어닝 일정`).

### 3.3 차트 특수 처리 (jail 제약 준수)

`SymbolLayoutJail`은 차트 라우트(`useSelectedLayoutSegment() === null`)에서 `h-[calc(100dvh-…)]` + `overflow-hidden`으로 chart+AI를 첫 viewport에 고정한다(definite height 필요 — `SymbolLayoutClient.tsx:40-56`). footer는 jail **밖**(root layout sibling)이라 "차트 아래 스크롤 영역"을 두려면 jail 동작을 바꿔야 하므로 채택하지 않는다.

→ 차트 h1은 **first-viewport 안 timeframe bar 행에 짧은 한 줄**로 배치한다.

- `page.tsx:219`의 sr-only `<h1>`을 제거(sr-only section의 `<p>`·`<h2>`는 그대로 유지).
- `page.tsx`의 `displayName`을 `SymbolPageClient`에 새 prop으로 전달.
- `SymbolPageClient.tsx:67-72`의 timeframe bar 행(`...justify-end`)을 `justify-between`으로 바꿔, 좌측에 가시 h1 한 줄을 둔다.
  - 짧은 형태(예: `{displayName} 차트 분석`), `truncate min-w-0`로 모바일에서 TimeframeSelector와 한 줄 공존.
  - 스타일은 작게(예: `text-sm sm:text-base font-semibold`). `SymbolPageHeading`과 별개 스타일(좁은 bar용)이므로 인라인으로 둔다.
- `SymbolPageClient`는 `'use client'`지만 초기 SSR되므로, prop으로 받은 `displayName`이 SSR HTML에 h1 텍스트로 포함된다.

### 3.4 불변식
- 페이지당 가시 h1 **정확히 1개**. sr-only 중복 h1은 제거.
- layout breadcrumb는 plain `<span>` 유지(heading 아님).
- sr-only 설명 `<p>`·`<h2>`는 모든 페이지에서 **변경 없음**.

---

## 4. 아키텍처 — 이슈 2 (variant noindex 제거)

3개 `generateMetadata`에서 variant 기반 noindex 블록을 제거하고 clean canonical만 남긴다. canonical이 variant URL을 clean URL로 통합 처리한다.

- `[symbol]/page.tsx`: `hasTfVariant` 계산(`:57`) + noindex 블록(`:79-81`) 제거. `searchParams`의 `tf`는 본문(`SymbolPage`)에서 여전히 사용하므로 generateMetadata의 `tf` 추출만 정리.
- `[symbol]/overall/page.tsx`: `hasTfVariant` + noindex 블록(`:71-73`) 제거.
- `market/page.tsx`: `hasQueryVariant` 계산(`:66-67`) + noindex 블록(`:98-100`) 제거.
- canonical 관련 주석을 "variant는 clean canonical로 통합에 일임"으로 갱신.

---

## 5. 엣지 케이스 & 에러 처리

- 잘못된 ticker → 기존 `notFound()` / `index:false,follow:false`(generateMetadata 가드) 유지. 이슈 2 변경과 무관.
- `options` 데이터 조건 noindex(`hasOptions`) → **건드리지 않음**(정상 패턴).
- auth/account hard noindex → 변경 없음.
- 차트 h1이 매우 긴 회사명일 때 → `truncate`로 한 줄 유지, TimeframeSelector 침범 방지.
- `displayName`이 ticker와 동일(회사명 없음)할 때 → 그대로 ticker 기반 h1.

---

## 6. 테스트 전략

- `SymbolPageHeading` 단위: 가시 렌더(`sr-only` 클래스 없음), children 텍스트, h1 태그.
- 6개 페이지 render 테스트:
  - 가시 h1 **정확히 1개** + 기대 텍스트 존재 + `sr-only` 클래스 없음.
  - breadcrumb는 heading이 아님(h1 카운트에 미포함).
  - 차트: SSR 출력 문자열에 h1 텍스트 포함(`SymbolPageClient` render).
- 3개 `generateMetadata` 테스트:
  - variant searchParams를 줘도 `robots?.index !== false`(noindex 없음).
  - canonical은 항상 clean URL.
  - **기존 metadata 테스트가 variant noindex를 단언하면 회귀로 잡아 수정**(CLAUDE.md 회귀 규칙: 발견 시 사용자 보고 후 수정).

---

## 7. 영향 파일

### 신규
- `src/widgets/symbol-page/ui/SymbolPageHeading.tsx` (+ `__tests__/SymbolPageHeading.test.tsx`)
- `src/widgets/symbol-page/index.ts` — barrel export 추가

### 수정 (이슈 1)
- `src/app/[symbol]/news/page.tsx` — 가시 h1
- `src/app/[symbol]/fundamental/page.tsx` — 가시 h1
- `src/app/[symbol]/options/page.tsx` — 가시 h1(section 밖으로)
- `src/app/[symbol]/overall/page.tsx` — 가시 h1
- `src/app/[symbol]/fear-greed/page.tsx` — 가시 h1
- `src/app/[symbol]/page.tsx` — sr-only h1 제거 + `displayName` prop 전달
- `src/widgets/symbol-page/SymbolPageClient.tsx` — `displayName` prop + timeframe bar 가시 h1

### 수정 (이슈 2 — 일부는 위와 겹침)
- `src/app/[symbol]/page.tsx` — variant noindex 제거
- `src/app/[symbol]/overall/page.tsx` — variant noindex 제거
- `src/app/market/page.tsx` — variant noindex 제거

### 테스트
- 위 각 변경에 colocated 테스트 추가/수정.

---

## 8. 작업 순서

```
1. SymbolPageHeading 컴포넌트 + barrel + test
2. sibling 5개 page.tsx 가시 h1 (news/fundamental/options/overall/fear-greed)
3. 차트 가시 h1 — page.tsx(h1 제거 + displayName prop) + SymbolPageClient.tsx(timeframe bar h1)
4. 이슈 2 — variant noindex 제거 3곳 + metadata 테스트 수정(회귀 확인)
5. 전체 yarn lint && yarn test
```

- 이슈 1과 이슈 2는 독립적이라 순서 무관하나, 한 PR로 묶는다(둘 다 SEO 메타·렌더, 동일 파일 일부 공유).
- core 변경 없음. siglens 단독 머지 가능.
- 커밋/푸시는 구현·review-agent 통과 후 git-agent가 수행(CLAUDE.md).
