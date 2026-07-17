# Portfolio Holdings Foundation (Subsystem A) — Design

- **Date**: 2026-07-17
- **Status**: Design (pending implementation)
- **Position**: Subsystem **A** of the member portfolio feature (`A → B → D → C`).
  - **A** (this spec): store member holdings + CRUD + input/management UI + validation.
  - B: "where am I" pyramid visualization (needs A).
  - D: weave "analyze with my average price" into signup nudge copy (needs A).
  - C: personalize AI analysis with the average price (needs A; **requires a `@y0ngha/siglens-core` release** — out of scope here).

## 1. Goal & scope

A logged-in member records the stocks they hold — **symbol, quantity, average purchase price** — so later subsystems can visualize their position (B) and personalize AI analysis (C).

**In scope (A):**
- A new `portfolio_holdings` table (one row per `(user, symbol)`; user inputs the average price directly — not a transaction/lot ledger).
- `entities/portfolio` slice: repository, server actions, validation, query hooks.
- Three input/management surfaces: account-page section, symbol-page header chip, post-signup onboarding.
- Validation: shape + existence (soft/degrade-tolerant), numeric bounds.
- Tests to the repo's 90% coverage target.

**Out of scope (later subsystems):**
- Using the average price in AI analysis (C) — needs core release + cache-key design.
- The pyramid "where am I" visualization (B).
- Profit/loss / current-value display beyond a plain readout (needs live price; belongs to B).
- Signup-nudge copy changes (D).

**Cross-repo guard:** A is siglens-local. It touches no indicator/signal/prompt/cache-key/tier-policy logic, so it does **not** trip the `siglens-core` scope guard. (C will.)

## 2. Confirmed decisions

| Decision | Choice | Source |
|---|---|---|
| Data granularity | One position per `(user, symbol)`; direct average-price input | user |
| Post-signup flow | Selective, skippable onboarding | user |
| Inline control placement | Header chip next to `ReasoningToggle` | user |
| Symbol validation | Existing real ticker only | user |
| Access gate | **Authenticated presence** (`useCurrentUser().data !== null`), NOT tier | critical review |
| Read action on logout | Return `[]` — never `redirect()` | critical review |
| Numeric scale | `quantity numeric(24,8)`, `averagePrice numeric(20,8)` | critical review |
| Client cache source of truth | Single React Query list query, shared by all surfaces | critical review |
| Existence check failure mode | `null` → reject; thrown (FMP degraded) → **allow** save | critical review |

## 3. Data model

New table in `src/shared/db/schema.ts` (mirrors `userApiKeys`):

```
portfolio_holdings
  id            uuid PK  defaultRandom()
  userId        uuid     → users.id  onDelete: 'cascade'   (NOT NULL)
  symbol        varchar(32)   NOT NULL   -- canonical UPPERCASE
  companyName   text          -- persisted from getAssetInfo at write time (display without re-resolve)
  fmpSymbol     text          -- persisted from getAssetInfo (nullable)
  quantity      numeric(24,8) NOT NULL   -- fractional / crypto-friendly
  averagePrice  numeric(20,8) NOT NULL   -- USD
  createdAt     timestamptz   NOT NULL default now()
  updatedAt     timestamptz   NOT NULL default now()

  indexes: uniqueIndex(userId, symbol), index(userId)
```

- Drizzle `numeric` maps to string in/out — validation and formatting treat these as decimal strings, never JS floats.
- Migration: `yarn db:generate` emits `drizzle/0026_*.sql` (0025 is the current head), applied with `yarn db:migrate`.
- Repository interface `PortfolioHoldingRepository` + record/input types go in `src/shared/db/types.ts` (mirror `UserApiKeyRepository`).

## 4. Entity slice `entities/portfolio`

```
entities/portfolio/
├── model.ts        PortfolioHolding, PortfolioHoldingInput, validation result types
├── api.ts          DrizzlePortfolioRepository implements PortfolioHoldingRepository
├── actions.ts      barrel (NO 'use server')
├── actions/
│   ├── getPortfolioHoldingsAction.ts   'use server'
│   ├── savePortfolioHoldingAction.ts   'use server' (upsert)
│   └── deletePortfolioHoldingAction.ts 'use server'
├── lib/
│   ├── validateHoldingInput.ts   pure: normalize + shape + numeric bounds
│   └── db.ts                     thin client wrapper (mirror api-key)
├── hooks/
│   └── usePortfolioHoldings.ts   React Query list + mutations
├── __tests__/
└── index.ts        barrel — EXCLUDES DrizzlePortfolioRepository (server-only)
```

**Repository** (`api.ts`, mirrors `entities/api-key/api.ts`): `list(userId)`, `get(userId, symbol)`, `upsert(input)` via `onConflictDoUpdate({ target: [userId, symbol] })`, `delete(userId, symbol)`. Writes wrapped in `withRetry(..., NEON_TRANSIENT_RETRY)`.

**Actions** — each begins with `getCurrentUser()`:
- `getPortfolioHoldingsAction()` → **returns `[]` when unauthenticated** (never redirects; it is polled by a React Query `queryFn`).
- `savePortfolioHoldingAction(input)` → **uniformly non-redirecting**: on unauthenticated, return a typed error state (chip popover surfaces it); otherwise validate → canonicalize symbol server-side → existence check → upsert → return typed result. Page-level auth is already enforced by the account RSC (`getCurrentUser()` → `redirect('/login?next=/account')` before the form ever renders), so the action itself never redirects. One action, one behavior.
- `deletePortfolioHoldingAction(symbol)` → auth guard → delete → typed result.

**Barrel discipline** (copy `api-key` verbatim): `index.ts` excludes the Drizzle repo; server consumers import `@/entities/portfolio/api`; if the `actions.ts` barrel transitively pulls a heavy ESM (`@google/genai` via ticker), the hook is deep-imported (`@/entities/portfolio/hooks/usePortfolioHoldings`) like `useAssetInfo`/`useBars`. Verify at implementation time.

## 5. Validation

Server-authoritative, layered:
1. **Shape (always authoritative):** `isAdmissibleSymbolShape` (`shared/config/ticker.ts`) + uppercase/trim canonicalization. Rejects malformed input deterministically, independent of any external service.
2. **Numeric bounds:** `quantity > 0`, `averagePrice > 0`, decimal scale ≤ column scale (reject silent rounding), sane upper bounds (reject absurd values). Parse as decimal strings.
3. **Existence (soft / degrade-tolerant):** call `getAssetInfo(symbol)` (`entities/ticker/lib/getAssetInfo.ts`, Redis-cached 12h–1yr):
   - returns `null` → symbol genuinely does not exist → **reject**.
   - returns `AssetInfo` → accept; persist `companyName`/`fmpSymbol` on the row.
   - **throws** (FMP infra failure) → treat as "cannot verify right now" → **accept** the shape-valid symbol (do not block CRUD on an FMP outage; mirror `getAssetInfoResilient` policy).

Canonicalization must run **before** the upsert so `onConflictDoUpdate` and `uniqueIndex(userId, symbol)` stay coherent (`aapl`/`AAPL` collapse to one row).

## 6. Client data & caching (single source of truth)

All surfaces read the **same** React Query list query — no per-symbol fetch, no dual-source drift:

- New key `QUERY_KEYS.portfolioHoldings()` → `['portfolio-holdings']` in `shared/config/queryConfig.ts` (+ `PORTFOLIO_HOLDINGS_STALE_TIME_MS`, e.g. 5 min like user-tier).
- `usePortfolioHoldings()` fetches the full list once (`enabled: isHydrated`, mirror `useAssetInfo`). The chip derives its symbol's holding with `select`/client filter — never a separate query.
- Mutations (`save`/`delete`) `invalidateQueries({ queryKey: QUERY_KEYS.portfolioHoldings() })` on success, so the chip **and** an open account tab both refresh from one signal.
- **Account section is a client component** using the same `usePortfolioHoldings()` (not server-read props), so both surfaces share one cache. Trade-off: a brief loading skeleton on first account paint — acceptable (account is auth-gated + `noindex`). This is the deliberate reconciliation of the "server-read vs RQ" dual-source risk.

## 7. UI surfaces (phased)

Design references `frontend-design` + `web-design-guidelines`; reuse existing tokens/patterns (`ring-secondary-800`, `bg-secondary-900/80`, `rounded-2xl` sections; `InfoTooltip`; a11y hooks `useFocusTrap`/`useEscapeKey`/`useOnClickOutside`).

### A1 — Account-page section (`features/portfolio-management`)
- A new `<section aria-label="보유종목">` in `app/account/page.tsx`, styled like the API-key section.
- `PortfolioSection` (client): holdings list (symbol, company, qty, avg price) with per-row edit/delete, plus an add form.
- Add/edit form uses `TickerAutocomplete` (`features/ticker-search`) for the symbol field — its results come from the cached `searchTicker`, so only real symbols are selectable (happy path), with the server existence check as the authoritative guard.
- Empty state: friendly prompt to add the first holding.

### A2 — Symbol-page header chip (`features/portfolio-holding`)
- A compact chip in `views/symbol/SymbolLayoutHeader.tsx` next to `ReasoningToggle`, behind `Suspense fallback={null}` (mirror `FearGreedHeaderChipMounted`).
- **Gated on authenticated presence**, not tier: render `null` until `useCurrentUser` is hydrated AND `data !== null`. No `cookies()`/`headers()` in the layout shell (ISR-safe; identical to how `useUserTier`/`ReasoningToggle` already work). A logged-in `free`-tier user still sees their chip.
- States: unset → `내 평단 설정`; set → `내 평단 $150.00 · 100주 · 수정`. Reads the current symbol's holding from the shared list query via `select`.
- Click opens a small popover/dialog (compose `useFocusTrap` + `useEscapeKey` + `useOnClickOutside`, following `AnalysisSignupNudgeModal`) to set/edit **without leaving the page**; on save → `invalidateQueries(portfolioHoldings)`.
- Dual-mount caveat (desktop inline + mobile row render twice): no mount side-effects/analytics in the chip (per `SymbolModelContext` warning).

### A3 — Onboarding (`/onboarding`) — highest risk, done last
- Skippable dedicated route offering to add holdings after signup.
- **`next`-path reconciliation:** signup's `registerAction` ends with `redirect(next)` where `next` is the return-to path. Rule: redirect to `/onboarding` **only when `next` is the home default (`/`)**; otherwise preserve `next` (a user who signed up from `/AAPL` returns to `/AAPL`). Onboarding's "skip"/"done" then routes to `next`/home.
- Cover **both** signup entry points: email (`features/auth-signup/actions/registerAction`) and OAuth (`app/signup/oauth/consent`). If wiring both cleanly proves to entangle the auth flow, **pause and request user input** rather than forcing it.
- Email is unverified at signup completion (`emailVerified=false`, auto-login) — onboarding does not depend on verification.

## 8. Edge cases

- Unauthenticated hitting a portfolio action: read → `[]`; write → error state (no navigation hijack).
- Duplicate symbol add → upsert overwrites (by design; edit == re-add).
- Deleting a non-existent row → no-op success.
- FMP degraded during add → shape-valid symbol accepted, `companyName`/`fmpSymbol` left null, backfilled on next successful resolve.
- Very large/precise numbers → rejected by scale/upper-bound validation before DB rounding.
- Symbol casing (`aapl`) → canonicalized server-side.

## 9. Testing (90% target)

- **vitest**: `validateHoldingInput` (shape, bounds, scale, casing), repository (upsert conflict, delete, list scoping by userId), each action (auth guard, `[]`-on-logout for read, existence null-reject vs throw-accept, canonicalization-before-upsert), `usePortfolioHoldings` (list + invalidation).
- **component**: `PortfolioSection` (list/add/edit/delete/empty), header chip (hidden when logged out/hydrating, set/unset states, popover save→invalidate).
- **playwright**: authed `storageState` happy path — add a holding on the account page, see the chip reflect it on `/AAPL`; worst-case (invalid symbol rejected). Follow the model-gate authed-storageState pattern.

## 10. Implementation phasing

Ship in order; each phase is independently reviewable via the Claude Code Review Loop:
- **A1** — schema + migration + `entities/portfolio` + account section + tests. The true foundation; deliverable alone.
- **A2** — header chip + reactive shared-query design + tests.
- **A3** — onboarding + auth-flow redirect reconciliation + tests. Riskiest; escalate to the user if the auth-flow wiring gets entangled.

## 11. Risks & open items

- **A3 auth-flow risk** — modifying signup redirect targets across two entry points carries regression risk on an existing multi-phase flow. Mitigation: `next === '/'`-only redirect, both entry points covered, escalate if entangled.
- **Existence-check cost** — one cold FMP round-trip per never-seen symbol on save; warm/cached otherwise. Acceptable (matches `getAssetInfo` usage elsewhere).
- **C dependency** — this spec deliberately does not touch analysis; C's cache-key/prompt work is a separate core-release effort.
