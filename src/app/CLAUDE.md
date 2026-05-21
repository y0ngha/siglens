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

## Dynamic Metadata in PPR (cacheComponents) Mode — Required Pattern

`cacheComponents: true`(Next.js 16 PPR) 환경에서 `[param]` 같은 dynamic route segment의
`generateMetadata`는 페이지 본문과 **별도의 prerender entry**로 실행된다.
본문에 `await connection()`을 두어도 metadata는 별도 entry라 영향 받지 않을 수 있으며,
빌드 시 fake-params(예: `'[symbol]'`)로 prerender되어 그 결과가 PPR shell에 캐싱된다.
결과적으로 모든 동적 페이지가 동일한 placeholder canonical(`https://example.com/[SYMBOL]/...`)을
발급하여 Google Search Console에서 critical 캐노니컬 충돌을 유발한다. (PR #437/#438 사례)

### Rule

dynamic route segment 안의 `generateMetadata`는 **반드시 한 가지 dynamic signal을 명시**해야 한다.

| `generateMetadata`가 사용하는 것 | 추가 신호 필요? | 이유 |
|---|---|---|
| `await searchParams` | 필요 없음 | `searchParams` 자체가 runtime data → dynamic 자동 표시 |
| `await params`만 (searchParams 없음) | **`await connection()` 첫 줄에 명시** | `params`만으로는 PPR이 prerendable로 판단하고 fake-params로 캐싱한다 |
| `cookies()` / `headers()` 사용 | 필요 없음 | runtime API가 dynamic 자동 표시 |

### Default page function — body의 connection은 별개 관심사

페이지 **본문**의 `await connection()`은 `generateMetadata`의 placeholder 문제와 **무관**하다.
본문 connection은 `Date.now()`, `Math.random()` 같이 본문에서 사용하는 비결정 값이 prerender 시점
값으로 굳지 않게 만들기 위한 표시이며, metadata entry에는 영향을 주지 못한다.

본문 connection 사용 기준:
- 본문이 `await searchParams`, `cookies()`, `headers()`를 이미 호출한다면 **불필요**
- 본문에서 `Date.now()` 등 비결정 값을 사용한다면 **필요**
- 본문이 어떠한 dynamic signal도 없이 cached fetcher만 호출한다면 **필요** (예: `news/page.tsx`)

### Code template — params-only generateMetadata

```typescript
import { connection } from 'next/server';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    // params만 의존 → PPR shell이 fake-params로 prerender하지 않도록 명시.
    await connection();
    const { symbol } = await params;
    // ...
}
```

### Verification on production

배포 후 `curl <production-url> | grep -E "<title|canonical"`로 placeholder가 박혀 있지 않은지
확인한다. local `yarn build && yarn start`만으로는 Vercel-specific PPR 동작을 재현하지 못해
local에서는 정상이라도 production에서는 placeholder가 박힐 수 있다.

---

## Design Rules

See `docs/DESIGN.md` for the full color system and Tailwind CSS rules.

---

## Common Mistakes

- Implementing domain logic in route handlers → delegate to domain/
- No caching strategy, calling API every request → use `revalidate` or `'use cache'`
- Exposing internal error details in responses → return generic messages to client
