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
```

---

## RSC (React Server Components)

- Page files like `app/[symbol]/page.tsx` are server components
- Data fetching: call entity/feature actions or shared/api
- Indicator calculations: delegated to @y0ngha/siglens-core or entity/feature layers
- Client components are composed via widget layer

### Data Flow (Initial Page Load)

서버(RSC)에서 클라이언트로 초기 데이터를 주입할 때는 props 드릴링 대신
`queryClient.prefetchQuery()` + `dehydrate()` + `HydrationBoundary` 패턴을 사용한다.

```
/AAPL request
  → app/[symbol]/page.tsx (RSC)
    → QueryClient (per-request, server-only) 생성
    → queryClient.prefetchQuery(bars) → entities/bars getBarsAction
    → dehydrate(queryClient) → HydrationBoundary로 클라이언트에 전달
  → SymbolPageClient (HydrationBoundary 안)
    → useBars: hydrated 캐시에서 즉시 읽기
    → useAnalysis: 마운트 시 자동 AI 분석 트리거
```

### Caching

```typescript
// fetch caching
const data = await fetch(url, {
    next: { revalidate: 60 },
});
```

> **Note (cacheComponents 비활성화):** 현재 `next.config.ts`에서 `cacheComponents`는
> 비활성화 상태다. PPR resumable slots 오류로 인한 SEO metadata placeholder 누출 때문에
> 임시로 꺼 둔 상태이며, 추후 재활성화 시 `'use cache'` / `cacheLife` / `cacheTag` 패턴과
> dynamic metadata 처리 방식을 함께 재설계해야 한다.

### ISR / Route Segment Config (⚠️ 리터럴 강제)

`export const revalidate` / `dynamic` 등 route segment config는 **반드시 정적 분석 가능한
리터럴**이어야 한다. import한 상수나 식(`SECONDS_PER_HOUR`, `60 * 60`)으로 추출하면 Next.js가
값을 정적 분석하지 못해 `⨯ Invalid segment configuration export detected ... configs not being
applied`로 **config를 조용히 무시 → ISR이 깨진다**. 따라서 **`docs/workflows/MISTAKES.md` §15(매직넘버
상수 추출)은 route segment config에 적용하지 않는다** — 리터럴을 유지하고 `// 1h` / `// 30d`
인라인 코멘트로 의미만 표기한다. (`app/page.tsx`도 이미 `revalidate = 3600` 리터럴.)

동적 세그먼트(`[symbol]`) 라우트는 `revalidate`만으로 ISR이 걸리지 않는다 — `ƒ (Dynamic)`로
남아 매 요청 렌더된다. **`export async function generateStaticParams() { return [] }`**(빈 배열 =
on-demand ISR)를 함께 export해야 빌드에서 `● (SSG)`로 전환된다. 메타데이터 이미지
(opengraph/twitter)는 `export const dynamic = 'force-static'`로 정적화한다 — `force-static`은
`cookies()/headers()/searchParams`만 비우고 `params`는 유지하므로 종목별로 정상 렌더된다.

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
   HTTP는 no-store fetch라 static generate가 `DYNAMIC_SERVER_USAGE`를 throw한다.
   `unstable_cache`(= `staticSymbolCache`, revalidate 1h + `symbol:` tag)로 감싸야 ISR이
   데이터를 HTML에 박고 정적 캐시한다. (단 축 0이 선결돼야 효과가 있다.) 신선도가 민감한
   라우트(news)는 `news:${symbol}` 그룹 태그를 추가로 달고, 데이터 변경(뉴스 ingestion) 직후
   `revalidateTag('news:${symbol}', 'max')`로 **on-demand 무효화**해 1h를 기다리지 않고 갱신한다
   (Next 16의 `revalidateTag`는 2번째 profile 인자 필수 — 단일 인자는 deprecated).
3. **(축 2) `useSearchParams` CSR bailout 밖으로 SEO 콘텐츠 분리.** `useSearchParams`(예:
   timeframe)를 쓰는 클라 위젯은 SSR HTML이 비므로, 크롤 가능 텍스트(FactLayer)는
   Suspense fallback에 서버 컴포넌트로 박는다(`TechnicalFactsSummary`/`OverallFactsSummary`).
   경량 순수 컴포넌트라 widget barrel로 노출 가능; server-only 정적화 헬퍼(`staticSymbolCache` 등)는
   barrel 제외하고 lib/deep 경로로 import한다(client 번들 누출 방지).
4. **(축 3) `generateStaticParams=[]` + `revalidate=3600`(리터럴) 유지.**

> ⚠️ 빌드 output의 `●`(SSG) 표시 ≠ 런타임 동작. 반드시 `prod build && start` 후
> 런타임 로그의 `DYNAMIC_SERVER_USAGE` 0 + `x-nextjs-cache` HIT로 실측 검증한다.
> (설계: `docs/superpowers/specs/2026-06-02-symbol-isr-seo-design.md`,
> 플랜: `docs/superpowers/plans/2026-06-02-symbol-isr-seo-phase0-1.md` · `…-phase2-4.md`)

---

## Server Actions

Server Actions are defined within FSD slices (entities/*/actions/, features/*/actions/) and called from widget hooks.

---

## Next.js 16 Notes

- Use `proxy.ts` instead of `middleware.ts` (if needed)
- Follow App Router conventions
- `cacheComponents` (PPR)는 현재 비활성화 — 활성화 시 dynamic route의 `generateMetadata`가
  fake-params로 prerender되어 canonical에 `[SYMBOL]` placeholder가 박히는 문제를 다시
  검토해야 한다.

---

## Design Rules

See `docs/conventions/DESIGN.md` for the full color system and Tailwind CSS rules.

---

## Common Mistakes

- Implementing domain logic in route handlers → delegate to entities/features/shared
- No caching strategy, calling API every request → use `fetch`의 `next: { revalidate }`
- Exposing internal error details in responses → return generic messages to client
