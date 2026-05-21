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

> **Note (cacheComponents 비활성화):** 현재 `next.config.ts`에서 `cacheComponents`는
> 비활성화 상태다. PPR resumable slots 오류로 인한 SEO metadata placeholder 누출 때문에
> 임시로 꺼 둔 상태이며, 추후 재활성화 시 `'use cache'` / `cacheLife` / `cacheTag` 패턴과
> dynamic metadata 처리 방식을 함께 재설계해야 한다.

---

## Server Actions

Server Actions are defined in `infrastructure/market/` and called directly from hooks.

- `getBarsAction` — returns bars + indicators for timeframe switch
- `analyzeAction` — AI re-analysis with skills

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

- Implementing domain logic in route handlers → delegate to domain/
- No caching strategy, calling API every request → use `fetch`의 `next: { revalidate }`
- Exposing internal error details in responses → return generic messages to client
