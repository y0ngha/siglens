# Infrastructure Layer Rules

## Core Principle

Handles communication with external systems (Alpaca API, AI Providers, Skills file I/O).
Define interfaces (`types.ts`) **before** implementation.

---

## Dependency Rules

```
✅ Allowed: domain imports
❌ Forbidden: components, app, lib imports
```

---

## Function Rules

- Always use `export function` (named function declaration)
- No `export default` or arrow function exports
- Classes allowed only for special cases (e.g., Skills Loader)
- Define interfaces in `types.ts` before implementing

```typescript
// ✅ Correct
export function fetchBars(symbol: string, timeframe: Timeframe): Promise<Bar[]> { ... }

// ❌ Forbidden
export default function fetchBars(...) { ... }
export const fetchBars = async (...) => { ... }
```

---

## Module Structure

### market/ (Alpaca API)

- **Auth**: `ALPACA_API_KEY`, `ALPACA_API_SECRET` (env vars)
- **Base URL**: `https://data.alpaca.markets`
- **Rate Limit**: Free plan 200 req/min
- **Data Delay**: 15 min (free plan, no SIP feed)

#### Key Endpoints

| Purpose | Method | Endpoint |
|---|---|---|
| Historical bars | GET | `/v2/stocks/{symbol}/bars` |
| Latest bar | GET | `/v2/stocks/{symbol}/bars/latest` |
| Snapshot | GET | `/v2/stocks/{symbol}/snapshot` |

#### Required Headers

```
APCA-API-KEY-ID: {API_KEY}
APCA-API-SECRET-KEY: {SECRET_KEY}
```

#### Bar Query Parameters

| Parameter | Required | Description |
|---|---|---|
| timeframe | Y | `1Min`, `5Min`, `15Min`, `1Hour`, `1Day` |
| start | N | RFC 3339 (bar start time) |
| end | N | RFC 3339 (bar end time) |
| limit | N | max 10000, default 1000 |
| feed | N | `iex` (free), `sip` (paid) |
| page_token | N | Pagination |

### ai/ (AI Provider)

- Supports multiple AI providers (Claude, Gemini, etc.)
- Interchangeable via common interface
- Provider selected by `AI_PROVIDER` env var

### skills/ (Skills Loader)

- Reads `skills/*.md` files and parses into `Skill[]`
- Handled by `FileSkillsLoader` class
- File format: YAML frontmatter + Markdown body
- Parsed `Skill[]` is passed to `domain/analysis/prompt.ts`
- Domain has no file I/O, so infrastructure must load and inject

### market/barsApi.ts

- Used by `/api/bars` Route Handler
- Fetches bars from Alpaca, then calls domain indicator functions
- `infrastructure → domain` import is allowed by dependency rules

---

## Common Mistakes

- Using `export default` → use `export function`
- Starting implementation without types → define `types.ts` first
- Overusing `as` type assertions → use type guards or generics
- Using `any` type → use specific types or `unknown`
