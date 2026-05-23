# App Layer Rules

## Core Principle

Next.js App Router layer. Handles RSC (React Server Components) and Route Handlers.
This folder is **routing only** — do not implement business logic or UI components here.

---

## Dependency Rules

```
✅ Allowed: infrastructure, domain, lib imports
❌ Forbidden: implementing business logic directly in route files
```

---

## RSC (React Server Components)

- Page files like `app/[symbol]/page.tsx` are server components
- Data fetching → call infrastructure
- Indicator calculations → call domain
- 클라이언트로 초기 데이터를 전달할 때는 props 드릴링 대신 HydrationBoundary 패턴을 사용한다 (아래 Data Flow 참고)

### Data Flow (Initial Page Load)

서버(RSC)에서 클라이언트로 초기 데이터를 주입할 때는 props 드릴링 대신
`queryClient.prefetchQuery()` + `dehydrate()` + `HydrationBoundary` 패턴을 사용한다.

```
/AAPL request
  → app/[symbol]/page.tsx (RSC)
    → QueryClient (per-request, server-only) 생성
    → queryClient.prefetchQuery(bars) → infrastructure/market/barsApi.ts → Market API
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

> **Note (cacheComponents 활성화 / phase 1):** `next.config.ts`에서 `cacheComponents: true`
> 상태이며 next 버전은 16.1.2로 pin되어 있다(16.2.x resumable slots 회귀 회피 — 이슈 #439).
> 활성화와 동시에 `'use cache'` / `cacheLife` / `cacheTag` 지시어도 복구되었으며
> (fundamentalData, newsData, getBarsAction, loader, CurrentYear), 이는 cacheComponents가
> opt-in 캐싱을 강제하기 때문이다 — prerender 가능한 server component는 명시적 cache
> 지시어 없이는 build가 실패한다. cacheLife profile(options-market-open/closed/weekend)
> 도입은 후속 PR로 분리. Route Handler에서 `export const dynamic = 'force-dynamic'`은
> incompatible — 제거하고 Cache-Control 헤더로 CDN cache를 제어한다.

---

## Server Actions

Server Actions are defined in `infrastructure/market/` and called directly from hooks.

- `getBarsAction` — returns bars + indicators for timeframe switch
- `analyzeAction` — AI re-analysis with skills

---

## Next.js 16 Notes

- Use `proxy.ts` instead of `middleware.ts` (if needed)
- Follow App Router conventions
- `cacheComponents` (PPR)는 활성화 상태(phase 1). dynamic route의 `generateMetadata`가
  fake-params로 prerender되어 canonical에 `[SYMBOL]` placeholder가 박히는 문제는 phase 2
  ('use cache' 복구 + dynamic metadata 처리 재설계)에서 함께 다룬다 — Vercel preview
  배포에서 해당 증상이 재발하면 그 시점에 다시 검토.

---

## Design Rules

See `docs/DESIGN.md` for the full color system and Tailwind CSS rules.

---

## Common Mistakes

- Implementing domain logic in route handlers → delegate to domain/
- No caching strategy, calling API every request → use `fetch`의 `next: { revalidate }`
- Exposing internal error details in responses → return generic messages to client
