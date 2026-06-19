# Economy Calendar SP-A — History Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/economy` calendar's Redis-snapshot data source with a DB-backed history layer so the page can show past events (with `actual` values) plus the future window, fed by a one-time backfill + an on-access `ensure` refresh.

**Architecture:** A new `economic_calendar` Drizzle table stores normalized FMP economic-calendar events keyed by a deterministic `country+dateEt+event` hash (idempotent upsert; `actual` excluded from the key so post-release updates land on the same row). A standalone `tsx` backfill script seeds ~2 years in chunks and dumps the distinct normalized indicator-name set for SP-B. A `'use server'` `ensureEconomicCalendarAction` (mirroring `ensureMarketNewsCardsAnalyzedAction`) fetches a ±1-month window on access, upserts, and `revalidateTag`s the calendar cache. An ISR-cold-gen-safe `getCalendarFromDb` reader (wrapped in `unstable_cache` per the 4-axis rule) supplies the grid. The economy page switches only the calendar axis to DB; indicators/treasury stay on the Redis snapshot. A client widget hook fires the ensure action once on mount.

**Tech Stack:** TypeScript, Drizzle ORM (Neon serverless), `drizzle-kit` migrations, Next.js 16 (RSC + `unstable_cache` + `revalidateTag`), vitest, `@y0ngha/siglens-core` (`normalizeEconomicCalendar`, `EconomicCalendarEvent`, `CalendarImpact`).

---

## Cross-repo scope check

SP-A is **entirely siglens** per the spec table (FMP ingestion I/O, DB schema/storage, display). The only core consumption is the pure normalizer `normalizeEconomicCalendar` and the `EconomicCalendarEvent` / `CalendarImpact` types, which already exist in the published core package (verified in `node_modules/@y0ngha/siglens-core/dist/domain/economy/`). **No core change is required for SP-A.** AI columns (sentiment/summaryKo/interpretationKo/analyzedAt) are explicitly out of scope — they arrive in SP-D via a separate migration.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/shared/db/schema.ts` | Modify | Add `economicCalendar` `pgTable` (id PK, country, dateEt, event, impact, estimate, previous, actual, unit, fetchedAt; 3 indexes). |
| `drizzle/0018_*.sql` + `drizzle/meta/*` | Create (generated) | Migration creating `economic_calendar` table + indexes (output of `yarn db:generate`). |
| `src/entities/economy/lib/economicCalendarId.ts` | Create | Pure deterministic id hash `economicCalendarId(country, dateEt, event)`. |
| `src/entities/economy/lib/__tests__/economicCalendarId.test.ts` | Create | Tests for id stability + collision sensitivity. |
| `src/entities/economy/lib/calendarWindow.ts` | Create | Pure ET-date window helpers (`etToday`, `addEtDays`, `pastWindowStart`, `futureWindowEnd`) reused by reader/action/script. |
| `src/entities/economy/lib/__tests__/calendarWindow.test.ts` | Create | Tests for ET date arithmetic + window bounds. |
| `src/entities/economy/api/economicCalendarRepository.ts` | Create | `DrizzleEconomicCalendarRepository`: `upsertEvent` (idempotent, returns changed) + `listInRange(fromEt, toEt)`. |
| `src/entities/economy/api/__tests__/economicCalendarRepository.test.ts` | Create | Repository upsert/list query-shape tests against a mocked db. |
| `src/entities/economy/api/getCalendarFromDb.ts` | Create | ISR-safe reader: `unstable_cache`-wrapped past-2-weeks + future-window DB read → `EconomicCalendarEvent[]`. |
| `src/entities/economy/api/__tests__/getCalendarFromDb.test.ts` | Create | Tests for range computation, sort, mapping, ISR safety (no dynamic API). |
| `src/entities/economy/lib/economyCalendarConstants.ts` | Create | Window/TTL/tag/refresh-flag constants shared across reader/action. |
| `src/entities/economy/actions/ensureEconomicCalendarAction.ts` | Create | `'use server'` ±1-month FMP fetch → upsert → `revalidateTag`; fire-and-forget error logging. |
| `src/entities/economy/actions/__tests__/ensureEconomicCalendarAction.test.ts` | Create | Tests for fetch→upsert→revalidate path + graceful FMP failure. |
| `src/entities/economy/actions.ts` | Create | Server Action barrel re-exporting `ensureEconomicCalendarAction` (no `'use server'`). |
| `scripts/backfillEconomicCalendar.ts` | Create | One-time `tsx` backfill: chunked ~2yr fetch → upsert + dump distinct normalized indicator names. |
| `scripts/lib/normalizeIndicatorBaseName.ts` | Create | Pure base-name normalizer (strip trailing `(May)`/`(Q1)`/`(Jun/20)`) used by the backfill dump. |
| `scripts/lib/__tests__/normalizeIndicatorBaseName.test.ts` | Create | Tests for suffix stripping. |
| `package.json` | Modify | Add `db:backfill:calendar` script. |
| `src/widgets/economy/hooks/useEconomicCalendarTrigger.ts` | Create | `'use client'` hook firing `ensureEconomicCalendarAction()` once on mount. |
| `src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx` | Create | Test the once-on-mount fire-and-forget behavior. |
| `src/widgets/economy/sections/EconomicCalendarGrid.tsx` | Modify | Accept `today` prop (ET-derived KST date key) + fire the trigger; default-select today else nearest upcoming. |
| `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx` | Modify | Add default-selection-from-`today` tests. |
| `src/widgets/economy/index.ts` | Modify (no-op check) | Confirm `EconomicCalendar` export still valid after prop change. |
| `src/app/economy/page.tsx` | Modify | Switch calendar source to `getCalendarFromDb`; compute ET-today once; pass `events` + `today` to grid. |

**FSD compliance:** pure logic + id hash live in `entities/economy/lib/`; DB repository + reader live in `entities/economy/api/` (server-only, barrel-excluded); the server action lives in `entities/economy/actions/`; the client trigger hook lives in `widgets/economy/hooks/`; the page composes them. The script lives under top-level `scripts/` (not an FSD layer) and imports the repository/normalizer directly via `tsx`.

---

## Conventions to honor (gates)

- **Tests colocated** in `__tests__/` next to the unit. Run a single file with `npx vitest run <path>`.
- **`tsc`, ESLint, Prettier must pass.** No `eslint-disable`. Run `yarn lint` and `yarn format` before each commit if unsure.
- **ISR 4-axis safety** (`src/app/CLAUDE.md`): no `cookies()`/`headers()`/`connection()`/`Date.now()` inside the cold-gen render path. The reader wraps the DB read in `unstable_cache`; the page computes "today" with the existing ET formatter (a deterministic `Intl` call, not a forbidden dynamic API — same pattern `economySnapshotCache.isoDate` already uses).
- **Route segment config stays literal** — `export const revalidate = 86400` already exists in `page.tsx`; do not touch it.
- **`'use server'` files** export only async functions; constants/classes live in separate files (`entities/CLAUDE.md`).
- **Barrel exclusion:** `api/` server-only modules and `actions/*` stay out of `entities/economy/index.ts`; consumers deep-import (matching the existing economy barrel comment).
- **Commit per task** with the conventional-commit messages given. Do not push (git-agent's job) — these `git commit` steps are local checkpoints for the executing worker.

---

## Task 1: `economic_calendar` Drizzle table

**Files:**
- Modify: `src/shared/db/schema.ts` (append after `earningsReports`, before `termsKindEnum`)
- Create (generated): `drizzle/0018_*.sql`, `drizzle/meta/0018_snapshot.json`, updated `drizzle/meta/_journal.json`

- [ ] **Step 1: Add the table to the schema**

In `src/shared/db/schema.ts`, add this block immediately after the `earningsReports` `pgTable` definition (line ~323, before `export const termsKindEnum`). It mirrors `marketNews`/`earningsReports` column style and uses the existing imports (`pgTable`, `text`, `doublePrecision`, `index`, `timestamp`). Add `doublePrecision` to the existing `drizzle-orm/pg-core` import list at the top of the file.

```typescript
/**
 * 정규화된 FMP economic-calendar 이벤트 이력 (현재 US만 저장).
 *
 * `id`는 country+dateEt+event의 결정론적 해시(`economicCalendarId`)다. `actual`을
 * 포함하지 않으므로 발표 후 actual이 채워져도 같은 행으로 upsert돼 갱신된다
 * (#610 그리드의 React key `${date}:${event}:${actual}`와는 의도가 다른 안정 키).
 *
 * SP-D에서 별도 마이그레이션으로 sentiment/summaryKo/interpretationKo/analyzedAt가
 * 추가된다 — SP-A 테이블에는 미포함.
 */
export const economicCalendar = pgTable(
    'economic_calendar',
    {
        id: text('id').primaryKey(),
        country: text('country').notNull(),
        // FMP 원본 'YYYY-MM-DD HH:mm:ss' (ET 벽시계). KST 변환은 표시 계층(etDateTimeToKst).
        dateEt: text('date_et').notNull(),
        event: text('event').notNull(),
        // 'High' | 'Medium' | 'Low' — text 저장, 읽기 경계에서 검증.
        impact: text('impact').notNull(),
        estimate: doublePrecision('estimate'),
        previous: doublePrecision('previous'),
        // 발표 전 null; ingestion 재fetch 시 채워짐.
        actual: doublePrecision('actual'),
        unit: text('unit').notNull(),
        fetchedAt: timestamp('fetched_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('economic_calendar_date_et_idx').on(table.dateEt),
        index('economic_calendar_country_date_et_idx').on(
            table.country,
            table.dateEt
        ),
        index('economic_calendar_impact_idx').on(table.impact),
    ]
);
```

Add `doublePrecision,` to the `drizzle-orm/pg-core` import (alphabetically near `date`):

```typescript
import {
    boolean,
    date,
    doublePrecision,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';
```

- [ ] **Step 2: Generate the migration**

Run: `yarn db:generate`
Expected: drizzle-kit reports a new migration `0018_*` creating `economic_calendar` with 3 indexes; new files appear under `drizzle/` and `drizzle/meta/`. (No DB connection needed for `generate` — it only diffs the schema; `db:generate` runs through `dotenv -e .env.local`.)

- [ ] **Step 3: Verify the generated SQL**

Run: `cat drizzle/0018_*.sql`
Expected: a `CREATE TABLE "economic_calendar"` with `"id" text PRIMARY KEY NOT NULL`, `"date_et" text NOT NULL`, `"impact" text NOT NULL`, `"estimate"`/`"previous"`/`"actual"` as `double precision`, `"fetched_at" timestamp with time zone DEFAULT now() NOT NULL`, and three `CREATE INDEX` statements (`economic_calendar_date_et_idx`, `economic_calendar_country_date_et_idx`, `economic_calendar_impact_idx`). If the columns/indexes don't match, fix the schema and re-run `yarn db:generate`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors from the new table).

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema.ts drizzle/0018_*.sql drizzle/meta
git commit -m "feat(economy): add economic_calendar table for calendar history (SP-A)"
```

> Note: applying the migration to a live DB (`yarn db:migrate`) is an operational step the user runs against their environment — not part of this code plan.

---

## Task 2: Deterministic calendar id hash

**Files:**
- Create: `src/entities/economy/lib/economicCalendarId.ts`
- Test: `src/entities/economy/lib/__tests__/economicCalendarId.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { economicCalendarId } from '@/entities/economy/lib/economicCalendarId';

describe('economicCalendarId', () => {
    it('is deterministic for the same inputs', () => {
        const a = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        const b = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        expect(a).toBe(b);
    });

    it('produces a fixed-length lowercase hex string', () => {
        const id = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('excludes actual — different actual is irrelevant because actual is not an input', () => {
        // Same country+dateEt+event must always collide so post-release upserts
        // land on the same row.
        const before = economicCalendarId('US', '2026-05-13 08:30:00', 'Core CPI MoM (Apr)');
        const after = economicCalendarId('US', '2026-05-13 08:30:00', 'Core CPI MoM (Apr)');
        expect(before).toBe(after);
    });

    it('differs when any component differs', () => {
        const base = economicCalendarId('US', '2026-05-13 08:30:00', 'Core CPI MoM (Apr)');
        expect(economicCalendarId('EU', '2026-05-13 08:30:00', 'Core CPI MoM (Apr)')).not.toBe(base);
        expect(economicCalendarId('US', '2026-05-14 08:30:00', 'Core CPI MoM (Apr)')).not.toBe(base);
        expect(economicCalendarId('US', '2026-05-13 08:30:00', 'CPI MoM (Apr)')).not.toBe(base);
    });

    it('is not fooled by component-boundary ambiguity', () => {
        // 'a' + 'bc' vs 'ab' + 'c' must not collide — a delimiter separates parts.
        expect(
            economicCalendarId('US', 'x', 'yz')
        ).not.toBe(economicCalendarId('US', 'xy', 'z'));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/lib/__tests__/economicCalendarId.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/lib/economicCalendarId'`.

- [ ] **Step 3: Write the implementation**

```typescript
import { createHash } from 'node:crypto';

/**
 * 결정론적 PK 해시 — country + dateEt + event의 SHA-256 hex.
 *
 * `actual`을 의도적으로 제외한다: 발표 후 actual이 채워져도 같은 이벤트로 upsert해
 * 갱신하기 위함(`economic_calendar` 테이블 주석 참조). 구성 요소 사이에 ` `
 * 구분자를 넣어 'a'+'bc'와 'ab'+'c' 같은 경계 충돌을 방지한다.
 */
export function economicCalendarId(
    country: string,
    dateEt: string,
    event: string
): string {
    return createHash('sha256')
        .update(`${country} ${dateEt} ${event}`)
        .digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/lib/__tests__/economicCalendarId.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/lib/economicCalendarId.ts src/entities/economy/lib/__tests__/economicCalendarId.test.ts
git commit -m "feat(economy): add deterministic economic_calendar id hash (SP-A)"
```

---

## Task 3: ET date-window helpers

**Files:**
- Create: `src/entities/economy/lib/calendarWindow.ts`
- Test: `src/entities/economy/lib/__tests__/calendarWindow.test.ts`

These pure helpers produce ET-zoned `YYYY-MM-DD` strings and arithmetic, reused by the reader, the action, and the script. They mirror the `economySnapshotCache.isoDate` ET-formatter approach (deterministic `Intl.DateTimeFormat`, no dynamic API).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import {
    etDateOf,
    addEtDays,
    pastWindowStart,
    futureWindowEnd,
    PAST_WINDOW_DAYS,
    FUTURE_WINDOW_DAYS,
} from '@/entities/economy/lib/calendarWindow';

describe('etDateOf', () => {
    it('formats a UTC instant to its ET YYYY-MM-DD', () => {
        // 2026-01-15T02:00:00Z is still 2026-01-14 21:00 in ET (UTC-5).
        expect(etDateOf(new Date('2026-01-15T02:00:00Z'))).toBe('2026-01-14');
    });

    it('handles afternoon UTC staying same ET day', () => {
        expect(etDateOf(new Date('2026-01-15T18:00:00Z'))).toBe('2026-01-15');
    });
});

describe('addEtDays', () => {
    it('adds days to a YYYY-MM-DD string', () => {
        expect(addEtDays('2026-01-31', 1)).toBe('2026-02-01');
    });
    it('subtracts days with a negative delta', () => {
        expect(addEtDays('2026-03-01', -1)).toBe('2026-02-28');
    });
    it('crosses a year boundary', () => {
        expect(addEtDays('2025-12-31', 1)).toBe('2026-01-01');
    });
});

describe('window bounds', () => {
    it('pastWindowStart is PAST_WINDOW_DAYS before the anchor', () => {
        expect(pastWindowStart('2026-06-20')).toBe(
            addEtDays('2026-06-20', -PAST_WINDOW_DAYS)
        );
    });
    it('futureWindowEnd is FUTURE_WINDOW_DAYS after the anchor', () => {
        expect(futureWindowEnd('2026-06-20')).toBe(
            addEtDays('2026-06-20', FUTURE_WINDOW_DAYS)
        );
    });
    it('past window is at least two weeks', () => {
        expect(PAST_WINDOW_DAYS).toBeGreaterThanOrEqual(14);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/lib/__tests__/calendarWindow.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/lib/calendarWindow'`.

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * 캘린더 윈도 일수 상수 + ET-zoned 날짜 헬퍼.
 *
 * `economySnapshotCache.isoDate`와 같은 ET formatter 패턴을 쓴다 — 서버가 UTC+0의
 * 00:00~04:59에 "오늘"을 계산할 때 ET 기준 전날로 밀리는 오차를 막는다. 모든 함수는
 * 결정론적(`Intl.DateTimeFormat` + 순수 산술)이라 ISR cold-gen에서 안전하다
 * (`Date.now()`/dynamic API 미사용 — 호출자가 `new Date()` 앵커를 주입).
 */

/** 과거 윈도 일수 — 최소 2주(spec). */
export const PAST_WINDOW_DAYS = 14;

/** 미래 윈도 일수 — #610 그리드의 다가오는 ~2주와 정렬. */
export const FUTURE_WINDOW_DAYS = 14;

const ET_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/New_York',
});

/** UTC instant → ET-zoned 'YYYY-MM-DD'. */
export function etDateOf(instant: Date): string {
    const parts = Object.fromEntries(
        ET_DATE_FORMAT.formatToParts(instant)
            .filter(p => p.type !== 'literal')
            .map(p => [p.type, p.value])
    ) as Record<'year' | 'month' | 'day', string>;
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** 'YYYY-MM-DD'에 일수를 더한 'YYYY-MM-DD' (UTC 산술 — TZ 비의존). */
export function addEtDays(dateEt: string, delta: number): string {
    const [y, m, d] = dateEt.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + delta));
    const yy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/** 앵커일(포함) 기준 과거 윈도 시작일. */
export function pastWindowStart(anchorEt: string): string {
    return addEtDays(anchorEt, -PAST_WINDOW_DAYS);
}

/** 앵커일(포함) 기준 미래 윈도 종료일. */
export function futureWindowEnd(anchorEt: string): string {
    return addEtDays(anchorEt, FUTURE_WINDOW_DAYS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/lib/__tests__/calendarWindow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/lib/calendarWindow.ts src/entities/economy/lib/__tests__/calendarWindow.test.ts
git commit -m "feat(economy): add ET calendar window helpers (SP-A)"
```

---

## Task 4: Calendar constants module

**Files:**
- Create: `src/entities/economy/lib/economyCalendarConstants.ts`

Small constants-only module so the action (`'use server'`, no non-function exports) and the reader can share the cache tag / TTL / refresh-flag window / ingestion window. No test (trivial literals; covered transitively by Tasks 5–7).

- [ ] **Step 1: Write the module**

```typescript
import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/shared/config/time';

/** revalidateTag 대상 — 캘린더 ISR 캐시만 무효화한다(스냅샷 캐시와 분리). */
export const ECONOMY_CALENDAR_CACHE_TAG = 'economy:calendar';

/**
 * 캘린더 reader의 `unstable_cache` revalidate — 24h, /economy revalidate(86400)와
 * 단일 TTL 공유. 신선도는 `ensureEconomicCalendarAction`의 revalidateTag가 책임진다.
 */
export const ECONOMY_CALENDAR_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** ensure가 매 접속마다 ±1개월을 fetch하는 ingestion 윈도(일수). */
export const CALENDAR_INGESTION_WINDOW_DAYS = 30;

/** 'US' — 현재 US 이벤트만 저장/표시. */
export const CALENDAR_COUNTRY = 'US';

const CALENDAR_REFRESH_FLAG_TTL_MINUTES = 60;

/**
 * ensure refresh-flag TTL — 이 윈도 안에 재접속(봇 재크롤 포함)하면 FMP fetch를
 * 건너뛴다. market-news `MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS` 패턴을 미러.
 */
export const CALENDAR_REFRESH_FLAG_TTL_SECONDS =
    CALENDAR_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

/** Redis refresh-flag 키 — 단일 글로벌 캘린더(심볼/카테고리 분기 없음). */
export const CALENDAR_REFRESH_FLAG_KEY = 'economy:calendar:refresh';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/entities/economy/lib/economyCalendarConstants.ts
git commit -m "feat(economy): add economy calendar constants (SP-A)"
```

---

## Task 5: Calendar DB repository

**Files:**
- Create: `src/entities/economy/api/economicCalendarRepository.ts`
- Test: `src/entities/economy/api/__tests__/economicCalendarRepository.test.ts`

`DrizzleEconomicCalendarRepository.upsertEvent` mirrors `DrizzleMarketNewsRepository.upsertMarketNewsItem`: insert on the deterministic id, `onConflictDoUpdate` with `setWhere IS DISTINCT FROM` so `actual`/`estimate`/`previous`/`impact`/`unit` update only on genuine change; `.returning({ id })` lets the caller skip `revalidateTag` when nothing changed. `listInRange` reads rows in a `dateEt` lexicographic range (FMP `dateEt` is `YYYY-MM-DD HH:mm:ss`, so string comparison is chronological).

- [ ] **Step 1: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { DrizzleEconomicCalendarRepository } from '@/entities/economy/api/economicCalendarRepository';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-13 08:30:00',
    event: 'Core CPI MoM (May)',
    impact: 'High',
    actual: null,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
};

/** Minimal chainable insert/onConflict/returning + select/from/where/orderBy stub. */
function makeDb(returningRows: { id: string }[], selectRows: unknown[]) {
    const returning = vi.fn(async () => returningRows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    const orderBy = vi.fn(async () => selectRows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    return {
        db: { insert, select } as never,
        spies: { insert, values, onConflictDoUpdate, returning, select, from, where, orderBy },
    };
}

describe('DrizzleEconomicCalendarRepository.upsertEvent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns true when a row was inserted or changed', async () => {
        const { db, spies } = makeDb([{ id: 'abc' }], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const changed = await repo.upsertEvent('US', EVENT);
        expect(changed).toBe(true);
        expect(spies.insert).toHaveBeenCalledOnce();
        expect(spies.onConflictDoUpdate).toHaveBeenCalledOnce();
    });

    it('returns false when the upsert touched no rows', async () => {
        const { db } = makeDb([], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const changed = await repo.upsertEvent('US', EVENT);
        expect(changed).toBe(false);
    });

    it('inserts with the deterministic id, country, and dateEt = FMP date', async () => {
        const { db, spies } = makeDb([{ id: 'abc' }], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        await repo.upsertEvent('US', EVENT);
        const inserted = spies.values.mock.calls[0][0] as Record<string, unknown>;
        expect(inserted.country).toBe('US');
        expect(inserted.dateEt).toBe('2026-06-13 08:30:00');
        expect(inserted.event).toBe('Core CPI MoM (May)');
        expect(inserted.impact).toBe('High');
        expect(typeof inserted.id).toBe('string');
        expect(inserted.id).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('DrizzleEconomicCalendarRepository.listInRange', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps DB rows to EconomicCalendarEvent and coerces unknown impact to Low', async () => {
        const { db } = makeDb(
            [],
            [
                {
                    dateEt: '2026-06-13 08:30:00',
                    event: 'Core CPI MoM (May)',
                    impact: 'High',
                    actual: 0.4,
                    estimate: 0.3,
                    previous: 0.2,
                    unit: '%',
                },
                {
                    dateEt: '2026-06-14 10:00:00',
                    event: 'Mystery',
                    impact: 'bogus',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: '',
                },
            ]
        );
        const repo = new DrizzleEconomicCalendarRepository(db);
        const events = await repo.listInRange('2026-06-01', '2026-06-30');
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({
            date: '2026-06-13 08:30:00',
            event: 'Core CPI MoM (May)',
            impact: 'High',
            actual: 0.4,
            estimate: 0.3,
            previous: 0.2,
            unit: '%',
        });
        expect(events[1].impact).toBe('Low');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/api/__tests__/economicCalendarRepository.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/api/economicCalendarRepository'`.

- [ ] **Step 3: Write the implementation**

```typescript
import 'server-only';
import { and, asc, gte, lte, sql } from 'drizzle-orm';
import type {
    CalendarImpact,
    EconomicCalendarEvent,
} from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { economicCalendar } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { economicCalendarId } from '../lib/economicCalendarId';

/** 읽기 경계에서 검증하는 impact 정규값 — 미지값은 'Low'로 강등(graceful). */
const IMPACT_RECORD: Record<CalendarImpact, true> = {
    High: true,
    Medium: true,
    Low: true,
};
function toImpact(value: string): CalendarImpact {
    return value in IMPACT_RECORD ? (value as CalendarImpact) : 'Low';
}

interface CalendarDbRow {
    dateEt: string;
    event: string;
    impact: string;
    actual: number | null;
    estimate: number | null;
    previous: number | null;
    unit: string;
}

function toEvent(row: CalendarDbRow): EconomicCalendarEvent {
    return {
        date: row.dateEt,
        event: row.event,
        impact: toImpact(row.impact),
        actual: row.actual,
        estimate: row.estimate,
        previous: row.previous,
        unit: row.unit,
    };
}

export class DrizzleEconomicCalendarRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 이벤트를 upsert하고 행이 실제로 삽입/변경됐는지 반환한다. 재fetch가 동일
     * 내용을 만들면 `setWhere IS DISTINCT FROM`이 UPDATE를 막아 false를 반환하므로
     * 호출자가 `revalidateTag`를 건너뛸 수 있다(`market_news` upsert와 동일).
     *
     * `id`는 country+dateEt+event 해시라 발표 후 actual/estimate/previous가 바뀌면
     * 같은 행에 UPDATE된다. `country`/`dateEt`/`event`는 키 구성요소라 `set`에서 제외.
     */
    async upsertEvent(
        country: string,
        event: EconomicCalendarEvent
    ): Promise<boolean> {
        const id = economicCalendarId(country, event.date, event.event);
        const changed = await withRetry(
            () =>
                this.db
                    .insert(economicCalendar)
                    .values({
                        id,
                        country,
                        dateEt: event.date,
                        event: event.event,
                        impact: event.impact,
                        estimate: event.estimate,
                        previous: event.previous,
                        actual: event.actual,
                        unit: event.unit,
                    })
                    .onConflictDoUpdate({
                        target: economicCalendar.id,
                        set: {
                            impact: sql`excluded.impact`,
                            estimate: sql`excluded.estimate`,
                            previous: sql`excluded.previous`,
                            actual: sql`excluded.actual`,
                            unit: sql`excluded.unit`,
                            fetchedAt: sql`now()`,
                        },
                        setWhere: sql`
                            ${economicCalendar.impact} IS DISTINCT FROM excluded.impact OR
                            ${economicCalendar.estimate} IS DISTINCT FROM excluded.estimate OR
                            ${economicCalendar.previous} IS DISTINCT FROM excluded.previous OR
                            ${economicCalendar.actual} IS DISTINCT FROM excluded.actual OR
                            ${economicCalendar.unit} IS DISTINCT FROM excluded.unit
                        `,
                    })
                    .returning({ id: economicCalendar.id }),
            NEON_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    /**
     * `[fromEt, toEt]` 범위(경계 포함)의 이벤트를 dateEt 오름차순으로 읽는다.
     * dateEt는 'YYYY-MM-DD HH:mm:ss'라 문자열 비교가 시간순과 일치한다. 경계는
     * 'YYYY-MM-DD' 날짜키 — `from`은 그대로(<= 그날 00:00:00 포함), `to`는 그날
     * 23:59:59까지 포함하도록 ' 23:59:59'를 덧붙인다.
     */
    async listInRange(
        fromEt: string,
        toEt: string
    ): Promise<EconomicCalendarEvent[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        dateEt: economicCalendar.dateEt,
                        event: economicCalendar.event,
                        impact: economicCalendar.impact,
                        actual: economicCalendar.actual,
                        estimate: economicCalendar.estimate,
                        previous: economicCalendar.previous,
                        unit: economicCalendar.unit,
                    })
                    .from(economicCalendar)
                    .where(
                        and(
                            gte(economicCalendar.dateEt, fromEt),
                            lte(economicCalendar.dateEt, `${toEt} 23:59:59`)
                        )
                    )
                    .orderBy(asc(economicCalendar.dateEt)),
            NEON_TRANSIENT_RETRY
        );
        return rows.map(toEvent);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/api/__tests__/economicCalendarRepository.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/api/economicCalendarRepository.ts src/entities/economy/api/__tests__/economicCalendarRepository.test.ts
git commit -m "feat(economy): add economic_calendar DB repository (SP-A)"
```

---

## Task 6: ISR-safe calendar reader

**Files:**
- Create: `src/entities/economy/api/getCalendarFromDb.ts`
- Test: `src/entities/economy/api/__tests__/getCalendarFromDb.test.ts`

`getCalendarFromDb(anchorEt)` computes `[pastWindowStart, futureWindowEnd]`, reads via the repository, and wraps the read in `unstable_cache` (revalidate 24h + `economy:calendar` tag) so ISR cold-gen can statically materialize it (`@neondatabase/serverless` HTTP is no-store; the wrapper makes the page cacheable per axis-1 of the 4-axis rule). The `anchorEt` is injected by the caller (page), keeping this function free of `Date.now()` — but it still derives the today anchor itself from an injected `Date` for callers that pass an instant. We expose an `anchorEt`-string entry point so the page computes ET-today once and passes it.

- [ ] **Step 1: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache:
        (fn: (...a: unknown[]) => unknown) =>
        (...a: unknown[]) =>
            fn(...a),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

const listInRange = vi.fn();
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listInRange = listInRange;
    },
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import {
    pastWindowStart,
    futureWindowEnd,
} from '@/entities/economy/lib/calendarWindow';

describe('getCalendarFromDb', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listInRange.mockResolvedValue([]);
    });

    it('reads the past-window..future-window range around the anchor', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(listInRange).toHaveBeenCalledWith(
            pastWindowStart('2026-06-20'),
            futureWindowEnd('2026-06-20')
        );
    });

    it('returns the rows the repository produced', async () => {
        const event = {
            date: '2026-06-19 08:30:00',
            event: 'X',
            impact: 'High' as const,
            actual: 1,
            estimate: 1,
            previous: 1,
            unit: '%',
        };
        listInRange.mockResolvedValue([event]);
        const events = await getCalendarFromDb('2026-06-20');
        expect(events).toEqual([event]);
    });

    it('degrades to [] on DB failure (graceful, not throw)', async () => {
        listInRange.mockRejectedValue(new Error('neon down'));
        const events = await getCalendarFromDb('2026-06-20');
        expect(events).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/api/__tests__/getCalendarFromDb.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/api/getCalendarFromDb'`.

- [ ] **Step 3: Write the implementation**

```typescript
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import {
    pastWindowStart,
    futureWindowEnd,
} from '../lib/calendarWindow';
import {
    ECONOMY_CALENDAR_CACHE_TAG,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
} from '../lib/economyCalendarConstants';

/**
 * 과거 2주 + 미래 윈도의 캘린더 이벤트를 DB에서 읽는다.
 *
 * ISR cold-gen 안전: `@neondatabase/serverless` HTTP는 no-store라 static generate가
 * `DYNAMIC_SERVER_USAGE`를 throw한다 — `unstable_cache`로 감싸 HTML에 박고 정적화한다
 * (src/app/CLAUDE.md 4축 규약 축1). revalidate=24h + `economy:calendar` 태그로
 * `ensureEconomicCalendarAction`이 on-demand 무효화 가능. cookies/headers/connection
 * 미사용, `anchorEt`는 호출자(페이지 RSC)가 ET-오늘을 1회 계산해 주입 → `Date.now()` 없음.
 *
 * DB 실패 시 빈 배열로 graceful — 캘린더 섹션만 비고 페이지는 렌더.
 *
 * `anchorEt`를 캐시 키 파트에 넣어 날짜가 바뀌면 자연히 새 윈도로 리프레시한다.
 * React.cache로 요청 내 dedup(metadata/본문 중복 호출 대비).
 */
export const getCalendarFromDb = cache(
    (anchorEt: string): Promise<EconomicCalendarEvent[]> =>
        unstable_cache(
            async () => {
                try {
                    const { db } = getDatabaseClient();
                    const repo = new DrizzleEconomicCalendarRepository(db);
                    return await repo.listInRange(
                        pastWindowStart(anchorEt),
                        futureWindowEnd(anchorEt)
                    );
                } catch (error) {
                    console.error(
                        '[getCalendarFromDb] DB read failed:',
                        error
                    );
                    return [];
                }
            },
            ['economy-calendar-db', anchorEt],
            {
                revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
                tags: [ECONOMY_CALENDAR_CACHE_TAG],
            }
        )()
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/api/__tests__/getCalendarFromDb.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/api/getCalendarFromDb.ts src/entities/economy/api/__tests__/getCalendarFromDb.test.ts
git commit -m "feat(economy): add ISR-safe getCalendarFromDb reader (SP-A)"
```

---

## Task 7: `ensureEconomicCalendarAction` + barrel

**Files:**
- Create: `src/entities/economy/actions/ensureEconomicCalendarAction.ts`
- Create: `src/entities/economy/actions.ts`
- Test: `src/entities/economy/actions/__tests__/ensureEconomicCalendarAction.test.ts`

Mirrors `ensureMarketNewsCardsAnalyzedAction`: a refresh-flag guard (Redis), ±1-month FMP fetch via `FmpEconomyProvider.getCalendar` (graceful on failure), `Promise.allSettled` upserts with a majority-failure guard, and a single `revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max')` when ≥1 row changed. No AI/LLM steps (those are SP-D). The refresh-flag helpers live inline in this action's slice (single global key, no sentinel) — to keep the `'use server'` file function-only, they go in a tiny non-action helper file.

- [ ] **Step 1: Create the refresh-flag helper (non-action)**

Create `src/entities/economy/api/calendarRefreshFlag.ts`:

```typescript
import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    CALENDAR_REFRESH_FLAG_KEY,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/economyCalendarConstants';

/** 최근 TTL 내 fetch 여부 — Redis 실패 시 false(항상 fetch). market-news 미러. */
export async function isCalendarRecentlyFetched(): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(CALENDAR_REFRESH_FLAG_KEY)) !== null;
    } catch (error) {
        console.error('[calendarRefreshFlag] get failed', error);
        return false;
    }
}

/** "최근 fetch함" 마킹 — Redis 실패 시 noop. */
export async function markCalendarFetched(): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(CALENDAR_REFRESH_FLAG_KEY, '1', {
            ex: CALENDAR_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[calendarRefreshFlag] set failed', error);
    }
}
```

- [ ] **Step 2: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));

const isCalendarRecentlyFetched = vi.fn();
const markCalendarFetched = vi.fn();
vi.mock('@/entities/economy/api/calendarRefreshFlag', () => ({
    isCalendarRecentlyFetched,
    markCalendarFetched,
}));

const getCalendar = vi.fn();
vi.mock('@/shared/api/fmp/FmpEconomyProvider', () => ({
    FmpEconomyProvider: class {
        getCalendar = getCalendar;
    },
}));

const upsertEvent = vi.fn();
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        upsertEvent = upsertEvent;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { ensureEconomicCalendarAction } from '@/entities/economy/actions/ensureEconomicCalendarAction';
import { ECONOMY_CALENDAR_CACHE_TAG } from '@/entities/economy/lib/economyCalendarConstants';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-13 08:30:00',
    event: 'Core CPI MoM (May)',
    impact: 'High',
    actual: 0.4,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
};

describe('ensureEconomicCalendarAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isCalendarRecentlyFetched.mockResolvedValue(false);
        markCalendarFetched.mockResolvedValue(undefined);
        getCalendar.mockResolvedValue([EVENT]);
        upsertEvent.mockResolvedValue(true);
    });

    it('skips fetch when recently fetched', async () => {
        isCalendarRecentlyFetched.mockResolvedValue(true);
        await ensureEconomicCalendarAction();
        expect(getCalendar).not.toHaveBeenCalled();
        expect(upsertEvent).not.toHaveBeenCalled();
    });

    it('fetches, upserts, and revalidates the calendar tag on change', async () => {
        await ensureEconomicCalendarAction();
        expect(markCalendarFetched).toHaveBeenCalledOnce();
        expect(getCalendar).toHaveBeenCalledOnce();
        expect(upsertEvent).toHaveBeenCalledWith('US', EVENT);
        expect(revalidateTag).toHaveBeenCalledWith(
            ECONOMY_CALENDAR_CACHE_TAG,
            'max'
        );
    });

    it('does not revalidate when no row changed', async () => {
        upsertEvent.mockResolvedValue(false);
        await ensureEconomicCalendarAction();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('swallows FMP failure without throwing or revalidating', async () => {
        getCalendar.mockRejectedValue(new Error('fmp down'));
        await expect(ensureEconomicCalendarAction()).resolves.toBeUndefined();
        expect(upsertEvent).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/actions/__tests__/ensureEconomicCalendarAction.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/actions/ensureEconomicCalendarAction'`.

- [ ] **Step 4: Write the action**

```typescript
'use server';

import { revalidateTag } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';

import { DrizzleEconomicCalendarRepository } from '../api/economicCalendarRepository';
import {
    isCalendarRecentlyFetched,
    markCalendarFetched,
} from '../api/calendarRefreshFlag';
import {
    addEtDays,
    etDateOf,
} from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY,
    CALENDAR_INGESTION_WINDOW_DAYS,
    ECONOMY_CALENDAR_CACHE_TAG,
} from '../lib/economyCalendarConstants';

/** upsert 과반 실패 시 abort 임계 분모. */
const MAJORITY_DIVISOR = 2;

/**
 * Server Action: ±1개월 윈도의 FMP economic-calendar를 fetch해 `economic_calendar`에
 * upsert하고, ≥1행이 실제로 변경되면 `economy:calendar` 태그를 무효화한다.
 *
 * `ensureMarketNewsCardsAnalyzedAction` 미러: refresh-flag 가드(봇 재크롤 시 fetch 생략),
 * graceful FMP 실패(빈 결과 X, DB 기존 데이터 유지), 과반 upsert 실패 시 abort.
 * AI 분석 없음(SP-D 별도). `waitUntil` 안에서 돌도록 설계 — 응답 스트림 비차단.
 */
export async function ensureEconomicCalendarAction(): Promise<void> {
    try {
        if (await isCalendarRecentlyFetched()) {
            return;
        }
        // async fetch 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 FMP 왕복 생략.
        await markCalendarFetched();

        const today = etDateOf(new Date());
        const from = addEtDays(today, -CALENDAR_INGESTION_WINDOW_DAYS);
        const to = addEtDays(today, CALENDAR_INGESTION_WINDOW_DAYS);

        const provider = new FmpEconomyProvider();
        const fresh = await provider.getCalendar(from, to).catch(
            (err: unknown) => {
                console.error(
                    '[ensureEconomicCalendarAction] FMP fetch failed:',
                    err
                );
                return null;
            }
        );
        if (fresh === null || fresh.length === 0) return;

        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);

        const settled = await Promise.allSettled(
            fresh.map(event => repo.upsertEvent(CALENDAR_COUNTRY, event))
        );
        const failures = settled.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error(
                `[ensureEconomicCalendarAction] ${failures.length}/${fresh.length} upserts failed`,
                failures.map(f => (f.status === 'rejected' ? f.reason : null))
            );
        }
        if (failures.length > fresh.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureEconomicCalendarAction] majority upsert failure (${failures.length}/${fresh.length}) — aborting`
            );
            return;
        }

        const changedCount = settled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length;
        if (changedCount > 0) {
            // 'economy:calendar' 태그만 무효화 — 스냅샷(지표/treasury) ISR 캐시는 무관.
            // Next 16 revalidateTag(tag, profile) — 'max'는 즉시 무효화.
            revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max');
        }
    } catch (error) {
        console.error('[ensureEconomicCalendarAction]', error);
    }
}
```

- [ ] **Step 5: Create the action barrel**

Create `src/entities/economy/actions.ts` (no `'use server'` — re-export only, per `entities/CLAUDE.md`):

```typescript
export { submitMacroBriefingAction } from './actions/submitMacroBriefingAction';
export { pollMacroBriefingAction } from './actions/pollMacroBriefingAction';
export { ensureEconomicCalendarAction } from './actions/ensureEconomicCalendarAction';
```

> Verify the first two re-exports match the existing action file exports before saving — if a barrel already exists, just add the `ensureEconomicCalendarAction` line instead of overwriting. (Run `ls src/entities/economy/actions.ts` first; the economy slice currently has no barrel, so the two macro actions are imported deep — keep them deep and make this barrel export only `ensureEconomicCalendarAction` if adding the macro lines would break their existing deep importers. Safest: barrel exports only `ensureEconomicCalendarAction`.)

Final safe barrel content:

```typescript
export { ensureEconomicCalendarAction } from './actions/ensureEconomicCalendarAction';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/actions/__tests__/ensureEconomicCalendarAction.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/entities/economy/actions/ensureEconomicCalendarAction.ts src/entities/economy/actions/__tests__/ensureEconomicCalendarAction.test.ts src/entities/economy/api/calendarRefreshFlag.ts src/entities/economy/actions.ts
git commit -m "feat(economy): add ensureEconomicCalendarAction on-access ingestion (SP-A)"
```

---

## Task 8: Indicator base-name normalizer (for backfill dump)

**Files:**
- Create: `scripts/lib/normalizeIndicatorBaseName.ts`
- Test: `scripts/lib/__tests__/normalizeIndicatorBaseName.test.ts`

The backfill dumps the distinct **base** indicator names (suffix-stripped) for SP-B dictionary seeding. SP-B will own the full normalizer; SP-A only needs the base-name extraction for the enumeration dump. Keep it as a tiny pure function the script and its test import.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeIndicatorBaseName } from '../normalizeIndicatorBaseName';

describe('normalizeIndicatorBaseName', () => {
    it('strips a trailing month suffix', () => {
        expect(normalizeIndicatorBaseName('Core PCE Price Index YoY (May)')).toBe(
            'Core PCE Price Index YoY'
        );
    });
    it('strips a trailing quarter suffix', () => {
        expect(normalizeIndicatorBaseName('GDP Growth Rate QoQ (Q1)')).toBe(
            'GDP Growth Rate QoQ'
        );
    });
    it('strips a trailing date-token suffix', () => {
        expect(normalizeIndicatorBaseName('Fed Interest Rate Decision (Jun/20)')).toBe(
            'Fed Interest Rate Decision'
        );
    });
    it('leaves names without a trailing suffix unchanged', () => {
        expect(normalizeIndicatorBaseName('Initial Jobless Claims')).toBe(
            'Initial Jobless Claims'
        );
    });
    it('trims surrounding whitespace', () => {
        expect(normalizeIndicatorBaseName('  CPI YoY (Apr)  ')).toBe('CPI YoY');
    });
    it('only strips the final parenthetical, not interior ones', () => {
        expect(normalizeIndicatorBaseName('Index (ex Food) MoM (Apr)')).toBe(
            'Index (ex Food) MoM'
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/__tests__/normalizeIndicatorBaseName.test.ts`
Expected: FAIL — `Cannot find module '../normalizeIndicatorBaseName'`.

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * FMP 이벤트명에서 마지막 괄호 접미사를 제거해 base 지표명을 반환한다.
 * 예: 'Core PCE Price Index YoY (May)' → 'Core PCE Price Index YoY'.
 *
 * 마지막 괄호 그룹만 제거한다 — 'Index (ex Food) MoM (Apr)'의 '(ex Food)'는 보존.
 * SP-B가 전체 정규화(기간 토큰 한국어화 등)를 소유하며, SP-A는 enumeration 덤프용
 * base명 추출만 필요하다.
 */
export function normalizeIndicatorBaseName(raw: string): string {
    return raw.replace(/\s*\([^()]*\)\s*$/, '').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/normalizeIndicatorBaseName.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/normalizeIndicatorBaseName.ts scripts/lib/__tests__/normalizeIndicatorBaseName.test.ts
git commit -m "feat(economy): add indicator base-name normalizer for backfill dump (SP-A)"
```

---

## Task 9: One-time backfill script

**Files:**
- Create: `scripts/backfillEconomicCalendar.ts`
- Modify: `package.json` (add `db:backfill:calendar` script)

The script fetches ~2 years (`now - 1yr` … `now + 1yr`) in 3-month chunks (FMP supports 1yr per request, but 3-month chunks bound per-request payload size and let a partial failure retry a small slice), normalizes each chunk via `normalizeEconomicCalendar` (FMP returns all countries; the normalizer filters to US), upserts idempotently, and writes the distinct base indicator names to `scripts/output/economic-calendar-indicator-names.json` for SP-B seeding. It uses `postgres` + Drizzle directly (like `seed-korean-tickers.ts`) rather than the Neon HTTP client, so it can run as a standalone `tsx` process against `DIRECT_DATABASE_URL`. It calls the FMP endpoint via a direct `fetch` (the app's `fmpGet` is server-only and pulls in `server-only`/Next data-cache; a script-local fetch keeps the script free of Next runtime coupling).

There is no automated test for the script's `run()` (it is network + DB I/O glue, run manually by the user). Its logic-bearing pieces — id hashing (Task 2), normalization (core), base-name extraction (Task 8), window arithmetic (Task 3) — are each unit-tested. We add one importable pure helper `chunkDateRange` with a test to cover the chunking boundary logic.

- [ ] **Step 1: Write the failing test for the chunker**

Create `scripts/lib/__tests__/chunkDateRange.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chunkDateRange } from '../chunkDateRange';

describe('chunkDateRange', () => {
    it('splits a range into [from,to] chunks of at most chunkDays', () => {
        const chunks = chunkDateRange('2026-01-01', '2026-04-01', 30);
        expect(chunks[0]).toEqual({ from: '2026-01-01', to: '2026-01-31' });
        // last chunk is clamped to the overall end
        expect(chunks.at(-1)?.to).toBe('2026-04-01');
    });

    it('never lets a chunk end after the overall end', () => {
        const chunks = chunkDateRange('2026-01-01', '2026-01-10', 30);
        expect(chunks).toEqual([{ from: '2026-01-01', to: '2026-01-10' }]);
    });

    it('produces contiguous, non-overlapping chunks', () => {
        const chunks = chunkDateRange('2026-01-01', '2026-03-15', 30);
        for (let i = 1; i < chunks.length; i++) {
            // next chunk starts the day after the previous chunk ends
            const prevEnd = chunks[i - 1].to;
            const [y, m, d] = prevEnd.split('-').map(Number);
            const next = new Date(Date.UTC(y, m - 1, d + 1));
            const expected = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
            expect(chunks[i].from).toBe(expected);
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/__tests__/chunkDateRange.test.ts`
Expected: FAIL — `Cannot find module '../chunkDateRange'`.

- [ ] **Step 3: Write the chunker**

Create `scripts/lib/chunkDateRange.ts`:

```typescript
/** [from,to] 날짜 청크 — 둘 다 'YYYY-MM-DD', 경계 포함. */
export interface DateChunk {
    from: string;
    to: string;
}

function addDays(dateEt: string, delta: number): string {
    const [y, m, d] = dateEt.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + delta));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/**
 * `[start, end]`(경계 포함)을 최대 `chunkDays`일 길이의 연속·비중첩 청크로 분할한다.
 * 마지막 청크의 `to`는 전체 `end`로 클램프된다. 백필이 FMP를 작은 슬라이스로 호출해
 * per-request 페이로드를 제한하고 부분 실패 시 작은 범위만 재시도하기 위함.
 */
export function chunkDateRange(
    start: string,
    end: string,
    chunkDays: number
): DateChunk[] {
    const chunks: DateChunk[] = [];
    let cursor = start;
    while (cursor <= end) {
        const candidateEnd = addDays(cursor, chunkDays - 1);
        const to = candidateEnd > end ? end : candidateEnd;
        chunks.push({ from: cursor, to });
        cursor = addDays(to, 1);
    }
    return chunks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/chunkDateRange.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the backfill script**

Create `scripts/backfillEconomicCalendar.ts`:

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import {
    normalizeEconomicCalendar,
    type EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

import { economicCalendar } from '../src/shared/db/schema';
import { economicCalendarId } from '../src/entities/economy/lib/economicCalendarId';
import { chunkDateRange } from './lib/chunkDateRange';
import { normalizeIndicatorBaseName } from './lib/normalizeIndicatorBaseName';

const FMP_API_KEY = process.env.FMP_API_KEY;
const databaseUrl =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY env var required');
}
if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}

const CALENDAR_COUNTRY = 'US';
const CHUNK_DAYS = 90; // 3-month chunks
const BACKFILL_DAYS_EACH_SIDE = 365; // now ± 1yr
const FMP_BASE = 'https://financialmodelingprep.com/stable';
const OUTPUT_DIR = path.join(process.cwd(), 'scripts', 'output');
const OUTPUT_FILE = path.join(
    OUTPUT_DIR,
    'economic-calendar-indicator-names.json'
);

function isoDate(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function fetchCalendarChunk(
    from: string,
    to: string
): Promise<EconomicCalendarEvent[]> {
    const params = new URLSearchParams({ from, to, apikey: FMP_API_KEY! });
    const res = await fetch(`${FMP_BASE}/economic-calendar?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`FMP economic-calendar ${from}..${to} → HTTP ${res.status}`);
    }
    const raw = (await res.json()) as unknown;
    return normalizeEconomicCalendar(raw);
}

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client);

    const now = new Date();
    const start = isoDate(
        new Date(now.getTime() - BACKFILL_DAYS_EACH_SIDE * 86_400_000)
    );
    const end = isoDate(
        new Date(now.getTime() + BACKFILL_DAYS_EACH_SIDE * 86_400_000)
    );
    const chunks = chunkDateRange(start, end, CHUNK_DAYS);
    console.log(
        `Backfilling ${CALENDAR_COUNTRY} calendar ${start}..${end} in ${chunks.length} chunk(s)`
    );

    const baseNames = new Set<string>();
    let upserted = 0;

    for (const { from, to } of chunks) {
        const events = await fetchCalendarChunk(from, to);
        console.log(`  ${from}..${to}: ${events.length} US events`);
        for (const event of events) {
            baseNames.add(normalizeIndicatorBaseName(event.event));
        }
        if (events.length === 0) continue;

        // Idempotent upsert — onConflictDoUpdate on the deterministic id.
        await db
            .insert(economicCalendar)
            .values(
                events.map(event => ({
                    id: economicCalendarId(
                        CALENDAR_COUNTRY,
                        event.date,
                        event.event
                    ),
                    country: CALENDAR_COUNTRY,
                    dateEt: event.date,
                    event: event.event,
                    impact: event.impact,
                    estimate: event.estimate,
                    previous: event.previous,
                    actual: event.actual,
                    unit: event.unit,
                }))
            )
            .onConflictDoUpdate({
                target: economicCalendar.id,
                set: {
                    impact: sql`excluded.impact`,
                    estimate: sql`excluded.estimate`,
                    previous: sql`excluded.previous`,
                    actual: sql`excluded.actual`,
                    unit: sql`excluded.unit`,
                    fetchedAt: sql`now()`,
                },
            });
        upserted += events.length;
    }

    const sortedNames = [...baseNames].toSorted((a, b) => a.localeCompare(b));
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(OUTPUT_FILE, `${JSON.stringify(sortedNames, null, 2)}\n`);

    console.log(
        `Done — upserted ${upserted} event rows; dumped ${sortedNames.length} distinct base indicator names to ${OUTPUT_FILE}`
    );
    await client.end();
}

run().catch(error => {
    console.error('[backfillEconomicCalendar] failed:', error);
    process.exitCode = 1;
});
```

- [ ] **Step 6: Add the package.json script**

In `package.json`, add this line to the `scripts` block, next to the other `db:*` entries (after `db:migrate:tickers`):

```json
"db:backfill:calendar": "dotenv -e .env.local -- node_modules/.bin/tsx scripts/backfillEconomicCalendar.ts",
```

- [ ] **Step 7: Typecheck the script**

Run: `npx tsc --noEmit`
Expected: PASS. (The script imports `postgres-js` drizzle adapter and `postgres`, both already in `node_modules` — confirmed by `seed-korean-tickers.ts` using `postgres`.)

- [ ] **Step 8: Lint the script and helpers**

Run: `yarn lint`
Expected: PASS (no errors). If `scripts/` is outside the lint glob, that is acceptable — but the `scripts/lib/*.ts` pure helpers and tests must lint clean.

- [ ] **Step 9: Commit**

```bash
git add scripts/backfillEconomicCalendar.ts scripts/lib/chunkDateRange.ts scripts/lib/__tests__/chunkDateRange.test.ts package.json
git commit -m "feat(economy): add one-time economic calendar backfill script (SP-A)"
```

> Note: actually running `yarn db:backfill:calendar` against the live DB is an operational step the user performs once (it requires `FMP_API_KEY` + `DIRECT_DATABASE_URL`). The dumped `economic-calendar-indicator-names.json` feeds SP-B.

---

## Task 10: Client on-access trigger hook

**Files:**
- Create: `src/widgets/economy/hooks/useEconomicCalendarTrigger.ts`
- Test: `src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx`

Mirrors `useMarketNewsAnalysisTrigger`: fire `ensureEconomicCalendarAction()` once on mount (fire-and-forget, errors logged). No category param — the calendar is a single global feed.

- [ ] **Step 1: Write the failing test**

```typescript
const ensureEconomicCalendarAction = vi.fn();
vi.mock('@/entities/economy/actions', () => ({ ensureEconomicCalendarAction }));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useEconomicCalendarTrigger } from '../useEconomicCalendarTrigger';

function Probe() {
    useEconomicCalendarTrigger();
    return null;
}

describe('useEconomicCalendarTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureEconomicCalendarAction.mockResolvedValue(undefined);
    });

    it('fires the ensure action once on mount', () => {
        render(<Probe />);
        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
    });

    it('does not re-fire on re-render', () => {
        const { rerender } = render(<Probe />);
        rerender(<Probe />);
        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
    });

    it('swallows a rejected action without throwing', () => {
        ensureEconomicCalendarAction.mockRejectedValue(new Error('boom'));
        expect(() => render(<Probe />)).not.toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx`
Expected: FAIL — `Cannot find module '../useEconomicCalendarTrigger'`.

- [ ] **Step 3: Write the hook**

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { ensureEconomicCalendarAction } from '@/entities/economy/actions';

/**
 * Fire-and-forget: `ensureEconomicCalendarAction()`를 마운트 시 1회 호출한다(봇 포함).
 * 에러는 로깅만 — 실패해도 소비자는 반응할 필요가 없다(다음 접속 또는 다음 refresh-flag
 * 만료 시 재시도). market-news `useMarketNewsAnalysisTrigger` 패턴 미러.
 */
export function useEconomicCalendarTrigger(): void {
    const triggeredRef = useRef(false);

    useEffect(() => {
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        void ensureEconomicCalendarAction().catch((e: unknown) => {
            console.error(
                '[useEconomicCalendarTrigger] ensureEconomicCalendarAction failed:',
                e
            );
        });
    }, []);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/economy/hooks/useEconomicCalendarTrigger.ts src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx
git commit -m "feat(economy): add useEconomicCalendarTrigger on-access hook (SP-A)"
```

---

## Task 11: Grid accepts `today` + default-selects it (and fires the trigger)

**Files:**
- Modify: `src/widgets/economy/sections/EconomicCalendarGrid.tsx`
- Modify: `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`

The grid currently default-selects the **earliest** group (`groups[0].dateKey`). SP-A adds a `today` prop (a KST `YYYY-MM-DD` date key, computed server-side from the ET-today instant) and changes the default selection to: today if a group for today exists, else the nearest upcoming group (first group with `dateKey >= today`), else the earliest group. It also calls `useEconomicCalendarTrigger()`.

- [ ] **Step 1: Write the failing tests**

Append to `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`. First add this mock at the top of the file (next to existing mocks) so the trigger's server action import doesn't blow up under jsdom:

```typescript
vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction: vi.fn().mockResolvedValue(undefined),
}));
```

Then add this describe block:

```typescript
describe('EconomicCalendarGrid default selection from today', () => {
    const ev = (date: string): EconomicCalendarEvent => ({
        date: `${date} 08:30:00`,
        event: `E ${date}`,
        impact: 'High',
        actual: null,
        estimate: 1,
        previous: 1,
        unit: '%',
    });

    it("selects today's panel when an event exists for today (KST)", () => {
        // 2026-06-20 08:30 ET → KST 2026-06-20 21:30 → KST date key 2026-06-20.
        render(
            <EconomicCalendarGrid
                events={[ev('2026-06-18'), ev('2026-06-20'), ev('2026-06-25')]}
                today="2026-06-20"
            />
        );
        // The today day-button is pressed.
        const todayBtn = screen.getByRole('button', {
            name: /6월 20일/,
        });
        expect(todayBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('selects the nearest upcoming day when today has no events', () => {
        render(
            <EconomicCalendarGrid
                events={[ev('2026-06-18'), ev('2026-06-25')]}
                today="2026-06-20"
            />
        );
        const upcomingBtn = screen.getByRole('button', {
            name: /6월 25일/,
        });
        expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('falls back to the earliest day when all events are in the past', () => {
        render(
            <EconomicCalendarGrid
                events={[ev('2026-06-10'), ev('2026-06-12')]}
                today="2026-06-20"
            />
        );
        const earliestBtn = screen.getByRole('button', {
            name: /6월 10일/,
        });
        expect(earliestBtn).toHaveAttribute('aria-pressed', 'true');
    });
});
```

> Note: existing tests in this file call `<EconomicCalendarGrid events={...} />` without `today`. Make `today` an **optional** prop defaulting to `''` so those tests keep their existing earliest-group behavior (when `today === ''`, no group key is `>= ''`-meaningful, so the fallback to `groups[0]` applies). Confirm existing tests still pass in Step 4.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`
Expected: FAIL — the new tests fail because `today` is not yet a prop and selection still defaults to `groups[0]`.

- [ ] **Step 3: Implement the prop + selection logic**

In `src/widgets/economy/sections/EconomicCalendarGrid.tsx`:

(a) Add the trigger import near the top (after the existing `cn`/`formatNum`/`etDateTimeToKst` imports):

```typescript
import { useEconomicCalendarTrigger } from '../hooks/useEconomicCalendarTrigger';
```

(b) Add a pure default-selection helper above the component (next to `spannedMonths`):

```typescript
/**
 * 기본 선택 날짜 키를 결정한다 — 결정론적(렌더 중 `Date.now()` 금지).
 * `today`(KST 'YYYY-MM-DD', 서버 RSC가 ET-오늘에서 1회 계산해 주입)에 그룹이 있으면
 * 그날, 없으면 `today` 이상인 가장 가까운 미래 그룹, 그것도 없으면 가장 이른 그룹.
 * groups는 dateKey 오름차순 정렬돼 있다(`groupEventsByKstDay`).
 */
function pickDefaultDateKey(groups: DayGroup[], today: string): string {
    if (groups.length === 0) return '';
    const exact = groups.find(g => g.dateKey === today);
    if (exact !== undefined) return exact.dateKey;
    const upcoming = groups.find(g => g.dateKey >= today);
    if (upcoming !== undefined) return upcoming.dateKey;
    return groups[0].dateKey;
}
```

(c) Extend the props interface:

```typescript
interface EconomicCalendarGridProps {
    events: readonly EconomicCalendarEvent[];
    /**
     * 기본 선택 기준일 — KST 'YYYY-MM-DD'. 서버 RSC가 ET-오늘 instant를
     * KST 날짜키로 1회 변환해 주입한다(ISR 안전: 클라에서 `Date.now()` 미사용).
     * 생략 시 가장 이른 그룹을 기본 선택(기존 동작 유지).
     */
    today?: string;
}
```

(d) Update the component signature, the trigger call, and the default-selection effect:

```typescript
export function EconomicCalendarGrid({
    events,
    today = '',
}: EconomicCalendarGridProps) {
    useEconomicCalendarTrigger();

    const [selectedDateKey, setSelectedDateKey] = useState('');
    const groups = useMemo(() => groupEventsByKstDay(events), [events]);
    const groupMap = useMemo(
        () => new Map<string, DayGroup>(groups.map(g => [g.dateKey, g])),
        [groups]
    );
    const months = useMemo(() => spannedMonths(groups), [groups]);

    /**
     * events/today가 바뀔 때 기본 선택 날짜를 재동기화한다(오늘 → 가장 가까운 미래 →
     * 가장 이른 그룹). useEffectEvent로 감싸 안정 참조를 만들고 startTransition으로
     * react-hooks/set-state-in-effect를 만족시킨다(기존 패턴 유지).
     */
    const syncDefault = useEffectEvent((): void => {
        startTransition(() => {
            setSelectedDateKey(pickDefaultDateKey(groups, today));
        });
    });
    useEffect(() => {
        syncDefault();
    }, [groups, today]);
```

The rest of the component body (the empty-state early return and the JSX) is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`
Expected: PASS — new default-selection tests pass and pre-existing tests still pass (earliest-group fallback when `today` omitted).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: PASS. (`useEffect` dep array now includes `today`; `syncDefault` is a stable `useEffectEvent` reference so exhaustive-deps is satisfied — same as the existing pattern.)

- [ ] **Step 6: Commit**

```bash
git add src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
git commit -m "feat(economy): grid default-selects today + fires calendar trigger (SP-A)"
```

---

## Task 12: Wire the page to the DB calendar source

**Files:**
- Modify: `src/app/economy/page.tsx`

Switch the calendar axis from the Redis snapshot (`snapshot.calendar`) to `getCalendarFromDb`. Compute ET-today once in the RSC, convert it to a KST date key, and pass both `events` and `today` to `<EconomicCalendar>`. Indicators/treasury stay on `getEconomySnapshotStatic`. The page already exports `revalidate = 86400` (literal) — leave it.

The today instant must become a KST date key for the grid (which groups by KST). The grid's existing `etDateTimeToKst` works on a full `'YYYY-MM-DD HH:mm:ss'` ET string. We compute ET-today as a date string via `etDateOf(new Date())`, then derive the KST date key by feeding a noon-ET timestamp through `etDateTimeToKst` (noon ET → same KST calendar day after the +13/+14h shift, avoiding midnight roll ambiguity).

- [ ] **Step 1: Add imports**

In `src/app/economy/page.tsx`, add after the existing economy api deep-imports (after the `peekMacroBriefingStatic` import):

```typescript
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { etDateOf } from '@/entities/economy/lib/calendarWindow';
import { etDateTimeToKst } from '@/shared/lib/etTimeUtils';
```

- [ ] **Step 2: Replace the calendar data wiring in `EconomyContent`**

In the `EconomyContent` async function, after the `peekSeed` block and before the `return`, compute the calendar events + today key:

```typescript
    // 캘린더는 Redis 스냅샷이 아니라 DB-backed 이력 레이어에서 읽는다(SP-A). 지표/treasury는
    // 스냅샷 그대로. ET-오늘을 1회 계산해 reader 앵커 + 그리드 기본 선택일로 공유한다
    // (ISR 안전: 결정론적 Intl 변환, dynamic API 미사용).
    const todayEt = etDateOf(new Date());
    // 정오 ET → KST 날짜키 — 자정 경계 롤오버 모호성 없이 ET-오늘과 같은 KST 달력일을 얻는다.
    const todayKstKey = etDateTimeToKst(`${todayEt} 12:00:00`).kstDateKey;
    const calendarEvents = await getCalendarFromDb(todayEt).catch(e => {
        console.error('[EconomyContent] getCalendarFromDb failed:', e);
        return [];
    });
```

Then change the JSX line:

```typescript
            <EconomicCalendar events={snapshot.calendar} />
```

to:

```typescript
            <EconomicCalendar events={calendarEvents} today={todayKstKey} />
```

- [ ] **Step 3: Confirm `etDateTimeToKst` exposes `kstDateKey`**

Run: `grep -n "kstDateKey" src/shared/lib/etTimeUtils.ts`
Expected: at least one match (the `EtToKstResult` return shape includes `kstDateKey`, as consumed by `EconomicCalendarGrid.groupEventsByKstDay`). If the property name differs, use the actual name from `EtToKstResult`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (`getCalendarFromDb` returns `Promise<EconomicCalendarEvent[]>`; `EconomicCalendar` (= `EconomicCalendarGrid`) accepts `events` + optional `today`.)

- [ ] **Step 5: Run the economy widget + page-adjacent test suites**

Run: `npx vitest run src/widgets/economy src/entities/economy`
Expected: PASS (all economy widget/entity tests green, including the grid default-selection tests).

- [ ] **Step 6: Build to verify ISR/cold-gen safety**

Run: `yarn build > /tmp/economy-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`, and `/economy` builds without a `DYNAMIC_SERVER_USAGE` error. Inspect the log: `grep -iE "economy|DYNAMIC_SERVER_USAGE|error" /tmp/economy-build.log`. There must be **no** `DYNAMIC_SERVER_USAGE` attributed to `/economy` (the `unstable_cache` wrapper in `getCalendarFromDb` is what makes the DB read static-safe). If the build flags `/economy` as dynamic, re-check that `getCalendarFromDb` is `unstable_cache`-wrapped and that no `cookies()`/`headers()`/`connection()` leaked into the page path.

- [ ] **Step 7: Commit**

```bash
git add src/app/economy/page.tsx
git commit -m "feat(economy): switch calendar data source to DB history layer (SP-A)"
```

---

## Task 13: Full-suite green + final gates

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `yarn test`
Expected: PASS (no regressions across the repo).

- [ ] **Step 2: Lint + format gates**

Run: `yarn lint && yarn format`
Expected: lint PASS, format applies no pending changes (or only the files this plan touched, already clean). If `yarn format` rewrites files, re-run `yarn lint` and amend the relevant commit.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit any formatting fixups (if produced)**

```bash
git add -A
git commit -m "chore(economy): formatting + lint fixups (SP-A)"
```

(Skip if nothing changed.)

---

## Self-Review

**Spec coverage (SP-A section + shared data model):**

| Spec requirement | Task |
|---|---|
| `economic_calendar` table: id deterministic hash(country+dateEt+event), country, dateEt, event, impact, estimate/previous/actual nullable, unit, fetchedAt; indexes on dateEt, (country,dateEt), impact; **no** AI columns | Task 1 (table) + Task 2 (id hash) |
| id excludes `actual` (post-release upsert lands on same row) | Task 2 (hash inputs) + Task 5 (`set` excludes key parts, updates actual) |
| `scripts/backfillEconomicCalendar.ts`: ~2yr (now±1yr) in chunks, normalize via core, idempotent `onConflictDoUpdate(id)`, dump distinct normalized indicator names | Task 8 (base-name normalizer) + Task 9 (chunker + script + name dump file) |
| `ensureEconomicCalendarAction`: 'use server', ±1mo FMP fetch, upsert (insert new + UPDATE actual/estimate/previous), revalidateTag, fire-and-forget error logging | Task 7 |
| `getCalendarFromDb`: past-2-weeks + future-window DB read, ISR-cold-gen-safe (`unstable_cache`, no cookies/headers/connection), returns `EconomicCalendarEvent[]` | Task 6 (reader) + Task 3 (window helpers) + Task 4 (TTL/tag constants) |
| economy page: calendar source → `getCalendarFromDb`; indicators/treasury stay on snapshot; pass server-computed ET-today default-selected-day prop | Task 12 |
| Grid: accept past+future events + `today` prop; default-select today (KST) else nearest upcoming | Task 11 |
| Client on-access trigger hook firing ensure once on mount (bots included) | Task 10 (hook) + Task 11 (grid wires it) |
| Error handling: FMP failure → DB graceful (not empty array); upsert conflict absorbed by id PK | Task 7 (FMP catch → keep DB data) + Task 6 (DB failure → []) + Task 5 (onConflictDoUpdate) |
| Tests: backfill (chunking, idempotent upsert via repo, name extraction), ensure (insert/actual-update branch), getCalendarFromDb (range/sort), ISR safety | Tasks 2, 3, 5, 6, 7, 8, 9, 10, 11 |
| `economic_indicator_translations` (SP-B), AI columns (SP-D) | **Out of SP-A scope** — explicitly excluded, not implemented here |

**Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N". Every code step contains complete code; every command is exact with expected output. Error handling is concrete (try/catch with `console.error` + graceful fallback) in Tasks 5, 6, 7, 10.

**Type consistency check:**
- `economicCalendarId(country, dateEt, event)` — same 3-arg signature in Tasks 2, 5, 9. ✓
- `DrizzleEconomicCalendarRepository` exposes `upsertEvent(country, event)` and `listInRange(fromEt, toEt)` — used identically in Tasks 5 (def), 6 (`listInRange`), 7 (`upsertEvent`), and mocked the same way in 6/7 tests. ✓
- `getCalendarFromDb(anchorEt: string)` — string-anchor entry point in Task 6 def, Task 6 tests, and Task 12 page call. ✓
- `ensureEconomicCalendarAction()` — zero-arg in Task 7 def/barrel, Task 10 hook, Task 11 grid mock. ✓
- `EconomicCalendarGridProps` adds optional `today?: string` — Task 11 def matches Task 12 usage (`today={todayKstKey}`). ✓
- Window helpers `pastWindowStart`/`futureWindowEnd`/`addEtDays`/`etDateOf` + `PAST_WINDOW_DAYS`/`FUTURE_WINDOW_DAYS` — defined Task 3, consumed in Tasks 6 (reader/test) and 7 (action). ✓
- Constants `ECONOMY_CALENDAR_CACHE_TAG`/`ECONOMY_CALENDAR_REVALIDATE_SECONDS`/`CALENDAR_INGESTION_WINDOW_DAYS`/`CALENDAR_COUNTRY`/refresh-flag — defined Task 4, consumed Tasks 6/7. ✓
- `normalizeEconomicCalendar(raw): EconomicCalendarEvent[]` and `EconomicCalendarEvent` shape (`date`/`event`/`impact`/`actual`/`estimate`/`previous`/`unit`) — real core exports (verified in `node_modules/@y0ngha/siglens-core/dist/domain/economy/`), used in Tasks 5, 7, 9. ✓

**One open verification deferred to execution** (flagged inline, not a placeholder): Task 12 Step 3 confirms the exact `EtToKstResult` property name (`kstDateKey`) before wiring — it is the name `EconomicCalendarGrid` already destructures from `etDateTimeToKst`, so it is expected to match; the step exists only to guard against a rename.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-20-economy-calendar-SP-A-history-data-layer.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
