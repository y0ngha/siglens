# Portfolio Holdings Foundation — Change-Scope Spec

- **Date**: 2026-07-17
- **Branch**: `feat/portfolio-holdings-foundation`
- **Design source**: `docs/superpowers/specs/2026-07-17-portfolio-holdings-foundation-design.md`
- **Purpose of this doc**: a tight, factual summary of WHAT changed, for an empirical (prod-build) verification pass. The executable checks live in the companion `2026-07-17-portfolio-holdings-TEST-CASES.md`.

This is Subsystem **A** of the member portfolio feature (store holdings + CRUD + input UI + validation). It is **siglens-local** — it touches no indicator/signal/prompt/cache-key/tier-policy logic, so it does **not** trip the `siglens-core` scope guard.

---

## 1. What changed — surfaces & routes

| Surface | Route / location | Auth | Indexable |
|---|---|---|---|
| Account holdings section | `/account` → new `<section aria-label="보유종목">` | member (RSC-redirects guests to `/login?next=/account`) | noindex (unchanged) |
| Symbol-page header chip | `/[symbol]` pages (`/AAPL`, `/AAPL/news`, …) header, next to `ReasoningToggle` | member only; **absent** for guests | ISR-cached, crawlable SSR unchanged |
| Onboarding | new route `/onboarding` | member (RSC-redirects guests to `/login?next=/onboarding`) | **noindex** |
| Signup redirect | email + (design-intended) OAuth signup | — | — |

---

## 2. What changed — files

**DB / schema**
- `drizzle/0026_wandering_typhoid_mary.sql` — new `portfolio_holdings` table (migration head moves 0025 → 0026). `drizzle/meta/*` snapshot + journal updated.
- `src/shared/db/schema.ts` — `portfolioHoldings` table (uuid PK, `userId` FK → `users.id` `onDelete: cascade`, `symbol varchar(32)`, `companyName text` nullable, `fmpSymbol text` nullable, `quantity numeric(24,8)`, `averagePrice numeric(20,8)`, `createdAt`/`updatedAt` timestamptz; `uniqueIndex(userId, symbol)` + `index(userId)`).
- `src/shared/db/types.ts` — `PortfolioHoldingRepository` interface + record/input types.

**Entity slice `entities/portfolio`** (new)
- `model.ts` — `PortfolioActionErrorCode`, `PortfolioHoldingView`, `RawHoldingInput`, `ValidateHoldingResult`, `SavePortfolioResult`, `DeletePortfolioResult`.
- `api.ts` — `DrizzlePortfolioRepository` (`findByUser`, `get`, `upsert` via `onConflictDoUpdate({ target: [userId, symbol] })`, `deleteByUserAndSymbol`; writes wrapped in transient-retry). Server-only; excluded from the barrel.
- `actions/getPortfolioHoldingsAction.ts` — auth guard → returns `[]` when logged out (never redirects; polled by React Query). Read failure propagates (sets `isError`), not swallowed.
- `actions/savePortfolioHoldingAction.ts` — auth guard → runtime shape narrowing → `validateHoldingInput` → `getAssetInfo` existence check (null ⇒ reject; **throw ⇒ accept** degraded) → upsert. Never redirects.
- `actions/deletePortfolioHoldingAction.ts` — auth guard → shape guard → delete. Never redirects; missing row = no-op success.
- `actions.ts` — barrel (no `'use server'`).
- `lib/validateHoldingInput.ts` — pure: canonicalize symbol (`trim().toUpperCase()`) + `isAdmissibleSymbolShape` + decimal-string bounds (`quantity > 0` ≤ 1e9, `averagePrice > 0` ≤ 1e7, fractional scale ≤ 8, reject non-decimal/NaN).
- `lib/toView.ts` — row → `PortfolioHoldingView`.
- `hooks/usePortfolioHoldings.ts` — single React Query list (`enabled: isHydrated`) + `save`/`remove` mutations that `invalidateQueries` on success.
- `index.ts` — barrel; excludes the Drizzle repo (server-only).

**Features**
- `features/portfolio-management` (new) — `PortfolioSection` (list + inline edit + inline delete-confirm + add form), `HoldingForm` (add/edit; symbol via `TickerAutocomplete` in add mode, read-only chip in edit mode).
- `features/portfolio-holding` (new) — `PortfolioChipMounted` (presence-gates on `useCurrentUser().data`), `PortfolioChip` (unset/set states, code-split popover via `next/dynamic ssr:false`), `PortfolioChipPopover` (focus-trapped `role="dialog"`), `hooks/useSymbolHolding` (selects this symbol's holding from the shared list).
- `features/portfolio-onboarding` (new) — `OnboardingContent` (welcome header + reused `PortfolioSection` + "시작하기"/"나중에 하기").
- `features/ticker-search` — `TickerAutocomplete` + `useAutocomplete` gained **optional** props (`onSelect`, `navigateOnSelect`, `inputClassName`, `ariaInvalid`, `ariaDescribedby`, `ariaLabelledby`). Defaults unchanged (`navigateOnSelect` still defaults to `true`).
- `features/auth-signup/actions/registerAction.ts` — final `redirect(...)` now goes through `resolvePostSignupDestination(next)`.
- `features/auth-signup/.../finalizeOAuthSignupAction.ts` + `features/auth-logout/hooks/useLogout.ts` — touched (redirect/logout wiring).

**Shared**
- `shared/lib/auth/redirect.ts` — new `POST_SIGNUP_ONBOARDING_PATH = '/onboarding'` + `resolvePostSignupDestination(next)`: returns `/onboarding` **only when `next === '/'`**, otherwise preserves `next`.
- `shared/lib/trimTrailingZeros.ts` (new) — trims trailing fractional zeros from a decimal string for display, never through a JS float.
- `shared/config/queryConfig.ts` — `QUERY_KEYS.portfolioHoldings()` → `['portfolio-holdings']` + `PORTFOLIO_HOLDINGS_STALE_TIME_MS`.

**Views / pages**
- `views/symbol/SymbolLayoutHeader.tsx` — mounts `<PortfolioChipMounted symbol={ticker} />` in the header control cluster.
- `app/account/page.tsx` — adds the holdings section.
- `app/onboarding/page.tsx` (new) — RSC guard + `noindex` metadata + Suspense.

**Tests** — vitest suites for actions/api/validation/hooks/components; `app/onboarding/__tests__/page.test.ts`; `e2e/specs/portfolio-holdings.spec.ts` (authed storageState) + Playwright config/support tweaks.

---

## 3. User-visible behaviors

- **Member on `/account`**: a "보유종목" section — add a holding (symbol via autocomplete, 수량, 평단), see it listed (`{qty}주 · 평단 ${price}`), inline-edit, inline-delete (with a "삭제할까요?" confirm), empty-state prompt, read-error retry.
- **Member on `/[symbol]`**: a header chip. Unset → `평단 설정`; set → `평단 $150 · 10주` (price first, qty second, zeros trimmed). Clicking opens a focus-trapped popover to set/edit without leaving the page. The account section and the chip share one cache — a change in one reflects in the other after invalidation.
- **Guest on `/[symbol]`**: **no chip at all.**
- **Fresh signup with no return path** → lands on `/onboarding` (add holdings now or skip; both buttons go home). **Signup from a specific page** (`?next=/AAPL`) → returns to `/AAPL`, not onboarding.

---

## 4. Key invariants (what verification must protect)

1. **Auth-presence gating, NOT tier.** The chip renders only when `useCurrentUser().data` is a non-null record. `undefined` (in-flight) and `null` (guest) both hide it. A logged-in **free**-tier member sees it. No `cookies()`/`headers()` in the layout shell.
2. **Degrade-tolerant symbol resolution.** `getAssetInfo` returning `null` ⇒ reject (`symbol_not_found`). `getAssetInfo` **throwing** (FMP/DB outage) ⇒ **accept** the shape-valid symbol, persisting `companyName`/`fmpSymbol` as `null`. Shape validation is always authoritative and independent of any external service.
3. **ISR-safe, client-only chip.** The chip is a client component behind `PortfolioChipMounted`; its popover is `next/dynamic({ ssr: false })`. Consequently the chip is **absent from server-rendered HTML for everyone** (guest and member alike) — it only appears after client hydration + the holdings query. Symbol pages stay ISR-cacheable; their crawlable SSR HTML is unchanged.
4. **`/onboarding` is noindex.** `robots: { index: false, follow: false }` → `<meta name="robots" content="noindex, nofollow">` in the head.
5. **Decimal-string numeric handling.** `quantity`/`averagePrice` are stored and displayed as exact decimal strings (`numeric(24,8)`/`numeric(20,8)`), never coerced through JS floats. `trimTrailingZeros` handles display; `validateHoldingInput` rejects fractional scale > 8.
6. **Single React Query source of truth.** All surfaces read `QUERY_KEYS.portfolioHoldings()` (`['portfolio-holdings']`). The chip derives its symbol via a client-side `find`, never a separate query. Mutations invalidate this one key.
7. **COALESCE metadata preservation.** Editing an existing holding while resolution is degraded (`getAssetInfo` throws → `companyName`/`fmpSymbol` computed as `null`) must **not wipe** a previously-stored company name — the upsert preserves existing non-null metadata via COALESCE-style conflict handling. (Verify via DB/logs; see TEST-CASES §6.)
8. **Read on logout returns `[]`, never redirects.** Write actions on logout return a typed `unauthenticated` error, never a navigation hijack.
9. **`navigateOnSelect` default unchanged (`true`).** Existing site-header ticker search still routes to `/{symbol}` on select; only `HoldingForm` opts out (`navigateOnSelect={false}`).

---

## 5. Deployment note

Migration **`0026_wandering_typhoid_mary.sql`** creates `portfolio_holdings`. It **must be applied to the target DB before or with deploy** — in this repo that is a **manual release step** (`yarn db:migrate`), not an automatic deploy hook. Verification against a prod-like build must run `yarn db:migrate` first, or every holdings read/write will fail at the DB layer.
