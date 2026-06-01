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
applied`로 **config를 조용히 무시 → ISR이 깨진다**. 따라서 **`docs/MISTAKES.md` §15(매직넘버
상수 추출)은 route segment config에 적용하지 않는다** — 리터럴을 유지하고 `// 1h` / `// 30d`
인라인 코멘트로 의미만 표기한다. (`app/page.tsx`도 이미 `revalidate = 3600` 리터럴.)

동적 세그먼트(`[symbol]`) 라우트는 `revalidate`만으로 ISR이 걸리지 않는다 — `ƒ (Dynamic)`로
남아 매 요청 렌더된다. **`export async function generateStaticParams() { return [] }`**(빈 배열 =
on-demand ISR)를 함께 export해야 빌드에서 `● (SSG)`로 전환된다. 메타데이터 이미지
(opengraph/twitter)는 `export const dynamic = 'force-static'`로 정적화한다 — `force-static`은
`cookies()/headers()/searchParams`만 비우고 `params`는 유지하므로 종목별로 정상 렌더된다.

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

See `docs/DESIGN.md` for the full color system and Tailwind CSS rules.

---

## Common Mistakes

- Implementing domain logic in route handlers → delegate to entities/features/shared
- No caching strategy, calling API every request → use `fetch`의 `next: { revalidate }`
- Exposing internal error details in responses → return generic messages to client
