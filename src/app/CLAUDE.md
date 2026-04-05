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
- Pass results as props to Client Components (components/)

### Data Flow (Initial Page Load)

```
/AAPL request
  → app/[symbol]/page.tsx (RSC)
    → infrastructure/market/alpaca.ts → Alpaca API (bars, count varies by timeframe)
    → domain/indicators/* → indicator calculations
    → domain/analysis/prompt.ts → AI prompt construction
    → infrastructure/ai → AI analysis
  → StockChart (initialBars)
  → AnalysisPanel (initialAnalysis)
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
See `docs/SIGLENS_API.md` for full specifications.

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
