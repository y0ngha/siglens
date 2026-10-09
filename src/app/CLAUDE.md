# App Layer (FSD + Next.js App Router)

## Core Principle

Next.js App Router layer. Handles RSC (React Server Components) and Route Handlers.
This folder is **routing only** — it composes widgets/features/entities/shared but does not implement business logic or UI components here.

In FSD, `app/` is the **composition root**: it wires together widgets, features, entities, and shared layers via page-level RSC orchestration.

---

## Dependency Rules

```
✅ Allowed: widgets, features, entities, shared imports
✅ Allowed: @y0ngha/siglens-core direct imports
❌ Forbidden: implementing business logic directly in route files
❌ Forbidden: exposing internal error details in a response — return a generic message to the client
```

---

## RSC (React Server Components)

### Data Flow (Initial Page Load)

서버(RSC)에서 클라이언트로 초기 데이터를 주입할 때는 props 드릴링 대신
`queryClient.setQueryData()` + `dehydrate()` + `HydrationBoundary` 패턴을 사용한다.
`prefetchQuery`는 쓰지 않는다 — 아래 AP-2 참조.

```
/AAPL request
  → app/[locale]/[symbol]/layout.tsx · page.tsx (RSC)
    → QueryClient (per-request, server-only) 생성
    → 정적 캐시 로더(getAssetInfoResilient, getQuantizedBarsStatic …)로 데이터 조회
    → queryClient.setQueryData(key, data, { updatedAt: 고정값 })
    → dehydrate(queryClient) → HydrationBoundary로 클라이언트에 전달
  → SymbolPageClient (HydrationBoundary 안)
    → useBars: hydrated 캐시에서 즉시 읽기
    → useAnalysis: 마운트 시 자동 AI 분석 트리거
```

<a id="AP-2"></a>

#### AP-2 — ISR 시드는 결정적이어야 한다 (`setQueryData` + 고정 `updatedAt`)

`prefetchQuery` + `dehydrate`는 `dataUpdatedAt: Date.now()`를 자동으로 박아, 데이터가 같아도 재생성마다
HTML 해시가 달라진다 → 서버 재시작·ISR 재생성마다 불필요한 ISR write가 생긴다. 시드는 데이터를 직접 넣고
`updatedAt`을 데이터에서 유도한 고정값으로 명시한다.

- 봉 차트: `lastBar.time * MS_PER_SECOND` — `Bar.time`은 초 단위 epoch이고 RQ `updatedAt`은 밀리초다.
  `* 1000`을 빠뜨리면 1970년대로 해석돼 stale 판정이 틀어진다.
- 자산 정보: 고정 `0`(변하지 않는 스냅샷) 또는 `assetInfoSeedUpdatedAt(degraded)`.
- 시장 데이터: 시간 단위로 내림한 값(`dateHour.getTime()`), 옵션: `snapshot.capturedAt`.
- layout과 page가 같은 봉을 시드할 때는 **동일한 quantize 변환**을 적용한다. 한쪽이 forming 봉을 담으면
  중첩 `HydrationBoundary`의 시드가 달라져 HTML이 매번 바뀐다.
- 실패한 로더의 `null`을 `setQueryData`에 넘기지 않는다 — null "success"가 캐시에 박혀 클라 훅이 깨진다.
- RSC 함수에 quantize + `updatedAt` 로직의 단위 테스트(정상·degraded·빈 케이스)를 둔다. 빌드 후 두 서버
  인스턴스의 HTML 바이트 비교로 결정성을 최종 확인한다.

❌ `prefetchQuery(getBarsStatic)` → HTML에 `dataUpdatedAt:1780617600`(초 단위 10자리)
✅ `setQueryData(key, quantizedBars, { updatedAt: lastBar.time * 1000 })`

### Caching

> **Note (cacheComponents 비활성화):** 현재 `next.config.ts`에서 `cacheComponents`는
> 비활성화 상태다. PPR resumable slots 오류로 인한 SEO metadata placeholder 누출 때문에
> 임시로 꺼 둔 상태이며, 추후 재활성화 시 `'use cache'` / `cacheLife` / `cacheTag` 패턴과
> dynamic metadata 처리 방식을 함께 재설계해야 한다.

<a id="AP-1"></a>

### AP-1 — ISR / Route Segment Config (⚠️ 리터럴 강제)

`export const revalidate` / `dynamic` 등 route segment config는 **반드시 정적 분석 가능한
리터럴**이어야 한다. import한 상수나 식(`SECONDS_PER_HOUR`, `60 * 60`)으로 추출하면 Next.js가
값을 정적 분석하지 못해 `⨯ Invalid segment configuration export detected ... configs not being
applied`로 **config를 조용히 무시 → ISR이 깨진다**. 따라서 **`CONVENTIONS.md#NC-1`(매직넘버
상수 추출)은 route segment config에 적용하지 않는다** — 리터럴을 유지하고 `// 1h` / `// 30d`
인라인 코멘트로 의미만 표기한다. (`app/page.tsx`는 `revalidate = 86400` 리터럴.)

동적 세그먼트(`[symbol]`) 라우트는 `revalidate`만으로 ISR이 걸리지 않는다 — `ƒ (Dynamic)`로
남아 매 요청 렌더된다. **`export async function generateStaticParams() { return [] }`**(빈 배열 =
on-demand ISR)를 함께 export해야 빌드에서 `● (SSG)`로 전환된다. 메타데이터 이미지
(opengraph/twitter)는 `export const dynamic = 'force-static'`로 정적화한다 — `force-static`은
`cookies()/headers()/searchParams`만 비우고 `params`는 유지하므로 종목별로 정상 렌더된다.

일시적으로 degraded된 값(예: 번역 누락으로 원문을 대신 보여 준 설명)이 전체 ISR 창 동안 캐시되면 실제 값이 준비된 뒤에도 갱신되지 않는다. degraded 결과는 전체 revalidate가 아니라 **짧은 degrade revalidate**를 쓴다.

#### 페이지별 revalidate (값·근거는 [`docs/architecture/ISR_REVALIDATE.md`](../../docs/architecture/ISR_REVALIDATE.md))

사용자 신선도는 ISR이 아니라 클라 refetch가 책임지므로, revalidate는 **크롤러 SSR 신선도 + Fast Origin
Transfer/ISR 비용** 기준으로 정한다(Fast Data Transfer는 줄지 않음 — CF 앞단 캐시 몫).

현재 값은 각 `page.tsx`의 `export const revalidate` 리터럴이 원본이다(표를 여기 복사해 두지 않는다).

news는 `ensureNewsCardsAnalyzedAction`이 새 기사 fetch 시 `revalidateTag('news:${symbol}', 'max')`로 on-demand
무효화하므로 시간 기반은 상한선일 뿐. 종목 페이지 전수 cron은 도입하지 않는다(전수 재생성 = Fast Origin
Transfer 폭증). 자세한 근거는 위 문서 참조.

### ISR 4축 규약 (`[symbol]` ISR+SEO, 2026-06-02)

PPR(`cacheComponents`) 비활성 상태에서 동적 세그먼트를 ISR로 정상 캐시하려면 4가지를 모두 지켜야 한다:

1. **(축 0) 공유 셸에서 `cookies()`/`headers()` 금지.** root layout 등 모든 라우트가
   공유하는 셸이 `cookies()`/`headers()`를 직접 호출하면(Suspense 안이라도) PPR-off에선
   전 라우트가 dynamic으로 강제돼 ISR이 깨진다. 인증 헤더는 클라이언트화(`currentUserAction`
   → httpOnly 세션 + DB)로 처리한다 — `AuthSessionHeaderClient` 참조. 서버 redirect로 끝나는
   인증 플로우(login/signup/oauth/logout/delete)는 클라 success hook이 없어 헤더가 직전 상태로
   남으므로, **매 navigation(pathname 변경)마다 currentUser를 1회 refetch**해 재동기화한다(서버
   렌더 시절 매 페이지 `getCurrentUser`와 동등한 비용). hint 쿠키(`siglens_auth`, non-httpOnly)는
   hydration 동안 낙관적 skeleton 추정에만 쓰며, 인증 상태의 source-of-truth는 아니다(네트워크
   트레이스로 `document.cookie`가 정적 셸 컨텍스트에서 신뢰 불가함을 확인 — 자가치유 트리거를
   hint가 아닌 navigation으로 둔 이유). 라우트 본문의 `headers()`(예: 봇 판정)도 같은 이유로
   제거하고 클라 트리거로 이전한다 (news `NewsAiSummary` 참조).
2. **(축 1) 동적 데이터(redis/DB/FMP)는 `staticSymbolCache`로 정적화.** `@upstash/redis`
   HTTP는 no-store fetch라 static generate가 `DYNAMIC_SERVER_USAGE`를 throw한다. DB는 postgres-js(TCP,
   fetch 미사용)라 같은 신호를 drizzle 로거가 보낸다 — `noStoreQueryLogger`(`src/shared/db/`)가
   쿼리마다 `unstable_noStore()`를 불러 `unstable_cache` 밖 정적 생성 중 DB 읽기를 똑같이 던지게
   한다(캐시 안에서는 no-op). 원시 `client.sql` 템플릿은 이 로거를 우회하므로 정적 경로에서 쓰지 말 것.
   DB-backed 페이지의 엔티티 읽기는 "이중 지연"을 피하려는 이유로도 `unstable_cache` 밖에 두지 않는다. 오류·빈 결과 처리는 캐시 함수 밖에서 해서 실패가 TTL 동안 캐시되지 않게 한다.
   `unstable_cache`(= `staticSymbolCache`, revalidate 1h + `symbol:` tag)로 감싸야 ISR이
   데이터를 HTML에 박고 정적 캐시한다. (단 축 0이 선결돼야 효과가 있다.) 신선도가 민감한
   라우트(news)는 `news:${symbol}` 그룹 태그를 추가로 달고, 데이터 변경(뉴스 ingestion) 직후
   `revalidateTag('news:${symbol}', 'max')`로 **on-demand 무효화**해 1h를 기다리지 않고 갱신한다
   (Next 16의 `revalidateTag`는 2번째 profile 인자 필수 — 단일 인자는 deprecated).
3. **(축 2) URL 쿼리는 `useSearchParams`가 아니라 `useUrlSearchParam`으로 읽는다.** `useSearchParams`는
   가장 가까운 Suspense까지 서브트리를 CSR bailout시켜 SSR HTML에 fallback만 남긴다.
   `useUrlSearchParam`(서버 스냅샷 `null`)은 서버·하이드레이션 렌더를 기본값으로 그리고 하이드레이션 직후
   URL 값을 반영하므로 위젯 자체가 SSR된다(차트 탭·종합 탭·`/market` 섹터 패널). 종합 탭·`/market`의
   Suspense fallback은 안전망으로만 남고, 차트 탭은 페이지 경계를 아예 두지 않는다 — React Fizz는
   완료된 경계라도 12.8KB(`progressiveChunkSize`)를 넘으면 fallback을 인라인에 두고 본문을 숨김 청크로
   **아웃라인**하므로, fallback에 h1이 있으면 raw HTML에 h1이 둘 남는다. 같은 이유로 **클라 위젯 안의
   경계에 든 크롤 텍스트는 JS 없는 크롤러(Naver Yeti·Daumoa)에게 숨김 청크(`<div hidden id="S:n">`)로
   간다.** 차트 탭의 기술적 사실 요약(`TechnicalFactsSummary`)은 AI 패널이 차트 경계(ChartSkeleton) 안에서
   그리므로, 페이지가 경계 밖에 영구 서버 사본(`placement="page"`, 메타데이터 `hasPriceData`와 같은
   `buildTechnicalFacts` 게이트·같은 `symbolFactsSubject`)을 인라인으로 한 벌 더 두고, 사람에게는
   `globals.css`의 `body:has([data-technical-facts='panel'])` 규칙이 그 사본을 감춘다(e2e
   `symbol-seo`가 숨김 청크보다 앞에 있는지 단언한다).
   서버 데이터를 기다리는 async 컴포넌트는 Suspense로 감싸지 않는다(숨김 청크 —
   `src/__tests__/guards/serverDataSuspenseBoundaries.test.ts`). 렌더 후에도 보여야 하는 산문은 영구 서버
   sibling으로 둔다.
   server-only 정적화 헬퍼(`staticSymbolCache` 등)는 서버 파일에서만 import한다(client 번들 누출 방지).
4. **(축 3) `generateStaticParams=[]` + `revalidate`(리터럴) 유지.** revalidate 값은 페이지마다 다르다 —
   [`docs/architecture/ISR_REVALIDATE.md`](../../docs/architecture/ISR_REVALIDATE.md) 참조.

5. **(축 4) `unstable_cache` 안에서 locale 없이 `getTranslations()`를 부르지 않는다.** locale 인자가 없으면
   next-intl이 `headers()`로 폴백하는데 Next는 캐시 스코프 안의 `headers()`를 거부(E838)해 원래 오류를
   "Accessing Headers in cached context"로 가린다. locale은 캐시 스코프 밖에서 뽑아 인자로 넘기거나, 번역
   실패를 치명적이지 않게 만든다.

> ⚠️ 빌드 output의 `●`(SSG) 표시 ≠ 런타임 동작. 반드시 `prod build && start` 후
> 런타임 로그의 `DYNAMIC_SERVER_USAGE` 0 + `x-nextjs-cache` HIT로 실측 검증한다.
> (설계: `docs/superpowers/specs/2026-06-02-symbol-isr-seo-design.md`,
> 플랜: `docs/superpowers/plans/2026-06-02-symbol-isr-seo-phase0-1.md` · `…-phase2-4.md`)

---

## SEO / Metadata

<a id="AP-4"></a>

#### AP-4 — 새 top-level 페이지 라우트는 머지 전에 발견 가능하고 완결돼야 한다

`app/*`에 새 페이지(`/economy`, `/[symbol]/holdings` 등)를 추가하면 다음을 한 번에 갖춘다. review-agent의
무결점 승인만으로는 부족하므로 머지 전 `seo-audit`로 고아 라우트를 확인한다.

1. 정적 sitemap 항목(`buildStaticEntries.ts`)
2. 내부 링크(Footer·내비 메뉴·본문 맥락) — 고아 페이지 금지
3. SSR 텍스트 — 클라 전용 컴포넌트 브리지만 있으면 크롤러는 빈 skeleton을 본다. SSR 텍스트 사본을 둔다
4. 메타데이터 — JSON-LD `dateModified`, robots, canonical, keywords가 본문과 일치. degraded 상태는 robots·canonical이 함께 맞아야 한다
5. e2e — 봇 UA로 본문 텍스트(skeleton 아님)·메타·degrade 경로를 검증

schema.org 타입은 의미가 맞는 것만 쓴다. `FinancialProduct`는 대출·카드·보험용이지 분석 서비스가 아니고,
이미 `WebPage`·`about.Corporation`이 덮는 내용을 다른 타입으로 중복하지 않는다. `Article.datePublished`는
최초 발행 시각이며 요청 시각이 아니다(갱신 시각은 `dateModified`).

<a id="AP-3"></a>

#### AP-3 — `generateMetadata`는 모든 필드를 명시한다

route의 `generateMetadata`가 필드(description, robots, canonical …)를 빼면 Next가 root layout 값을 상속해
서로 다른 URL이 같은 메타를 갖게 된다. 라우트별로 달라야 하는 필드는 전부 명시한다.

- not-found·에러 경계도 description을 명시한다(생략하면 모든 존재하지 않는 URL이 홈 description을 낸다).
- 동적 콘텐츠에서 유도한 description은 접두에 라우트/뷰 구분자(탭 이름 등)를 넣는다. 같은 긴 문장으로
  시작하는 두 탭이 길이 제한(`SEO_DESCRIPTION_MAX_LENGTH`)에서 잘리면 바이트 동일한 description이 된다.
- "Next가 `robots`를 병합하지 않고 교체한다"를 고칠 때는 모든 호스트의 `robots:` 생산자(`src/app/ai/**` 포함)를
  grep해 색인 가능한 분기를 `localePageRobots`로 통일한다. 한 호스트만 고치면 preview 지시자가 다른 호스트에서 빠진다.

❌ `not-found.tsx`: `{ title, robots }`만 반환 → home description 상속
✅ `{ title, description: '…', robots: 'noindex' }`

---

## proxy.ts

- **인증 리다이렉트는 쿼리를 보존한다.** `AUTH_REQUIRED_PATHS` 가드는 페이지 가드보다 먼저 실행돼 놓치기 쉽다.
  `next`에는 경로와 쿼리를 함께 넣고(`localePath(locale, pathname) + reqUrl.search`), sanitizer는 ①대상이
  guest-only 경로가 아닌지 ②쿼리가 끝까지 보존되는지를 모두 검증한다.
  ❌ `loginUrl = localePath(locale, pathname)` — `/account?tab=profile`이 로그인 뒤 `/account`가 된다.
- **호스트 비교는 양쪽을 소문자로 정규화하고 실제 `Host` 헤더를 읽는다.** `req.url.host`는 `next start`가
  바인드 주소로 다시 만든 값이라 Host 헤더와 다를 수 있다. URL 파서가 소문자화한 `target.host`를 원본
  헤더와 비교하면 대소문자 불일치에서 루프 가드가 깨진다.
- 경로 가드 목록(`AUTH_REQUIRED_PATHS` 등)은 한 곳을 단일 소스로 두고 다른 가드가 공유한다.

---

## Next.js 16 Notes

- Use `proxy.ts` instead of `middleware.ts` (if needed)
- `cacheComponents` (PPR)는 현재 비활성화 — 활성화 시 dynamic route의 `generateMetadata`가
  fake-params로 prerender되어 canonical에 `[SYMBOL]` placeholder가 박히는 문제를 다시
  검토해야 한다.
- `cacheComponents`를 다시 켤 때의 체크리스트: provider·클라 컴포넌트에서 prerender 중 `Date.now()` /
  `new Date()`를 부르지 않는다(필요하면 `<Suspense>`로 요청 시점까지 미룬다). 캐시 대상 서버 함수에는
  `'use cache'`를 명시한다. 지금(꺼진 상태)은 적용되지 않는다.

---

## Design Rules

See `docs/conventions/DESIGN.md` for the full color system and Tailwind CSS rules.
