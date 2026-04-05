# App Layer Rules

## Core Principle

Next.js App Router layer. Handles RSC (React Server Components) and Route Handlers.
This folder is **routing only** — do not implement business logic or UI components here.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.
**Internal API spec:** `→ see docs/SIGLENS_API.md` for request/response schemas.

---

## RSC (React Server Components)

- Page files like `app/[symbol]/page.tsx` are server components
- Data fetching → call infrastructure
- Indicator calculations → call domain
- Pass results as props to Client Components (components/)

---

## Route Handlers (API)

- `GET /api/bars` — bars + indicators on timeframe switch
- `POST /api/analyze` — AI re-analysis

`→ see docs/SIGLENS_API.md` for full request/response schemas.

---

## Caching

```typescript
// fetch caching
const data = await fetch(url, { next: { revalidate: 60 } });

// function-level caching (Next.js 16)
async function fetchBars(symbol: string) {
    'use cache';
}
```

---

## Next.js 16 Notes

- Use `proxy.ts` instead of `middleware.ts` (if needed)
- `'use cache'` directive for explicit caching
