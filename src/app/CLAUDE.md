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

// function-level caching (Next.js 16)
async function fetchBars(symbol: string) {
    'use cache';
    // ...
}
```

---

## Server Actions

Server Actions are defined in `infrastructure/market/` and called directly from hooks.

- `getBarsAction` — returns bars + indicators for timeframe switch
- `analyzeAction` — AI re-analysis with skills

---

## Next.js 16 Notes

- Use `proxy.ts` instead of `middleware.ts` (if needed)
- `'use cache'` directive for explicit caching
- Follow App Router conventions

---

## Design Rules

See `docs/DESIGN.md` for the full color system and Tailwind CSS rules.

---

## Common Mistakes

- Implementing domain logic in route handlers → delegate to domain/
- No caching strategy, calling API every request → use `revalidate` or `'use cache'`
- Exposing internal error details in responses → return generic messages to client
