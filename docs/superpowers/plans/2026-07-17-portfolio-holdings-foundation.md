# Portfolio Holdings Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in member store their holdings (symbol, quantity, average purchase price) and manage them from the account page, a symbol-page header chip, and a post-signup onboarding screen.

**Architecture:** New `portfolio_holdings` table (one row per `(user, symbol)`) behind a new `entities/portfolio` FSD slice (Drizzle repository + non-redirecting server actions + pure validation + one React Query list hook). Three UI surfaces all read the SAME React Query list query so cache invalidation is single-source. Gate is authenticated presence (not tier). Mirrors the existing `entities/api-key` slice verbatim for structure and barrel discipline.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), Drizzle ORM + Neon Postgres, React Query (@tanstack/react-query), Tailwind v4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-17-portfolio-holdings-foundation-design.md`

**Mirror reference (read these first):** `src/entities/api-key/{api.ts,index.ts,actions.ts,actions/*}`, `src/shared/db/schema.ts` (`userApiKeys`), `src/shared/db/types.ts` (`UserApiKeyRepository`), `src/features/api-key-management/ui/ApiKeySection.tsx`, `src/features/ticker-search/ui/TickerAutocomplete.tsx`, `src/features/reasoning-toggle/*`, `src/entities/ticker/hooks/useAssetInfo.ts`, `src/shared/config/queryConfig.ts`.

---

## File Structure

**Phase A1 — data + entity + account section**
- Create `src/shared/db/schema.ts` (modify: add `portfolioHoldings` table)
- Modify `src/shared/db/types.ts` (add `PortfolioHolding*` types + `PortfolioHoldingRepository`)
- Create `drizzle/0026_*.sql` (generated)
- Create `src/entities/portfolio/model.ts`
- Create `src/entities/portfolio/lib/validateHoldingInput.ts`
- Create `src/entities/portfolio/api.ts` (`DrizzlePortfolioRepository`)
- Create `src/entities/portfolio/actions/getPortfolioHoldingsAction.ts`
- Create `src/entities/portfolio/actions/savePortfolioHoldingAction.ts`
- Create `src/entities/portfolio/actions/deletePortfolioHoldingAction.ts`
- Create `src/entities/portfolio/actions.ts` (barrel)
- Create `src/entities/portfolio/index.ts` (barrel, excludes repo)
- Modify `src/shared/config/queryConfig.ts` (add key + stale time)
- Create `src/entities/portfolio/hooks/usePortfolioHoldings.ts`
- Create `src/features/portfolio-management/ui/PortfolioSection.tsx` (+ subcomponents)
- Create `src/features/portfolio-management/ui/HoldingForm.tsx`
- Create `src/features/portfolio-management/index.ts`
- Modify `src/app/account/page.tsx` (add section)
- Tests colocated under each slice's `__tests__/`

**Phase A2 — symbol-page header chip**
- Create `src/features/portfolio-holding/hooks/useSymbolHolding.ts`
- Create `src/features/portfolio-holding/ui/PortfolioChip.tsx`
- Create `src/features/portfolio-holding/ui/PortfolioChipPopover.tsx`
- Create `src/features/portfolio-holding/ui/PortfolioChipMounted.tsx` (Suspense wrapper)
- Create `src/features/portfolio-holding/index.ts`
- Modify `src/views/symbol/SymbolLayoutHeader.tsx` (mount the chip)

**Phase A3 — onboarding**
- Create `src/app/onboarding/page.tsx`
- Create `src/features/portfolio-onboarding/ui/OnboardingContent.tsx`
- Create `src/features/portfolio-onboarding/index.ts`
- Modify `src/features/auth-signup/actions/registerAction.ts` (redirect to `/onboarding` only when `next === '/'`)
- Modify the OAuth signup completion path (`src/features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts`) with the same rule

---

## Shared type contracts (used across tasks)

These names/signatures are fixed for the whole plan. Do not rename.

```ts
// src/shared/db/types.ts
export interface PortfolioHoldingRecord {
    id: string;
    userId: string;
    symbol: string;           // canonical UPPERCASE
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string;         // decimal string (numeric(24,8))
    averagePrice: string;     // decimal string (numeric(20,8))
    createdAt: Date;
    updatedAt: Date;
}

export interface UpsertPortfolioHoldingInput {
    userId: string;
    symbol: string;           // caller passes canonical UPPERCASE
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string;
    averagePrice: string;
}

export interface PortfolioHoldingRepository {
    findByUser(userId: string): Promise<PortfolioHoldingRecord[]>;
    findByUserAndSymbol(userId: string, symbol: string): Promise<PortfolioHoldingRecord | null>;
    upsert(input: UpsertPortfolioHoldingInput): Promise<PortfolioHoldingRecord>;
    deleteByUserAndSymbol(userId: string, symbol: string): Promise<boolean>;
}
```

```ts
// src/entities/portfolio/model.ts
export type PortfolioActionErrorCode =
    | 'unauthenticated'
    | 'invalid_symbol'
    | 'symbol_not_found'
    | 'invalid_quantity'
    | 'invalid_price'
    | 'storage_unavailable'
    | 'unknown';

export type SavePortfolioResult =
    | { status: 'ok'; holding: PortfolioHoldingView }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };

export type DeletePortfolioResult =
    | { status: 'ok' }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };

// Client-facing view (dates as ISO strings; server actions must map records to this).
export interface PortfolioHoldingView {
    symbol: string;
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string;
    averagePrice: string;
    updatedAt: string; // ISO
}

// Raw form input the validator consumes.
export interface RawHoldingInput {
    symbol: string;
    quantity: string;
    averagePrice: string;
}

export type ValidateHoldingResult =
    | { ok: true; symbol: string; quantity: string; averagePrice: string } // symbol canonicalized
    | { ok: false; code: PortfolioActionErrorCode; message: string };
```

```ts
// numeric scale constants (src/entities/portfolio/lib/validateHoldingInput.ts)
export const QUANTITY_SCALE = 8;
export const QUANTITY_MAX = 1_000_000_000;      // 1e9 shares upper bound
export const PRICE_SCALE = 8;
export const PRICE_MAX = 10_000_000;            // $10M/share upper bound
```

---

# Phase A1 — Data model + entity slice + account section

### Task 1: `portfolio_holdings` schema table

**Files:**
- Modify: `src/shared/db/schema.ts` (add after the `userApiKeys` table, ~line 176)

- [ ] **Step 1: Add the table.** Mirror `userApiKeys`. Reuse existing imports (`pgTable`, `uuid`, `text`, `varchar`, `numeric`, `timestamp`, `index`, `uniqueIndex`, `nowFn`, `SYMBOL_MAX_LENGTH`). If `numeric` is not yet imported from `drizzle-orm/pg-core`, add it.

```ts
/** Member portfolio holdings — one row per (user, symbol); the user inputs the average price directly (not a lot ledger). */
export const portfolioHoldings = pgTable(
    'portfolio_holdings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        companyName: text('company_name'),
        fmpSymbol: text('fmp_symbol'),
        // numeric maps to string in Drizzle; treat as decimal strings, never JS floats.
        quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
        averagePrice: numeric('average_price', { precision: 20, scale: 8 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        index('portfolio_holdings_user_id_idx').on(table.userId),
        uniqueIndex('portfolio_holdings_user_symbol_uidx').on(
            table.userId,
            table.symbol
        ),
    ]
);
```

- [ ] **Step 2: Typecheck.** Run: `yarn tsc --noEmit` (from worktree root). Expected: no new errors referencing schema.ts. If `SYMBOL_MAX_LENGTH` differs in name, grep `src/shared/db/schema.ts` for the constant used by `koreanTickers.symbol` and reuse it.

- [ ] **Step 3: Generate migration.** Run: `yarn db:generate`. Expected: a new `drizzle/0026_*.sql` containing `CREATE TABLE "portfolio_holdings"` with the FK, both indexes. Inspect it. Confirm it is `0026` (0025 is head).

- [ ] **Step 4: Commit.**
```bash
git add src/shared/db/schema.ts drizzle/
git commit -m "feat(portfolio): add portfolio_holdings schema + migration"
```

### Task 2: Repository types

**Files:**
- Modify: `src/shared/db/types.ts` (add the `PortfolioHolding*` interfaces from the Shared type contracts block above, near `UserApiKeyRepository`)

- [ ] **Step 1: Add the three interfaces** (`PortfolioHoldingRecord`, `UpsertPortfolioHoldingInput`, `PortfolioHoldingRepository`) exactly as in the contracts block.
- [ ] **Step 2: Typecheck.** Run: `yarn tsc --noEmit`. Expected: no new errors.
- [ ] **Step 3: Commit.**
```bash
git add src/shared/db/types.ts
git commit -m "feat(portfolio): add PortfolioHoldingRepository types"
```

### Task 3: Validation (pure, TDD)

**Files:**
- Create: `src/entities/portfolio/model.ts` (types from contracts block)
- Create: `src/entities/portfolio/lib/validateHoldingInput.ts`
- Test: `src/entities/portfolio/__tests__/validateHoldingInput.test.ts`

- [ ] **Step 1: Write model.ts** with the types from the contracts block (`PortfolioActionErrorCode`, `SavePortfolioResult`, `DeletePortfolioResult`, `PortfolioHoldingView`, `RawHoldingInput`, `ValidateHoldingResult`).

- [ ] **Step 2: Write the failing test.**
```ts
import { describe, expect, it } from 'vitest';
import { validateHoldingInput } from '../lib/validateHoldingInput';

describe('validateHoldingInput', () => {
    it('canonicalizes symbol to uppercase and trims', () => {
        const r = validateHoldingInput({ symbol: ' aapl ', quantity: '10', averagePrice: '150' });
        expect(r).toEqual({ ok: true, symbol: 'AAPL', quantity: '10', averagePrice: '150' });
    });
    it('rejects malformed symbol shape', () => {
        const r = validateHoldingInput({ symbol: '!!!', quantity: '10', averagePrice: '150' });
        expect(r).toEqual({ ok: false, code: 'invalid_symbol', message: expect.any(String) });
    });
    it('rejects zero/negative quantity', () => {
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: '0', averagePrice: '1' }).ok).toBe(false);
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: '-3', averagePrice: '1' })).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('rejects zero/negative price', () => {
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: '1', averagePrice: '0' })).toMatchObject({ ok: false, code: 'invalid_price' });
    });
    it('rejects quantity beyond scale (>8 decimals)', () => {
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: '1.123456789', averagePrice: '1' })).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('rejects absurd upper bounds', () => {
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: '2000000000', averagePrice: '1' })).toMatchObject({ ok: false, code: 'invalid_quantity' });
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: '1', averagePrice: '20000000' })).toMatchObject({ ok: false, code: 'invalid_price' });
    });
    it('rejects non-numeric', () => {
        expect(validateHoldingInput({ symbol: 'AAPL', quantity: 'abc', averagePrice: '1' })).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('accepts fractional crypto-style quantity', () => {
        expect(validateHoldingInput({ symbol: 'BTCUSD', quantity: '0.00012345', averagePrice: '65000.50' }).ok).toBe(true);
    });
});
```

- [ ] **Step 3: Run test, verify it fails.** Run: `yarn test src/entities/portfolio/__tests__/validateHoldingInput.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement `validateHoldingInput.ts`.** Use `isAdmissibleSymbolShape` from `@/shared/config/ticker`. Validate decimal strings with a regex + numeric bounds (no `parseFloat` for the scale check — count fractional digits from the string).
```ts
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { RawHoldingInput, ValidateHoldingResult } from '../model';

export const QUANTITY_SCALE = 8;
export const QUANTITY_MAX = 1_000_000_000;
export const PRICE_SCALE = 8;
export const PRICE_MAX = 10_000_000;

const DECIMAL_RE = /^\d+(\.\d+)?$/;

function checkDecimal(
    raw: string,
    scale: number,
    max: number
): { ok: true; value: string } | { ok: false } {
    const s = raw.trim();
    if (!DECIMAL_RE.test(s)) return { ok: false };
    const [, frac = ''] = s.split('.');
    if (frac.length > scale) return { ok: false };
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > max) return { ok: false };
    return { ok: true, value: s };
}

export function validateHoldingInput(input: RawHoldingInput): ValidateHoldingResult {
    const symbol = input.symbol.trim().toUpperCase();
    if (!isAdmissibleSymbolShape(symbol)) {
        return { ok: false, code: 'invalid_symbol', message: '유효하지 않은 종목 코드입니다.' };
    }
    const q = checkDecimal(input.quantity, QUANTITY_SCALE, QUANTITY_MAX);
    if (!q.ok) {
        return { ok: false, code: 'invalid_quantity', message: '수량을 올바르게 입력해 주세요.' };
    }
    const p = checkDecimal(input.averagePrice, PRICE_SCALE, PRICE_MAX);
    if (!p.ok) {
        return { ok: false, code: 'invalid_price', message: '평균 단가를 올바르게 입력해 주세요.' };
    }
    return { ok: true, symbol, quantity: q.value, averagePrice: p.value };
}
```

- [ ] **Step 5: Run test, verify pass.** Run: `yarn test src/entities/portfolio/__tests__/validateHoldingInput.test.ts`. Expected: PASS. (If `isAdmissibleSymbolShape` rejects `BTCUSD`, adjust the crypto test symbol to a shape it accepts, e.g. `BTC` — first read `src/shared/config/ticker.ts:31` to learn the accepted shape.)

- [ ] **Step 6: Commit.**
```bash
git add src/entities/portfolio/model.ts src/entities/portfolio/lib/validateHoldingInput.ts src/entities/portfolio/__tests__/validateHoldingInput.test.ts
git commit -m "feat(portfolio): add holding input validation"
```

### Task 4: Drizzle repository (TDD against a mock db)

**Files:**
- Create: `src/entities/portfolio/api.ts`
- Test: `src/entities/portfolio/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test.** Mirror how other repo tests mock the Drizzle chain. Assert: `upsert` calls `onConflictDoUpdate` with `target: [portfolioHoldings.userId, portfolioHoldings.symbol]`; `findByUser` filters by userId; `deleteByUserAndSymbol` returns `true` when a row is deleted, `false` otherwise. (Read an existing repo test, e.g. `src/entities/**/__tests__/*api*.test.ts`, to copy the mock-db harness.)

- [ ] **Step 2: Run, verify fail.** Run: `yarn test src/entities/portfolio/__tests__/api.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `api.ts`.** Mirror `src/entities/api-key/api.ts` exactly (no encryption). Columns select all record fields.
```ts
import { and, eq, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { portfolioHoldings } from '@/shared/db/schema';
import type {
    PortfolioHoldingRecord,
    PortfolioHoldingRepository,
    SiglensDatabase,
    UpsertPortfolioHoldingInput,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

const columns = {
    id: portfolioHoldings.id,
    userId: portfolioHoldings.userId,
    symbol: portfolioHoldings.symbol,
    companyName: portfolioHoldings.companyName,
    fmpSymbol: portfolioHoldings.fmpSymbol,
    quantity: portfolioHoldings.quantity,
    averagePrice: portfolioHoldings.averagePrice,
    createdAt: portfolioHoldings.createdAt,
    updatedAt: portfolioHoldings.updatedAt,
};

export class DrizzlePortfolioRepository implements PortfolioHoldingRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findByUser(userId: string): Promise<PortfolioHoldingRecord[]> {
        return this.db
            .select(columns)
            .from(portfolioHoldings)
            .where(eq(portfolioHoldings.userId, userId));
    }

    async findByUserAndSymbol(userId: string, symbol: string): Promise<PortfolioHoldingRecord | null> {
        const [row] = await this.db
            .select(columns)
            .from(portfolioHoldings)
            .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.symbol, symbol)))
            .limit(1);
        return row ?? null;
    }

    async upsert(input: UpsertPortfolioHoldingInput): Promise<PortfolioHoldingRecord> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(portfolioHoldings)
                    .values({
                        userId: input.userId,
                        symbol: input.symbol,
                        companyName: input.companyName,
                        fmpSymbol: input.fmpSymbol,
                        quantity: input.quantity,
                        averagePrice: input.averagePrice,
                    })
                    .onConflictDoUpdate({
                        target: [portfolioHoldings.userId, portfolioHoldings.symbol],
                        set: {
                            companyName: input.companyName,
                            fmpSymbol: input.fmpSymbol,
                            quantity: input.quantity,
                            averagePrice: input.averagePrice,
                            updatedAt: sql`now()`,
                        },
                    })
                    .returning(columns),
            NEON_TRANSIENT_RETRY
        );
        if (row === undefined) throw new Error('Failed to upsert portfolio holding');
        return row;
    }

    async deleteByUserAndSymbol(userId: string, symbol: string): Promise<boolean> {
        const deleted = await this.db
            .delete(portfolioHoldings)
            .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.symbol, symbol)))
            .returning({ id: portfolioHoldings.id });
        return deleted.length > 0;
    }
}
```
Note: `SiglensDatabase` is exported from `@/shared/db/types` in the api-key mirror — confirm the exact import path (`api-key/api.ts` imports it from `@/shared/db/types`).

- [ ] **Step 4: Run, verify pass.** Run: `yarn test src/entities/portfolio/__tests__/api.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add src/entities/portfolio/api.ts src/entities/portfolio/__tests__/api.test.ts
git commit -m "feat(portfolio): add DrizzlePortfolioRepository"
```

### Task 5: Server actions (TDD)

**Files:**
- Create: `src/entities/portfolio/actions/getPortfolioHoldingsAction.ts`
- Create: `src/entities/portfolio/actions/savePortfolioHoldingAction.ts`
- Create: `src/entities/portfolio/actions/deletePortfolioHoldingAction.ts`
- Create: `src/entities/portfolio/actions.ts` (barrel)
- Create: `src/entities/portfolio/lib/toView.ts` (record → `PortfolioHoldingView`)
- Test: `src/entities/portfolio/__tests__/actions.test.ts`

- [ ] **Step 1: Write `toView.ts`.**
```ts
import type { PortfolioHoldingRecord } from '@/shared/db/types';
import type { PortfolioHoldingView } from '../model';

export function toView(r: PortfolioHoldingRecord): PortfolioHoldingView {
    return {
        symbol: r.symbol,
        companyName: r.companyName,
        fmpSymbol: r.fmpSymbol,
        quantity: r.quantity,
        averagePrice: r.averagePrice,
        updatedAt: r.updatedAt.toISOString(),
    };
}
```

- [ ] **Step 2: Write the failing test** (mock `getCurrentUser`, `getDatabaseClient`, `DrizzlePortfolioRepository`, and `getAssetInfo`). Assert:
  - `getPortfolioHoldingsAction` returns `[]` when `getCurrentUser` → null (NO redirect thrown).
  - `getPortfolioHoldingsAction` maps rows via `toView` when authenticated; returns `[]` and logs on repo throw.
  - `savePortfolioHoldingAction` returns `{status:'error',code:'unauthenticated'}` when logged out (no redirect).
  - `savePortfolioHoldingAction` rejects invalid symbol shape with `invalid_symbol`.
  - When `getAssetInfo` returns `null` → `{status:'error',code:'symbol_not_found'}`.
  - When `getAssetInfo` **throws** (FMP degraded) → save still succeeds; `companyName`/`fmpSymbol` persisted as `null`.
  - When `getAssetInfo` returns an `AssetInfo` → `upsert` called with canonical uppercase symbol + persisted `companyName`/`fmpSymbol`; returns `{status:'ok'}`.
  - `deletePortfolioHoldingAction` returns `{status:'error',code:'unauthenticated'}` logged out; `{status:'ok'}` when authed.

- [ ] **Step 3: Run, verify fail.** Run: `yarn test src/entities/portfolio/__tests__/actions.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement the three actions.**

`getPortfolioHoldingsAction.ts` (mirror `getRegisteredProvidersAction`):
```ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { toView } from '../lib/toView';
import type { PortfolioHoldingView } from '../model';

export async function getPortfolioHoldingsAction(): Promise<PortfolioHoldingView[]> {
    const user = await getCurrentUser();
    if (user === null) return [];
    try {
        const { db } = getDatabaseClient();
        const rows = await new DrizzlePortfolioRepository(db).findByUser(user.id);
        return rows.map(toView).toSorted((a, b) => a.symbol.localeCompare(b.symbol));
    } catch (error) {
        console.error('[getPortfolioHoldingsAction] Failed to load holdings', error);
        return [];
    }
}
```

`savePortfolioHoldingAction.ts` (uniformly non-redirecting; existence check degrade-tolerant):
```ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { validateHoldingInput } from '../lib/validateHoldingInput';
import { toView } from '../lib/toView';
import type { RawHoldingInput, SavePortfolioResult } from '../model';

export async function savePortfolioHoldingAction(input: RawHoldingInput): Promise<SavePortfolioResult> {
    const user = await getCurrentUser();
    if (user === null) {
        return { status: 'error', code: 'unauthenticated', message: '로그인이 필요합니다.' };
    }
    const v = validateHoldingInput(input);
    if (!v.ok) return { status: 'error', code: v.code, message: v.message };

    // Existence check: null → reject; thrown (FMP degraded) → allow (degrade-tolerant).
    let companyName: string | null = null;
    let fmpSymbol: string | null = null;
    try {
        const info = await getAssetInfo(v.symbol);
        if (info === null) {
            return { status: 'error', code: 'symbol_not_found', message: '존재하지 않는 종목입니다.' };
        }
        companyName = info.name ?? null;
        fmpSymbol = info.fmpSymbol ?? null;
    } catch (error) {
        console.warn('[savePortfolioHoldingAction] symbol verification unavailable, proceeding', error);
    }

    try {
        const { db } = getDatabaseClient();
        const row = await new DrizzlePortfolioRepository(db).upsert({
            userId: user.id,
            symbol: v.symbol,
            companyName,
            fmpSymbol,
            quantity: v.quantity,
            averagePrice: v.averagePrice,
        });
        return { status: 'ok', holding: toView(row) };
    } catch (error) {
        console.error('[savePortfolioHoldingAction] upsert failed', error);
        return { status: 'error', code: 'storage_unavailable', message: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' };
    }
}
```

`deletePortfolioHoldingAction.ts`:
```ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { DeletePortfolioResult } from '../model';

export async function deletePortfolioHoldingAction(symbol: string): Promise<DeletePortfolioResult> {
    const user = await getCurrentUser();
    if (user === null) {
        return { status: 'error', code: 'unauthenticated', message: '로그인이 필요합니다.' };
    }
    const canonical = symbol.trim().toUpperCase();
    if (!isAdmissibleSymbolShape(canonical)) {
        return { status: 'error', code: 'invalid_symbol', message: '유효하지 않은 종목 코드입니다.' };
    }
    try {
        const { db } = getDatabaseClient();
        await new DrizzlePortfolioRepository(db).deleteByUserAndSymbol(user.id, canonical);
        return { status: 'ok' };
    } catch (error) {
        console.error('[deletePortfolioHoldingAction] delete failed', error);
        return { status: 'error', code: 'storage_unavailable', message: '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.' };
    }
}
```

Barrel `actions.ts` (NO `'use server'`):
```ts
export { getPortfolioHoldingsAction } from './actions/getPortfolioHoldingsAction';
export { savePortfolioHoldingAction } from './actions/savePortfolioHoldingAction';
export { deletePortfolioHoldingAction } from './actions/deletePortfolioHoldingAction';
```

- [ ] **Step 5: Run, verify pass.** Run: `yarn test src/entities/portfolio/__tests__/actions.test.ts`. Expected: PASS. Confirm `getAssetInfo`'s `AssetInfo` field names (`name`, `fmpSymbol`) by reading `src/shared/lib/types.ts`; adjust if different.
- [ ] **Step 6: Commit.**
```bash
git add src/entities/portfolio/actions* src/entities/portfolio/lib/toView.ts src/entities/portfolio/__tests__/actions.test.ts
git commit -m "feat(portfolio): add portfolio holdings server actions"
```

### Task 6: Entity barrel + query hook

**Files:**
- Create: `src/entities/portfolio/index.ts`
- Modify: `src/shared/config/queryConfig.ts`
- Create: `src/entities/portfolio/hooks/usePortfolioHoldings.ts`
- Test: `src/entities/portfolio/__tests__/usePortfolioHoldings.test.tsx`

- [ ] **Step 1: Write `index.ts`** — EXCLUDE `DrizzlePortfolioRepository` (server-only, imports drizzle). Export types + validation + the hook path note.
```ts
// DrizzlePortfolioRepository is intentionally excluded from this barrel —
// api.ts imports drizzle/schema (server-only). Server consumers import from
// @/entities/portfolio/api. Client consumers import the hook from
// @/entities/portfolio/hooks/usePortfolioHoldings (deep import, mirrors ticker/bars).
export type {
    PortfolioActionErrorCode,
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
    DeletePortfolioResult,
} from './model';
export { validateHoldingInput } from './lib/validateHoldingInput';
```

- [ ] **Step 2: Add query key + stale time to `queryConfig.ts`.**
```ts
// in QUERY_KEYS object:
portfolioHoldings: () => ['portfolio-holdings'] as const,
// near USER_TIER_STALE_TIME_MS:
/** A member's own holdings change only on their explicit edit — short stale is fine. */
export const PORTFOLIO_HOLDINGS_STALE_TIME_MS = 5 * MS_PER_MINUTE;
```

- [ ] **Step 3: Write the failing hook test** (render with a QueryClientProvider, mock the actions). Assert: `usePortfolioHoldings()` exposes `{ holdings, isHydrated/isLoading, save, remove }`; `save` calls `savePortfolioHoldingAction` then invalidates `QUERY_KEYS.portfolioHoldings()`; `remove` calls `deletePortfolioHoldingAction` then invalidates.

- [ ] **Step 4: Run, verify fail.**

- [ ] **Step 5: Implement `usePortfolioHoldings.ts`** (mirror `useAssetInfo` hydration gating + a mutation pattern).
```ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { PORTFOLIO_HOLDINGS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';
import {
    deletePortfolioHoldingAction,
    getPortfolioHoldingsAction,
    savePortfolioHoldingAction,
} from '@/entities/portfolio/actions';
import type { PortfolioHoldingView, RawHoldingInput, SavePortfolioResult, DeletePortfolioResult } from '@/entities/portfolio/model';

export function usePortfolioHoldings() {
    const isHydrated = useHydrated();
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.portfolioHoldings(),
        queryFn: () => getPortfolioHoldingsAction(),
        enabled: isHydrated,
        staleTime: PORTFOLIO_HOLDINGS_STALE_TIME_MS,
    });
    const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.portfolioHoldings() });
    const save = useMutation<SavePortfolioResult, Error, RawHoldingInput>({
        mutationFn: input => savePortfolioHoldingAction(input),
        onSuccess: result => { if (result.status === 'ok') invalidate(); },
    });
    const remove = useMutation<DeletePortfolioResult, Error, string>({
        mutationFn: symbol => deletePortfolioHoldingAction(symbol),
        onSuccess: result => { if (result.status === 'ok') invalidate(); },
    });
    const holdings: PortfolioHoldingView[] = data ?? [];
    return { holdings, isHydrated, isLoading, save, remove };
}
```

- [ ] **Step 6: Run, verify pass.**
- [ ] **Step 7: Commit.**
```bash
git add src/entities/portfolio/index.ts src/shared/config/queryConfig.ts src/entities/portfolio/hooks src/entities/portfolio/__tests__/usePortfolioHoldings.test.tsx
git commit -m "feat(portfolio): add portfolio barrel + usePortfolioHoldings hook"
```

### Task 7: Account page section (UI)

**Files:**
- Create: `src/features/portfolio-management/ui/HoldingForm.tsx`
- Create: `src/features/portfolio-management/ui/PortfolioSection.tsx`
- Create: `src/features/portfolio-management/index.ts`
- Modify: `src/app/account/page.tsx`
- Test: `src/features/portfolio-management/__tests__/PortfolioSection.test.tsx`

Design: apply `frontend-design` + `web-design-guidelines`. Match the account page's section chrome (`ring-secondary-800 bg-secondary-900/80 rounded-2xl p-6`). Use `TickerAutocomplete` for the symbol field. Accessible labels, `aria-label="보유종목"`, keyboard-operable edit/delete, focus management, number inputs with `inputMode="decimal"`.

- [ ] **Step 1: Write `HoldingForm.tsx`** — controlled form (symbol via `TickerAutocomplete onSelect`, quantity, averagePrice), calls `onSubmit(RawHoldingInput)`, shows inline error text from a `SavePortfolioResult` error. Supports an `initial?: PortfolioHoldingView` prop for edit mode (symbol read-only when editing).
- [ ] **Step 2: Write `PortfolioSection.tsx`** — `'use client'`, uses `usePortfolioHoldings()`. Renders: heading, empty state ("아직 등록한 보유종목이 없어요"), list of rows (symbol · company · `{quantity}주` · avg `$x`), each with edit + delete buttons; an add form. Delete calls `remove.mutate(symbol)`. Save calls `save.mutateAsync(input)` and surfaces the returned error.
- [ ] **Step 3: Write `index.ts`** exporting `PortfolioSection`.
- [ ] **Step 4: Write component test** — render `PortfolioSection` inside a QueryClientProvider with mocked `usePortfolioHoldings` (or mocked actions). Assert: empty state renders; adding a holding calls `save`; a returned error message shows; delete calls `remove`. Follow existing `ApiKeySection` test harness if one exists.
- [ ] **Step 5: Run test, verify pass.** Run: `yarn test src/features/portfolio-management`.
- [ ] **Step 6: Mount in the account page.** In `src/app/account/page.tsx`, add a `<section aria-label="보유종목" className="...same chrome...">` rendering `<PortfolioSection />` between the API-key section and the danger section. Since `PortfolioSection` is a client component fetching its own data, it does not need to be added to `AccountContent`'s `Promise.all`.
- [ ] **Step 7: Typecheck + lint.** Run: `yarn tsc --noEmit && yarn lint src/features/portfolio-management src/app/account`.
- [ ] **Step 8: Commit.**
```bash
git add src/features/portfolio-management src/app/account/page.tsx
git commit -m "feat(portfolio): add account-page holdings management section"
```

### Task 8: Apply the migration + phase gate

- [ ] **Step 1: Apply migration to the dev DB.** Run: `yarn db:migrate`. Expected: `0026` applied, `portfolio_holdings` created. (User authorized direct migration; do NOT run against production.)
- [ ] **Step 2: Scoped gate.** Run: `yarn tsc --noEmit && yarn test src/entities/portfolio src/features/portfolio-management && yarn lint src/entities/portfolio src/features/portfolio-management`. Expected: all green.
- [ ] **Step 3: Claude Code Review Loop** on Phase A1 (see "Review Loop" section at end). Fix findings, re-review to approval.

---

# Phase A2 — Symbol-page header chip

### Task 9: `useSymbolHolding` selector hook

**Files:**
- Create: `src/features/portfolio-holding/hooks/useSymbolHolding.ts`
- Test: `src/features/portfolio-holding/__tests__/useSymbolHolding.test.tsx`

- [ ] **Step 1: Failing test** — given `usePortfolioHoldings` returns `[{symbol:'AAPL',...}]`, `useSymbolHolding('aapl')` returns that holding (case-insensitive match); returns `null` when absent.
- [ ] **Step 2: Implement.**
```ts
'use client';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';

export function useSymbolHolding(symbol: string): {
    holding: PortfolioHoldingView | null;
    isHydrated: boolean;
    save: ReturnType<typeof usePortfolioHoldings>['save'];
} {
    const { holdings, isHydrated, save } = usePortfolioHoldings();
    const upper = symbol.toUpperCase();
    const holding = holdings.find(h => h.symbol === upper) ?? null;
    return { holding, isHydrated, save };
}
```
- [ ] **Step 3: Run pass, commit.**
```bash
git add src/features/portfolio-holding/hooks src/features/portfolio-holding/__tests__/useSymbolHolding.test.tsx
git commit -m "feat(portfolio): add useSymbolHolding selector"
```

### Task 10: Chip + popover + mounted wrapper

**Files:**
- Create: `src/features/portfolio-holding/ui/PortfolioChipPopover.tsx`
- Create: `src/features/portfolio-holding/ui/PortfolioChip.tsx`
- Create: `src/features/portfolio-holding/ui/PortfolioChipMounted.tsx`
- Create: `src/features/portfolio-holding/index.ts`
- Test: `src/features/portfolio-holding/__tests__/PortfolioChip.test.tsx`

Design: `frontend-design` + `web-design-guidelines`. The chip visually matches the header's other chips (mirror `FearGreedHeaderChip` / `ReasoningToggle` sizing). Popover composes `useFocusTrap` + `useEscapeKey` + `useOnClickOutside` (mirror `AnalysisSignupNudgeModal`). No mount side-effects (dual-mount desktop/mobile).

- [ ] **Step 1: `PortfolioChipMounted.tsx`** — gates on authenticated presence:
```ts
'use client';
import { useCurrentUser } from '@/entities/auth';
import { PortfolioChip } from './PortfolioChip';

export function PortfolioChipMounted({ symbol, companyName }: { symbol: string; companyName: string }) {
    const { data } = useCurrentUser();
    // Render nothing until login resolves AND a user is present.
    // data === undefined → loading; data === null → guest. Both hide the chip.
    if (!data) return null;
    return <PortfolioChip symbol={symbol} companyName={companyName} />;
}
```
(Confirm `useCurrentUser` return shape from `src/entities/auth/hooks/useCurrentUser.ts`.)
- [ ] **Step 2: `PortfolioChip.tsx`** — uses `useSymbolHolding(symbol)`; renders `내 평단 설정` when `holding===null`, else `내 평단 ${avg} · {qty}주`; button opens `PortfolioChipPopover`. Format price/qty with existing `shared/lib/priceFormat` helpers if present.
- [ ] **Step 3: `PortfolioChipPopover.tsx`** — small dialog with quantity + averagePrice inputs (symbol fixed to the current page's symbol; no autocomplete needed here), save via `save.mutateAsync({symbol, quantity, averagePrice})`, closes on success, surfaces error. a11y: role="dialog", aria-modal, focus trap, Esc to close, click-outside to close.
- [ ] **Step 4: `index.ts`** exports `PortfolioChipMounted`.
- [ ] **Step 5: Component test** — mock `useCurrentUser` + `usePortfolioHoldings`. Assert: renders nothing when `data` is `undefined` (loading) and `null` (guest); renders "내 평단 설정" for a present user with no holding; renders the value when a holding exists; opening the popover and saving calls `save` and invalidates.
- [ ] **Step 6: Run pass; typecheck; lint.** `yarn test src/features/portfolio-holding && yarn tsc --noEmit && yarn lint src/features/portfolio-holding`.
- [ ] **Step 7: Commit.**
```bash
git add src/features/portfolio-holding
git commit -m "feat(portfolio): add symbol-page holding chip + popover"
```

### Task 11: Mount the chip in the header

**Files:**
- Modify: `src/views/symbol/SymbolLayoutHeader.tsx`
- Test: extend the header test if one exists.

- [ ] **Step 1: Read `SymbolLayoutHeader.tsx`** to find where `ReasoningToggle` and `FearGreedHeaderChipMounted` render and how `symbol`/`companyName` are available.
- [ ] **Step 2: Add `<Suspense fallback={null}><PortfolioChipMounted symbol={symbol} companyName={companyName} /></Suspense>`** next to `ReasoningToggle`, importing from `@/features/portfolio-holding`. Match the existing chip's Suspense usage (mirror `FearGreedHeaderChipMounted`).
- [ ] **Step 3: Typecheck + lint + scoped tests.** `yarn tsc --noEmit && yarn lint src/views/symbol && yarn test src/views/symbol`.
- [ ] **Step 4: Commit.**
```bash
git add src/views/symbol/SymbolLayoutHeader.tsx
git commit -m "feat(portfolio): mount holding chip in symbol header"
```

- [ ] **Step 5: Claude Code Review Loop** on Phase A2. Fix, re-review to approval.

---

# Phase A3 — Onboarding

### Task 12: `/onboarding` route + content

**Files:**
- Create: `src/features/portfolio-onboarding/ui/OnboardingContent.tsx`
- Create: `src/features/portfolio-onboarding/index.ts`
- Create: `src/app/onboarding/page.tsx`
- Test: `src/features/portfolio-onboarding/__tests__/OnboardingContent.test.tsx`

Design: `frontend-design` + `web-design-guidelines`. Warm, skippable. Reuses `HoldingForm` (from portfolio-management) or a compact multi-add. Copy: "보유종목을 등록하면 내 평균 단가 기준으로 분석을 받을 수 있어요." Primary CTA saves; secondary "나중에 하기" / "건너뛰기" routes to the return path.

- [ ] **Step 1: `page.tsx`** — RSC that `redirect('/login?next=/onboarding')` if `getCurrentUser()` is null (mirror account page guard), inside Suspense; `noindex` metadata (mirror account). Accepts `searchParams.next` (sanitized) to know where "skip/done" should go; default `/`.
- [ ] **Step 2: `OnboardingContent.tsx`** — `'use client'`, add-holding form(s) + skip/done buttons routing to `next` via `useRouter`.
- [ ] **Step 3: Tests** — renders form; skip navigates to `next`; add calls `save`.
- [ ] **Step 4: Run pass; typecheck; lint. Commit.**
```bash
git add src/features/portfolio-onboarding src/app/onboarding
git commit -m "feat(portfolio): add /onboarding holdings screen"
```

### Task 13: Wire signup → onboarding (both entry points)

**Files:**
- Modify: `src/features/auth-signup/actions/registerAction.ts`
- Modify: `src/features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts`
- Test: extend each action's test.

- [ ] **Step 1: Read both actions** to find where they compute `next` and call `redirect(next)`.
- [ ] **Step 2: Add the rule** — a shared helper `resolvePostSignupDestination(next: string): string` in `src/features/portfolio-onboarding/lib/postSignupDestination.ts`:
```ts
// Only divert first-time signups that have no specific return target.
// A user who signed up from /AAPL keeps returning to /AAPL.
export function resolvePostSignupDestination(next: string): string {
    return next === '/' ? '/onboarding' : next;
}
```
(features → features cross-import: auth-signup importing portfolio-onboarding must be added to the ESLint `allow` list in `eslint.config.mjs`, mirroring the documented auth-signup exceptions. Verify and add.)
- [ ] **Step 3: Apply in both actions** — replace `redirect(next)` with `redirect(resolvePostSignupDestination(next))`. Keep `next` sanitization unchanged.
- [ ] **Step 4: Test** — signup with `next='/'` redirects to `/onboarding`; signup with `next='/AAPL'` redirects to `/AAPL`. Same for OAuth finalize.
- [ ] **Step 5: Run pass; typecheck; lint.**
```bash
git add src/features/auth-signup src/features/auth-oauth-consent src/features/portfolio-onboarding eslint.config.mjs
git commit -m "feat(portfolio): route new signups to onboarding when no return target"
```
- [ ] **Step 6: ESCALATE if entangled.** If wiring either entry point cleanly is blocked by the auth flow (e.g. `next` is not available at the redirect site, or OAuth finalize has a different control flow), STOP and report to the user rather than forcing a fragile change.

### Task 14: Phase gate + full verification

- [ ] **Step 1: Claude Code Review Loop** on Phase A3. Fix, re-review to approval.
- [ ] **Step 2: Full scoped suite.** `yarn tsc --noEmit && yarn test src/entities/portfolio src/features/portfolio-management src/features/portfolio-holding src/features/portfolio-onboarding src/features/auth-signup src/features/auth-oauth-consent && yarn lint`.
- [ ] **Step 3: Coverage check** — confirm the new slices meet the 90% target: `yarn test-coverage --dir src/entities/portfolio` (or the repo's coverage invocation).

---

## Claude Code Review Loop (run per phase)

After each phase's implementation commits, invoke `review-agent` on the phase's modified files. Fix `required` + `recommended` findings directly (skip only false positives / trivial). Re-invoke `review-agent` with previous findings + the modified-files list until `approved`. On a `regression` finding, STOP and notify the user before fixing.

## Self-review checklist (author ran before handoff)

- **Spec coverage:** data model (T1–2), entity slice (T3–6), account section (T7), header chip (T9–11), onboarding (T12–13), validation (T3), tests (each task), migration (T8). All spec sections mapped.
- **Type consistency:** `PortfolioHoldingView`, `RawHoldingInput`, `SavePortfolioResult`, `PortfolioHoldingRepository`, `QUERY_KEYS.portfolioHoldings()` used consistently across tasks.
- **Non-redirect read:** enforced in T5 and tested (guards the ISR/navigation-hijack risk).
- **Gate = presence not tier:** enforced in T10 `PortfolioChipMounted`.
- **Single query source:** all surfaces use `usePortfolioHoldings` / `useSymbolHolding` (T6, T9).
```
