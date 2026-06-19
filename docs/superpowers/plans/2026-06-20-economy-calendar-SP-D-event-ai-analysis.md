# Economy Calendar SP-D — Event AI Analysis (Medium+) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI sentiment/summary/interpretation to announced Medium+ economic-calendar events. A new migration adds four AI columns (`sentiment`, `summaryKo`, `interpretationKo`, `analyzedAt`) deferred from SP-A; an `ensureEconomicEventsAnalyzedAction` (mirroring `ensureMarketNewsCardsAnalyzedAction`) finds rows where `impact IN ('High','Medium') AND actual IS NOT NULL AND analyzedAt IS NULL`, calls core `analyzeEconomicEvent`, writes the result, and `revalidateTag`s the calendar cache; the `DayDetailPanel` renders a sentiment badge + summary + interpretation for analyzed events.

**Architecture:** SP-D extends the SP-A `economic_calendar` table (DO NOT re-create it — reuse the SP-A `DrizzleEconomicCalendarRepository` and add methods to it). Analysis is **synchronous** (not a submit/poll worker job): the spec defines `analyzeEconomicEvent(input): EconomicEventAnalysis` as a direct call returning a single small JSON, the Medium+ announced volume is low (~140/month, and per-access only the not-yet-analyzed announced subset), and each call is one short structured output — so the macro-briefing submit/poll job queue is overkill here (justification §"Sync vs async" below). The ensure action mirrors market-news's refresh-flag guard + bounded-parallel `Promise.allSettled` + majority-failure guard + single `revalidateTag` on change, but replaces the `submit→poll→attachAnalysis` loop with a direct `analyzeEconomicEvent → attachEventAnalysis` per event. Two trigger modes share the same ensure: SEED (a one-time `tsx` script over all current Medium+ announced rows) and ON-ACCESS (the existing SP-A `useEconomicCalendarTrigger` fires it on `/economy` mount, bots included). The `DayDetailPanel` reads the AI columns off each `EconomicCalendarEvent` (extended with optional analysis fields) and renders a badge + two paragraphs when present.

**Tech Stack:** TypeScript, Drizzle ORM (Neon serverless + `postgres-js` for the seed script), `drizzle-kit` migrations, Next.js 16 (`'use server'` actions + `revalidateTag`), vitest + `@testing-library/react`, `@y0ngha/siglens-core` (`analyzeEconomicEvent`, `EconomicEventAnalysis`, `EconomicEventAnalysisInput`, `EconomicCalendarEvent`, `CalendarImpact`, `NewsSentiment` re-use for the badge tri-state).

---

## ⛔ CROSS-REPO NOTE — core release gates this plan

`analyzeEconomicEvent` is **analysis-domain logic** and lives in **`@y0ngha/siglens-core`** (a separate repo the user publishes, per CLAUDE.md cross-repo guard and the spec table row "이벤트 AI 분석 로직/프롬프트 → siglens-core"). **DO NOT implement the core function in this repo.**

The required ordering is:

1. **User** implements `analyzeEconomicEvent` in siglens-core (prompt, normalization, validation, `PROMPT_TEMPLATE_VERSION` bump), then **publishes** it (`npm version` + `git push --tags` → GitHub Packages; the user does the release, not Claude — see MEMORY `siglens-core release method` + `user handles core publish`).
2. **This siglens plan** is gated on that release: after the user bumps the published version, siglens updates the `@y0ngha/siglens-core` pin in `package.json` and `yarn install`s, then implements the tasks below.
3. **Until the core release lands, every siglens task here mocks `analyzeEconomicEvent`** via `vi.mock('@y0ngha/siglens-core', ...)`. The contract below is the exact mock surface — siglens code is written against it, and the only real-core dependency is at runtime after the version pin is updated.

### Exact core contract (defined here, implemented + released by the user in core)

```typescript
// Published by @y0ngha/siglens-core — siglens imports these types + the function.

/** Input to the per-event analyzer. All numeric fields may be null (pre-/partial release). */
export interface EconomicEventAnalysisInput {
    /** FMP event name, e.g. 'Core CPI MoM (May)'. */
    event: string;
    /** 'High' | 'Medium' | 'Low' — SP-D only ever calls for High/Medium. */
    impact: CalendarImpact;
    /** Announced value. SP-D only calls when actual !== null. */
    actual: number;
    estimate: number | null;
    previous: number | null;
    unit: string;
    /**
     * Optional recent trend (oldest→newest prior actuals) the analyzer may use
     * for context. SP-D passes it when cheaply available; core must handle [].
     */
    recentTrend?: number[];
}

/** LLM output — small structured JSON, validated + normalized inside core. */
export interface EconomicEventAnalysis {
    /** Directional read for risk assets. Re-uses the bullish/neutral/bearish tri-state. */
    sentiment: 'bullish' | 'neutral' | 'bearish';
    /** 1–2 sentence Korean summary of what was announced. */
    summaryKo: string;
    /** Korean interpretation — why it matters / likely market read. */
    interpretationKo: string;
}

/** Synchronous-ish: resolves the analysis directly (no jobId/poll). */
export function analyzeEconomicEvent(
    input: EconomicEventAnalysisInput
): Promise<EconomicEventAnalysis>;
```

`PROMPT_TEMPLATE_VERSION` is core's concern (it owns the analysis-cache key — see MEMORY `prompt template cache version`). siglens does **not** hash or version the prompt; siglens idempotency is the DB `analyzedAt` column + the refresh-flag (below).

### Sync vs async (submit/poll) — decision

market-news per-card analysis uses a **worker submit/poll** (`submitNewsCardAnalysis`/`pollNewsCardAnalysis`) because card enrichment is a multi-field translation over up to ~50 items per category. macro-briefing uses submit/poll because the briefing is a large multi-section document. **SP-D uses a synchronous `analyzeEconomicEvent`** because: (1) the spec explicitly defines a direct `(input) → EconomicEventAnalysis` return (no jobId); (2) the per-access workload is tiny — only Medium+ **announced** events **not yet analyzed** (steady state is a handful per access; ~140 Medium+/month total, seeded once); (3) each output is one short 3-field JSON. The ensure still bounds concurrency (`LLM_PARALLEL_LIMIT`) and runs fire-and-forget inside the on-access trigger, so a slow core call never blocks the response. If core later proves expensive enough to need a queue, the swap is contained to `analyzeAndPersistEvent` (submit/poll instead of a direct call) — the action/repo/display contracts are unchanged.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `package.json` | Modify | Bump `@y0ngha/siglens-core` to the version that ships `analyzeEconomicEvent` (after the user's release); add `db:seed:calendar-analysis` script. |
| `src/shared/db/schema.ts` | Modify | Add `sentiment`, `summaryKo`, `interpretationKo`, `analyzedAt` columns to `economicCalendar` (the SP-A table) + `(impact, analyzedAt)` partial-friendly index. |
| `drizzle/0019_*.sql` + `drizzle/meta/*` | Create (generated) | Migration adding the four AI columns + index (output of `yarn db:generate`). |
| `src/entities/economy/lib/economyCalendarConstants.ts` | Modify | Add `LLM_PARALLEL_LIMIT` + the analyzed-events cache tag reuse (tag already exists from SP-A). |
| `src/entities/economy/model.ts` | Create | `EconomicCalendarEventWithAnalysis` view type + sentiment validation record (read-boundary coercion). |
| `src/entities/economy/lib/__tests__/economicEventAnalysisGuard.test.ts` | Create | Tests for the sentiment read-boundary guard. |
| `src/entities/economy/lib/economicEventAnalysisGuard.ts` | Create | Pure `toEventSentiment(value): NewsSentiment \| null` coercion (mirrors `isNewsSentiment`). |
| `src/entities/economy/api/economicCalendarRepository.ts` | Modify (SP-A file) | Add `attachEventAnalysis(id, analysis)` (write-once via `analyzedAt IS NULL` guard) + `listUnanalyzedAnnounced(impacts)` + extend `listInRange` select to return AI columns. |
| `src/entities/economy/api/__tests__/economicCalendarRepository.analysis.test.ts` | Create | Tests for the three new/changed repo paths (separate file from the SP-A repo test). |
| `src/entities/economy/actions/ensureEconomicEventsAnalyzedAction.ts` | Create | `'use server'` — refresh-flag guard → select unanalyzed announced Medium+ → bounded-parallel `analyzeEconomicEvent` + `attachEventAnalysis` → `revalidateTag` on change. |
| `src/entities/economy/actions/__tests__/ensureEconomicEventsAnalyzedAction.test.ts` | Create | Tests for condition filtering, analyze→persist, graceful core failure, no-revalidate-when-none. |
| `src/entities/economy/api/calendarAnalysisRefreshFlag.ts` | Create | Redis refresh-flag for the analysis pass (separate key from SP-A's ingestion flag). |
| `src/entities/economy/actions.ts` | Modify (SP-A barrel) | Add `ensureEconomicEventsAnalyzedAction` re-export. |
| `scripts/seedEconomicEventAnalysis.ts` | Create | One-time `tsx` SEED: analyze all current Medium+ announced unanalyzed rows. |
| `src/widgets/economy/sections/EconomicCalendarGrid.tsx` | Modify (SP-A file) | `DayDetailPanel` renders sentiment badge + summaryKo + interpretationKo for analyzed events; fire `ensureEconomicEventsAnalyzedAction` alongside the SP-A ingest trigger. |
| `src/widgets/economy/sections/__tests__/EconomicCalendarGrid.analysis.test.tsx` | Create | Tests for analyzed-event display + untouched not-analyzed/Low/unannounced. |
| `src/widgets/economy/hooks/useEconomicCalendarTrigger.ts` | Modify (SP-A hook) | Also fire `ensureEconomicEventsAnalyzedAction` once on mount (sequenced after ingest). |
| `src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx` | Modify (SP-A test) | Assert both ensure actions fire once. |

**FSD compliance:** AI columns live on the SP-A `economic_calendar` table (`shared/db`); the pure sentiment guard + view type live in `entities/economy/lib`/`model.ts`; the repo extension stays in `entities/economy/api` (server-only, barrel-excluded); the action lives in `entities/economy/actions/` and is re-exported through the SP-A `actions.ts` barrel (no `'use server'` on the barrel — `entities/CLAUDE.md`); the client trigger stays in `widgets/economy/hooks`; the display change stays in the existing grid section. The seed script lives under top-level `scripts/` (not an FSD layer) and deep-imports the repo + core via `tsx`.

---

## Conventions to honor (gates)

- **Reuse SP-A — never duplicate.** The `economic_calendar` table, `DrizzleEconomicCalendarRepository`, `economicCalendarId`, window helpers, and `ensureEconomicCalendarAction` are SP-A's. SP-D **adds columns + repo methods + a second ensure action**; it does not re-declare any SP-A artifact.
- **Migration is additive + nullable.** All four columns are `NULL`-able (announced-but-unanalyzed and unannounced rows stay `NULL`) — no `NOT NULL`/`DEFAULT` backfill needed. SP-A reserved `0018`; SP-D is `0019`.
- **Tests colocated** in `__tests__/`. Run a single file with `npx vitest run <path>`.
- **`tsc`, ESLint, Prettier must pass.** No `eslint-disable`. Multi-line JSDoc is allowed (CLAUDE.md Documentation Policy override).
- **`'use server'` files export only async functions** — constants/guards/types live in separate files (`entities/CLAUDE.md`).
- **Barrel exclusion:** `api/` server-only modules + `actions/*` stay out of `entities/economy/index.ts`; consumers deep-import. The model view-type is client-safe and may be barrel-exported if needed, but the grid imports `EconomicCalendarEvent` from core directly (it already does).
- **ISR safety:** SP-D adds no new page render path. The action reads AI columns through `listInRange` (already `unstable_cache`-wrapped by SP-A's `getCalendarFromDb`); the grid stays a client component. No `cookies()`/`headers()`/`connection()`/`Date.now()` introduced into the cold-gen path. `revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max')` reuses SP-A's tag so an analysis pass refreshes the same cached calendar read.
- **Sentiment is validated at the read boundary** (raw `text` column, no CHECK) — coerce unknown → `null` so display degrades gracefully (mirrors `market_news` `NEWS_SENTIMENT_RECORD`).
- **Commit per task** with the conventional-commit messages given. Do not push (git-agent's job).

---

## Task 0: Gate on the core release (no code)

**Files:** `package.json` (version pin only)

- [ ] **Step 1: Confirm the core release shipped**

Run: `npm view @y0ngha/siglens-core@latest version --registry=https://npm.pkg.github.com` (or check the user's release note). Confirm the published version exports `analyzeEconomicEvent` + `EconomicEventAnalysis` + `EconomicEventAnalysisInput`.

Expected: a version newer than the SP-A pin. **If the core release has NOT landed, STOP and report to the user** — every task below depends on it (tasks are written against the mock, but Task 12's typecheck/build needs the real types). Do not invent the core function locally.

- [ ] **Step 2: Bump the pin + install**

In `package.json`, set `"@y0ngha/siglens-core": "<released version>"`. Run: `yarn install`.
Expected: lockfile updates; `node_modules/@y0ngha/siglens-core/dist/domain/economy/` exposes `analyzeEconomicEvent` (verify: `grep -rl "analyzeEconomicEvent" node_modules/@y0ngha/siglens-core/dist`).

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore(economy): bump siglens-core for analyzeEconomicEvent (SP-D)"
```

> If the worktree has a stale `node_modules` core version (MEMORY `worktree core version mismatch`), `rm -rf node_modules && yarn install` rather than `--no-verify` past failing tests.

---

## Task 1: Add AI columns to `economic_calendar`

**Files:**
- Modify: `src/shared/db/schema.ts` (the SP-A `economicCalendar` `pgTable`)
- Create (generated): `drizzle/0019_*.sql`, `drizzle/meta/0019_snapshot.json`, updated `drizzle/meta/_journal.json`

- [ ] **Step 1: Add the four columns + index to the SP-A table**

In `src/shared/db/schema.ts`, inside the existing `economicCalendar` `pgTable` (added by SP-A), add the AI columns after `fetchedAt` and add a fourth index. The columns mirror `marketNews`'s analysis columns (`text` + nullable + `analyzed_at` timestamptz).

Replace the SP-A column-block tail (`fetchedAt: timestamp(...).notNull().defaultNow(),` immediately followed by the closing `},`) with:

```typescript
        fetchedAt: timestamp('fetched_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        // --- SP-D AI 분석 컬럼 (Medium+ 발표 이벤트만 채워짐) ---
        /** core analyzeEconomicEvent 결과: 'bullish' | 'neutral' | 'bearish'. 미분석=null. */
        sentiment: text('sentiment'),
        /** 발표 내용 1~2문장 한국어 요약. 미분석=null. */
        summaryKo: text('summary_ko'),
        /** 발표의 시장 해석(왜 중요한지). 미분석=null. */
        interpretationKo: text('interpretation_ko'),
        /** 분석 완료 시각 — 멱등성 가드(IS NULL이면 미분석). */
        analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
```

And add a fourth index in the table's index array (after `economic_calendar_impact_idx`):

```typescript
        // 미분석 발표분 스캔용 — ensureEconomicEventsAnalyzedAction이 impact+analyzedAt로 필터.
        index('economic_calendar_impact_analyzed_at_idx').on(
            table.impact,
            table.analyzedAt
        ),
```

- [ ] **Step 2: Generate the migration**

Run: `yarn db:generate`
Expected: drizzle-kit reports `0019_*` ALTERing `economic_calendar` to add four columns + one index. (No DB connection needed for `generate`.)

- [ ] **Step 3: Verify the generated SQL**

Run: `cat drizzle/0019_*.sql`
Expected: `ALTER TABLE "economic_calendar" ADD COLUMN "sentiment" text;`, `"summary_ko" text`, `"interpretation_ko" text`, `"analyzed_at" timestamp with time zone`, and `CREATE INDEX "economic_calendar_impact_analyzed_at_idx"`. All columns nullable, no `NOT NULL`/`DEFAULT` (additive, safe on a populated table). If it differs, fix the schema and re-run `yarn db:generate`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema.ts drizzle/0019_*.sql drizzle/meta
git commit -m "feat(economy): add AI analysis columns to economic_calendar (SP-D)"
```

> Applying the migration (`yarn db:migrate`) is an operational step the user runs against their environment — not part of this code plan.

---

## Task 2: Sentiment read-boundary guard + view type

**Files:**
- Create: `src/entities/economy/lib/economicEventAnalysisGuard.ts`
- Create: `src/entities/economy/model.ts`
- Test: `src/entities/economy/lib/__tests__/economicEventAnalysisGuard.test.ts`

The DB stores `sentiment` as raw `text` (no CHECK), so we validate it at the read boundary and coerce unknown values to `null` — display falls back to "no badge" gracefully. We re-use core's `NewsSentiment` (`'bullish'|'neutral'|'bearish'`) since `EconomicEventAnalysis.sentiment` is the same tri-state (DESIGN tokens already exist for it).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { toEventSentiment } from '@/entities/economy/lib/economicEventAnalysisGuard';

describe('toEventSentiment', () => {
    it('passes through the three valid sentiments', () => {
        expect(toEventSentiment('bullish')).toBe('bullish');
        expect(toEventSentiment('neutral')).toBe('neutral');
        expect(toEventSentiment('bearish')).toBe('bearish');
    });

    it('coerces unknown strings to null', () => {
        expect(toEventSentiment('positive')).toBeNull();
        expect(toEventSentiment('')).toBeNull();
    });

    it('coerces null/undefined to null', () => {
        expect(toEventSentiment(null)).toBeNull();
        expect(toEventSentiment(undefined)).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/lib/__tests__/economicEventAnalysisGuard.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/lib/economicEventAnalysisGuard'`.

- [ ] **Step 3: Write the guard**

```typescript
import type { NewsSentiment } from '@y0ngha/siglens-core';

/**
 * `economic_calendar.sentiment`(raw text, CHECK 없음)를 읽기 경계에서 검증한다.
 * 유효하지 않은 값(스키마 드리프트·수동 SQL·구버전 데이터)은 null로 강등해 표시
 * 계층이 배지 없이 graceful 폴백한다(`market_news`의 NEWS_SENTIMENT_RECORD 미러).
 *
 * `EconomicEventAnalysis.sentiment`는 core의 `NewsSentiment`와 동일한
 * 'bullish'|'neutral'|'bearish' tri-state라 같은 DESIGN 토큰을 재사용한다.
 */
const EVENT_SENTIMENT_RECORD: Record<NewsSentiment, true> = {
    bullish: true,
    neutral: true,
    bearish: true,
};

export function toEventSentiment(value: unknown): NewsSentiment | null {
    return typeof value === 'string' && value in EVENT_SENTIMENT_RECORD
        ? (value as NewsSentiment)
        : null;
}
```

- [ ] **Step 4: Write the view type (`model.ts`)**

```typescript
import type {
    EconomicCalendarEvent,
    NewsSentiment,
} from '@y0ngha/siglens-core';

/**
 * 표시 계층용 캘린더 이벤트 + (선택) AI 분석. SP-A `EconomicCalendarEvent`에
 * SP-D 분석 필드를 합성한 view 타입이다. `sentiment`는 읽기 경계에서 검증된
 * `NewsSentiment | null`(`toEventSentiment`), 요약/해석은 미분석이면 null.
 *
 * 미발표/Low/미분석 이벤트는 세 필드가 모두 null이라 기존 표시와 동일하게 렌더된다.
 */
export interface EconomicCalendarEventWithAnalysis extends EconomicCalendarEvent {
    sentiment: NewsSentiment | null;
    summaryKo: string | null;
    interpretationKo: string | null;
    analyzedAt: Date | null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/lib/__tests__/economicEventAnalysisGuard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/entities/economy/lib/economicEventAnalysisGuard.ts src/entities/economy/lib/__tests__/economicEventAnalysisGuard.test.ts src/entities/economy/model.ts
git commit -m "feat(economy): add event-sentiment guard + analysis view type (SP-D)"
```

---

## Task 3: Constants — parallel limit + analysis refresh flag key

**Files:**
- Modify: `src/entities/economy/lib/economyCalendarConstants.ts` (the SP-A constants file)

Add the bounded-parallel limit and a **separate** Redis refresh-flag key for the analysis pass (so the analysis pass and SP-A's ±1mo ingestion pass throttle independently — analysis can re-scan even when ingestion was recently skipped). The cache tag (`ECONOMY_CALENDAR_CACHE_TAG`) is reused from SP-A.

- [ ] **Step 1: Append to the SP-A constants file**

```typescript
/**
 * 분석 ensure가 동시에 호출하는 core analyzeEconomicEvent 최대 병렬 수.
 * market-news LLM_PARALLEL_LIMIT 패턴 — worker 큐 stampede 방지. 발표 Medium+ 미분석분이
 * 매 접속 소수라 작게 잡는다.
 */
export const CALENDAR_ANALYSIS_PARALLEL_LIMIT = 4;

/** core가 표준 Record 키로 받는 Medium+ 임팩트 집합 — 분석 대상 필터. */
export const CALENDAR_ANALYZED_IMPACTS = ['High', 'Medium'] as const;

const CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_MINUTES = 30;

/**
 * 분석 pass refresh-flag TTL — 이 윈도 안 재접속(봇 재크롤 포함)이면 분석 스캔을 건너뛴다.
 * SP-A 인제스션 플래그와 별도 키라 두 pass가 독립적으로 쓰로틀된다.
 */
export const CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS =
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

/** Redis 분석 refresh-flag 키 — 단일 글로벌 캘린더(SP-A 인제스션 키와 분리). */
export const CALENDAR_ANALYSIS_REFRESH_FLAG_KEY = 'economy:calendar:analysis:refresh';
```

> `SECONDS_PER_MINUTE` is already imported in the SP-A constants file. If not, add it to the existing `@/shared/config/time` import.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/entities/economy/lib/economyCalendarConstants.ts
git commit -m "feat(economy): add calendar-analysis constants (SP-D)"
```

---

## Task 4: Repository — analysis read/write methods

**Files:**
- Modify: `src/entities/economy/api/economicCalendarRepository.ts` (the SP-A repo)
- Test: `src/entities/economy/api/__tests__/economicCalendarRepository.analysis.test.ts`

Add three things to the SP-A `DrizzleEconomicCalendarRepository`:
1. `attachEventAnalysis(id, analysis)` — write-once `UPDATE ... WHERE id = ? AND analyzed_at IS NULL` (mirrors `attachAnalysis`); sets `analyzedAt = now()`.
2. `listUnanalyzedAnnounced(impacts)` — `SELECT id + analyzer inputs WHERE impact IN (...) AND actual IS NOT NULL AND analyzed_at IS NULL`.
3. Extend `listInRange`'s select to also return `sentiment`/`summaryKo`/`interpretationKo`/`analyzedAt`, and map them onto the returned events (coerced via `toEventSentiment`) so the display layer gets them through SP-A's reader unchanged.

- [ ] **Step 1: Write the failing test (new file)**

```typescript
vi.mock('server-only', () => ({}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DrizzleEconomicCalendarRepository } from '@/entities/economy/api/economicCalendarRepository';

/** Chainable update/select stub returning the rows we hand it. */
function makeDb(selectRows: unknown[]) {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    const selectWhere = vi.fn(async () => selectRows);
    const from = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from }));

    return {
        db: { update, select } as never,
        spies: { update, set, where, select, from, selectWhere },
    };
}

describe('DrizzleEconomicCalendarRepository.attachEventAnalysis', () => {
    beforeEach(() => vi.clearAllMocks());

    it('updates the analysis columns guarded by analyzed_at IS NULL', async () => {
        const { db, spies } = makeDb([]);
        const repo = new DrizzleEconomicCalendarRepository(db);
        await repo.attachEventAnalysis('abc', {
            sentiment: 'bullish',
            summaryKo: '요약',
            interpretationKo: '해석',
        });
        expect(spies.update).toHaveBeenCalledOnce();
        const setArg = spies.set.mock.calls[0][0] as Record<string, unknown>;
        expect(setArg.sentiment).toBe('bullish');
        expect(setArg.summaryKo).toBe('요약');
        expect(setArg.interpretationKo).toBe('해석');
        expect(setArg.analyzedAt).toBeInstanceOf(Date);
        expect(spies.where).toHaveBeenCalledOnce();
    });
});

describe('DrizzleEconomicCalendarRepository.listUnanalyzedAnnounced', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps rows to analyzer inputs (id + event fields)', async () => {
        const { db } = makeDb([
            {
                id: 'id1',
                dateEt: '2026-06-13 08:30:00',
                event: 'Core CPI MoM (May)',
                impact: 'High',
                actual: 0.4,
                estimate: 0.3,
                previous: 0.2,
                unit: '%',
            },
        ]);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const rows = await repo.listUnanalyzedAnnounced(['High', 'Medium']);
        expect(rows).toEqual([
            {
                id: 'id1',
                event: 'Core CPI MoM (May)',
                impact: 'High',
                actual: 0.4,
                estimate: 0.3,
                previous: 0.2,
                unit: '%',
            },
        ]);
    });
});

describe('DrizzleEconomicCalendarRepository.listInRange (analysis columns)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps AI columns onto events and coerces unknown sentiment to null', async () => {
        const { db } = makeDb([
            {
                dateEt: '2026-06-13 08:30:00',
                event: 'Core CPI MoM (May)',
                impact: 'High',
                actual: 0.4,
                estimate: 0.3,
                previous: 0.2,
                unit: '%',
                sentiment: 'bearish',
                summaryKo: '요약',
                interpretationKo: '해석',
                analyzedAt: new Date('2026-06-13T13:00:00Z'),
            },
            {
                dateEt: '2026-06-14 10:00:00',
                event: 'Mystery',
                impact: 'Low',
                actual: null,
                estimate: null,
                previous: null,
                unit: '',
                sentiment: 'bogus',
                summaryKo: null,
                interpretationKo: null,
                analyzedAt: null,
            },
        ]);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const events = await repo.listInRange('2026-06-01', '2026-06-30');
        expect(events[0].sentiment).toBe('bearish');
        expect(events[0].summaryKo).toBe('요약');
        expect(events[0].interpretationKo).toBe('해석');
        expect(events[1].sentiment).toBeNull(); // 'bogus' coerced
        expect(events[1].summaryKo).toBeNull();
    });
});
```

> The chainable stub here covers a single `.where()` terminal (no `.orderBy()`); the SP-A repo test already covers the `.orderBy()` chain. Since SP-D extends `listInRange`, this test asserts only the AI-column mapping — keep the SP-A repo test (with `orderBy`) green too (it does not assert AI columns, so its row-shape additions are backward-compatible). If the SP-A test's `makeDb` stub omits the new select keys, the extended `select()` still resolves them as `undefined`, mapping to `null` — verify the SP-A repo test still passes in Step 4.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/api/__tests__/economicCalendarRepository.analysis.test.ts`
Expected: FAIL — `attachEventAnalysis`/`listUnanalyzedAnnounced` are not functions (or `listInRange` does not map AI columns).

- [ ] **Step 3: Extend the SP-A repository**

Add these imports to the existing import block (top of `economicCalendarRepository.ts`):

```typescript
import { eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { EconomicEventAnalysis } from '@y0ngha/siglens-core';
import { toEventSentiment } from '../lib/economicEventAnalysisGuard';
import type { EconomicCalendarEventWithAnalysis } from '../model';
```

> SP-A's repo already imports `and, asc, gte, lte, sql`. Merge `eq, inArray, isNotNull, isNull` into that one `drizzle-orm` import line rather than adding a second import.

Add an analyzer-input shape near the existing `CalendarDbRow` interface:

```typescript
/** ensure가 core analyzeEconomicEvent에 넘기는 입력 + 행 식별 id. */
export interface UnanalyzedAnnouncedEvent {
    id: string;
    event: string;
    impact: CalendarImpact;
    /** actual IS NOT NULL로 필터되므로 number 보장. */
    actual: number;
    estimate: number | null;
    previous: number | null;
    unit: string;
}
```

Change the SP-A `listInRange` select + mapper to include the AI columns. Replace the SP-A `toEvent` mapper and the `listInRange` `.select({...})` block:

(a) extend the select projection inside `listInRange` to add the four AI columns:

```typescript
                    .select({
                        dateEt: economicCalendar.dateEt,
                        event: economicCalendar.event,
                        impact: economicCalendar.impact,
                        actual: economicCalendar.actual,
                        estimate: economicCalendar.estimate,
                        previous: economicCalendar.previous,
                        unit: economicCalendar.unit,
                        sentiment: economicCalendar.sentiment,
                        summaryKo: economicCalendar.summaryKo,
                        interpretationKo: economicCalendar.interpretationKo,
                        analyzedAt: economicCalendar.analyzedAt,
                    })
```

(b) widen `CalendarDbRow` and `toEvent` to carry the AI columns:

```typescript
interface CalendarDbRow {
    dateEt: string;
    event: string;
    impact: string;
    actual: number | null;
    estimate: number | null;
    previous: number | null;
    unit: string;
    sentiment: string | null;
    summaryKo: string | null;
    interpretationKo: string | null;
    analyzedAt: Date | null;
}

function toEvent(row: CalendarDbRow): EconomicCalendarEventWithAnalysis {
    return {
        date: row.dateEt,
        event: row.event,
        impact: toImpact(row.impact),
        actual: row.actual,
        estimate: row.estimate,
        previous: row.previous,
        unit: row.unit,
        sentiment: toEventSentiment(row.sentiment),
        summaryKo: row.summaryKo,
        interpretationKo: row.interpretationKo,
        analyzedAt: row.analyzedAt,
    };
}
```

> Change `listInRange`'s return type from `Promise<EconomicCalendarEvent[]>` to `Promise<EconomicCalendarEventWithAnalysis[]>`. Since `EconomicCalendarEventWithAnalysis extends EconomicCalendarEvent`, all SP-A consumers (`getCalendarFromDb`, the grid via `events` prop) remain type-compatible — the extra fields are additive. Update SP-A's `getCalendarFromDb` return type to `Promise<EconomicCalendarEventWithAnalysis[]>` (Task 8 wires the display; the type already flows through because the grid prop is widened in Task 7).

Add the two new methods to the class (after `listInRange`):

```typescript
    /**
     * 분석 결과를 write-once로 기록한다 — `analyzed_at IS NULL` 가드로 재분석/덮어쓰기를
     * 막는다(market-news `attachAnalysis` 미러). 동시 분석 경합에서 한 호출만 승리한다.
     */
    async attachEventAnalysis(
        id: string,
        analysis: EconomicEventAnalysis,
        analyzedAt: Date = new Date()
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .update(economicCalendar)
                    .set({
                        sentiment: analysis.sentiment,
                        summaryKo: analysis.summaryKo,
                        interpretationKo: analysis.interpretationKo,
                        analyzedAt,
                    })
                    .where(
                        and(
                            eq(economicCalendar.id, id),
                            isNull(economicCalendar.analyzedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
    }

    /**
     * 분석 대상 행을 읽는다: impact ∈ impacts AND actual IS NOT NULL AND analyzed_at IS NULL.
     * 발표된(actual 채워진) Medium+ 미분석 이벤트만 반환해 ensure가 core에 넘긴다.
     */
    async listUnanalyzedAnnounced(
        impacts: readonly CalendarImpact[]
    ): Promise<UnanalyzedAnnouncedEvent[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: economicCalendar.id,
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
                            inArray(economicCalendar.impact, [...impacts]),
                            isNotNull(economicCalendar.actual),
                            isNull(economicCalendar.analyzedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
        return rows
            .filter((r): r is typeof r & { actual: number } => r.actual !== null)
            .map(r => ({
                id: r.id,
                event: r.event,
                impact: toImpact(r.impact),
                actual: r.actual,
                estimate: r.estimate,
                previous: r.previous,
                unit: r.unit,
            }));
    }
```

> The `.filter(...actual !== null)` is redundant with the SQL guard but narrows `number | null → number` for the typed return (no `!` assertion — MISTAKES.md type-safety).

- [ ] **Step 4: Run test to verify it passes (both repo tests)**

Run: `npx vitest run src/entities/economy/api/__tests__/economicCalendarRepository.analysis.test.ts src/entities/economy/api/__tests__/economicCalendarRepository.test.ts`
Expected: PASS — new analysis tests green AND the SP-A repo test still green (AI-column additions are backward-compatible).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/entities/economy/api/economicCalendarRepository.ts src/entities/economy/api/__tests__/economicCalendarRepository.analysis.test.ts
git commit -m "feat(economy): repo analysis read/write + AI-column mapping (SP-D)"
```

---

## Task 5: Analysis refresh-flag helper

**Files:**
- Create: `src/entities/economy/api/calendarAnalysisRefreshFlag.ts`

Mirrors SP-A's `calendarRefreshFlag` but with the analysis key/TTL — kept as a non-action helper so the `'use server'` action file stays function-only.

- [ ] **Step 1: Write the helper**

```typescript
import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/economyCalendarConstants';

/** 최근 TTL 내 분석 pass 수행 여부 — Redis 실패 시 false(항상 스캔). SP-A 플래그 미러. */
export async function isAnalysisRecentlyRun(): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(CALENDAR_ANALYSIS_REFRESH_FLAG_KEY)) !== null;
    } catch (error) {
        console.error('[calendarAnalysisRefreshFlag] get failed', error);
        return false;
    }
}

/** "최근 분석함" 마킹 — Redis 실패 시 noop. */
export async function markAnalysisRun(): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(CALENDAR_ANALYSIS_REFRESH_FLAG_KEY, '1', {
            ex: CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[calendarAnalysisRefreshFlag] set failed', error);
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/entities/economy/api/calendarAnalysisRefreshFlag.ts
git commit -m "feat(economy): add calendar-analysis refresh flag (SP-D)"
```

---

## Task 6: `ensureEconomicEventsAnalyzedAction` + barrel

**Files:**
- Create: `src/entities/economy/actions/ensureEconomicEventsAnalyzedAction.ts`
- Modify: `src/entities/economy/actions.ts` (SP-A barrel)
- Test: `src/entities/economy/actions/__tests__/ensureEconomicEventsAnalyzedAction.test.ts`

Mirrors `ensureMarketNewsCardsAnalyzedAction`: refresh-flag guard (mark before async work so concurrent callers skip), select unanalyzed announced Medium+ via the repo, bounded-parallel `analyzeEconomicEvent → attachEventAnalysis` (the synchronous replacement for submit/poll), majority-failure logging, single `revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max')` when ≥1 row was persisted. Fire-and-forget, errors logged. E2E short-circuit (`isE2E()`) like market-news so prod-build prerender / E2E never hits the LLM.

- [ ] **Step 1: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));

const isAnalysisRecentlyRun = vi.fn();
const markAnalysisRun = vi.fn();
vi.mock('@/entities/economy/api/calendarAnalysisRefreshFlag', () => ({
    isAnalysisRecentlyRun,
    markAnalysisRun,
}));

const analyzeEconomicEvent = vi.fn();
vi.mock('@y0ngha/siglens-core', () => ({ analyzeEconomicEvent }));

const listUnanalyzedAnnounced = vi.fn();
const attachEventAnalysis = vi.fn();
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listUnanalyzedAnnounced = listUnanalyzedAnnounced;
        attachEventAnalysis = attachEventAnalysis;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

const isE2E = vi.fn(() => false);
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ensureEconomicEventsAnalyzedAction } from '@/entities/economy/actions/ensureEconomicEventsAnalyzedAction';
import { ECONOMY_CALENDAR_CACHE_TAG } from '@/entities/economy/lib/economyCalendarConstants';

const ROW = {
    id: 'id1',
    event: 'Core CPI MoM (May)',
    impact: 'High' as const,
    actual: 0.4,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
};
const ANALYSIS = {
    sentiment: 'bullish' as const,
    summaryKo: '요약',
    interpretationKo: '해석',
};

describe('ensureEconomicEventsAnalyzedAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        isAnalysisRecentlyRun.mockResolvedValue(false);
        markAnalysisRun.mockResolvedValue(undefined);
        listUnanalyzedAnnounced.mockResolvedValue([ROW]);
        analyzeEconomicEvent.mockResolvedValue(ANALYSIS);
        attachEventAnalysis.mockResolvedValue(undefined);
    });

    it('skips when recently run', async () => {
        isAnalysisRecentlyRun.mockResolvedValue(true);
        await ensureEconomicEventsAnalyzedAction();
        expect(listUnanalyzedAnnounced).not.toHaveBeenCalled();
        expect(analyzeEconomicEvent).not.toHaveBeenCalled();
    });

    it('short-circuits under E2E (no LLM calls)', async () => {
        isE2E.mockReturnValue(true);
        await ensureEconomicEventsAnalyzedAction();
        expect(analyzeEconomicEvent).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('analyzes Medium+ announced unanalyzed events and revalidates on change', async () => {
        await ensureEconomicEventsAnalyzedAction();
        expect(markAnalysisRun).toHaveBeenCalledOnce();
        expect(listUnanalyzedAnnounced).toHaveBeenCalledWith(['High', 'Medium']);
        expect(analyzeEconomicEvent).toHaveBeenCalledWith({
            event: 'Core CPI MoM (May)',
            impact: 'High',
            actual: 0.4,
            estimate: 0.3,
            previous: 0.2,
            unit: '%',
        });
        expect(attachEventAnalysis).toHaveBeenCalledWith('id1', ANALYSIS);
        expect(revalidateTag).toHaveBeenCalledWith(
            ECONOMY_CALENDAR_CACHE_TAG,
            'max'
        );
    });

    it('does not revalidate when there is nothing to analyze', async () => {
        listUnanalyzedAnnounced.mockResolvedValue([]);
        await ensureEconomicEventsAnalyzedAction();
        expect(analyzeEconomicEvent).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('swallows a core failure without throwing and skips persist for that event', async () => {
        analyzeEconomicEvent.mockRejectedValue(new Error('llm down'));
        await expect(
            ensureEconomicEventsAnalyzedAction()
        ).resolves.toBeUndefined();
        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/actions/__tests__/ensureEconomicEventsAnalyzedAction.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/actions/ensureEconomicEventsAnalyzedAction'`.

- [ ] **Step 3: Write the action**

```typescript
'use server';

import { revalidateTag } from 'next/cache';
import { analyzeEconomicEvent } from '@y0ngha/siglens-core';

import { isE2E } from '@/shared/api/e2eEnv';
import { getDatabaseClient } from '@/shared/db/client';

import {
    DrizzleEconomicCalendarRepository,
    type UnanalyzedAnnouncedEvent,
} from '../api/economicCalendarRepository';
import {
    isAnalysisRecentlyRun,
    markAnalysisRun,
} from '../api/calendarAnalysisRefreshFlag';
import {
    CALENDAR_ANALYSIS_PARALLEL_LIMIT,
    CALENDAR_ANALYZED_IMPACTS,
    ECONOMY_CALENDAR_CACHE_TAG,
} from '../lib/economyCalendarConstants';

/** upsert/analyze 과반 실패 시 abort 임계 분모. */
const MAJORITY_DIVISOR = 2;

/**
 * `items`를 최대 `limit`개씩 동시 실행한다(입력 순서 보존). market-news
 * `withConcurrencyLimit` 미러 — p-limit 의존성 없이 O(수십) 규모에 충분.
 */
async function withConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    for (let i = 0; i < items.length; i += limit) {
        const chunk = items.slice(i, i + limit);
        results.push(...(await Promise.allSettled(chunk.map(fn))));
    }
    return results;
}

/**
 * 한 이벤트를 core로 분석하고 DB에 write-once 기록한다. 실패는 호출자(allSettled)가
 * reject로 수거 — 한 건이 실패해도 나머지는 정상 진행한다. 호출자가 actual !== null
 * AND analyzed_at IS NULL을 보장한다(`listUnanalyzedAnnounced`).
 */
async function analyzeAndPersistEvent(
    row: UnanalyzedAnnouncedEvent,
    repo: DrizzleEconomicCalendarRepository
): Promise<void> {
    const analysis = await analyzeEconomicEvent({
        event: row.event,
        impact: row.impact,
        actual: row.actual,
        estimate: row.estimate,
        previous: row.previous,
        unit: row.unit,
    });
    await repo.attachEventAnalysis(row.id, analysis);
}

/**
 * Server Action: 발표된(actual≠null) Medium+ 미분석 이벤트를 core analyzeEconomicEvent로
 * 분석해 `economic_calendar`에 채우고, ≥1행이 분석되면 `economy:calendar` 태그를 무효화한다.
 *
 * 두 트리거가 공유한다: (a) SEED — 백필 후 전량 1회(seed 스크립트), (b) ON-ACCESS —
 * /economy 마운트 시(SP-A 트리거 hook이 인제스션 직후 호출, 봇 포함). market-news
 * `ensureMarketNewsCardsAnalyzedAction` 미러 — refresh-flag 가드, 멱등성(analyzed_at IS NULL),
 * 동시성 제한, 과반 실패 로깅, fire-and-forget(throw 없음). 동기 core 호출이라 submit/poll 없음.
 *
 * E2E/prerender에서는 즉시 반환(LLM 비용 0) — market-news와 동일.
 * `waitUntil` 안에서 돌도록 설계 — 응답 스트림 비차단.
 */
export async function ensureEconomicEventsAnalyzedAction(): Promise<void> {
    try {
        if (isE2E()) return;
        if (await isAnalysisRecentlyRun()) return;
        // async 작업 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 스캔 생략.
        await markAnalysisRun();

        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);

        const pending = await repo.listUnanalyzedAnnounced(
            CALENDAR_ANALYZED_IMPACTS
        );
        if (pending.length === 0) return;

        const settled = await withConcurrencyLimit(
            pending,
            CALENDAR_ANALYSIS_PARALLEL_LIMIT,
            row => analyzeAndPersistEvent(row, repo)
        );
        const failures = settled.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error(
                `[ensureEconomicEventsAnalyzedAction] ${failures.length}/${pending.length} analyze failed`,
                failures.map(f => (f.status === 'rejected' ? f.reason : null))
            );
        }
        if (failures.length > pending.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureEconomicEventsAnalyzedAction] majority analyze failure (${failures.length}/${pending.length})`
            );
        }

        const persisted = settled.filter(r => r.status === 'fulfilled').length;
        if (persisted > 0) {
            // SP-A와 같은 'economy:calendar' 태그만 무효화 — 다음 렌더가 분석 채워진 행을 읽는다.
            revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max');
        }
    } catch (error) {
        console.error('[ensureEconomicEventsAnalyzedAction]', error);
    }
}
```

- [ ] **Step 4: Add to the SP-A action barrel**

In `src/entities/economy/actions.ts` (created by SP-A — re-export only, no `'use server'`), add:

```typescript
export { ensureEconomicEventsAnalyzedAction } from './actions/ensureEconomicEventsAnalyzedAction';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/actions/__tests__/ensureEconomicEventsAnalyzedAction.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/entities/economy/actions/ensureEconomicEventsAnalyzedAction.ts src/entities/economy/actions/__tests__/ensureEconomicEventsAnalyzedAction.test.ts src/entities/economy/actions.ts
git commit -m "feat(economy): add ensureEconomicEventsAnalyzedAction (SP-D)"
```

---

## Task 7: Grid display — sentiment badge + summary + interpretation

**Files:**
- Modify: `src/widgets/economy/sections/EconomicCalendarGrid.tsx` (SP-A file)
- Test: `src/widgets/economy/sections/__tests__/EconomicCalendarGrid.analysis.test.tsx`

`DayDetailPanel` renders, for events that carry analysis, a sentiment badge (using the AA tri-state tokens) + the Korean summary + the interpretation, below the existing estimate/previous/actual line. Events without analysis (unannounced, Low, or not-yet-analyzed) render exactly as before. The grid's `events` prop type widens to `EconomicCalendarEventWithAnalysis` (which extends `EconomicCalendarEvent`, so SP-A behavior is unchanged).

- [ ] **Step 1: Write the failing test (new file)**

```typescript
vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction: vi.fn().mockResolvedValue(undefined),
    ensureEconomicEventsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
}));

import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomicCalendarEventWithAnalysis } from '@/entities/economy/model';
import { EconomicCalendarGrid } from '@/widgets/economy/sections/EconomicCalendarGrid';

function ev(
    over: Partial<EconomicCalendarEventWithAnalysis> = {}
): EconomicCalendarEventWithAnalysis {
    return {
        date: '2026-06-20 08:30:00',
        event: 'Core CPI MoM (May)',
        impact: 'High',
        actual: 0.4,
        estimate: 0.3,
        previous: 0.2,
        unit: '%',
        sentiment: null,
        summaryKo: null,
        interpretationKo: null,
        analyzedAt: null,
        ...over,
    };
}

describe('EconomicCalendarGrid analysis display', () => {
    it('renders sentiment badge + summary + interpretation for an analyzed event', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({
                        sentiment: 'bullish',
                        summaryKo: 'CPI가 예상을 상회했어요.',
                        interpretationKo: '인플레 우려로 금리 인하 기대가 후퇴할 수 있어요.',
                        analyzedAt: new Date('2026-06-20T13:00:00Z'),
                    }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.getByText('긍정')).toBeInTheDocument();
        expect(
            screen.getByText('CPI가 예상을 상회했어요.')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '인플레 우려로 금리 인하 기대가 후퇴할 수 있어요.'
            )
        ).toBeInTheDocument();
    });

    it('renders no sentiment badge for a not-yet-analyzed announced event', () => {
        render(
            <EconomicCalendarGrid
                events={[ev({ sentiment: null, summaryKo: null })]}
                today="2026-06-20"
            />
        );
        expect(screen.queryByText('긍정')).not.toBeInTheDocument();
        expect(screen.queryByText('중립')).not.toBeInTheDocument();
        expect(screen.queryByText('부정')).not.toBeInTheDocument();
    });

    it('renders no analysis block for an unannounced event (actual null)', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({ actual: null, sentiment: null, summaryKo: null }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.queryByText('부정')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/widgets/economy/sections/__tests__/EconomicCalendarGrid.analysis.test.tsx`
Expected: FAIL — the badge/summary/interpretation are not rendered yet (and possibly a type error on `events` until Step 3).

- [ ] **Step 3: Implement the display**

In `src/widgets/economy/sections/EconomicCalendarGrid.tsx`:

(a) Add imports near the existing core-type import:

```typescript
import type { EconomicCalendarEventWithAnalysis } from '@/entities/economy/model';
import {
    SENTIMENT_LABEL,
    SENTIMENT_CLASS,
} from '@/widgets/market-news/utils/sentimentConstants';
```

> `SENTIMENT_LABEL`/`SENTIMENT_CLASS` are `Record<NewsSentiment, …>` and already encode the AA tri-state tokens (`text-ui-success-text`/`text-ui-danger-text`/secondary neutral). Reusing them keeps the badge consistent with market-news and satisfies the spec's "AA 토큰" requirement without duplicating a color map. This is a `widgets → widgets` cross-import (allowed per `widgets/CLAUDE.md`); both are leaf util modules (no server-only deps).

(b) Widen `KstEvent.original` and the props to the analysis view type. Change the `KstEvent` interface field and `groupEventsByKstDay` signature + `EconomicCalendarGridProps.events` from `EconomicCalendarEvent` to `EconomicCalendarEventWithAnalysis`:

```typescript
interface KstEvent {
    iso: string;
    kstTimeLabel: string;
    original: EconomicCalendarEventWithAnalysis;
}
```

```typescript
function groupEventsByKstDay(
    events: readonly EconomicCalendarEventWithAnalysis[]
): DayGroup[] {
```

```typescript
interface EconomicCalendarGridProps {
    events: readonly EconomicCalendarEventWithAnalysis[];
    /** SP-A: 기본 선택 기준일 KST 'YYYY-MM-DD'. */
    today?: string;
}
```

> `EconomicCalendarEvent` is still imported for `CalendarImpact`/label maps; keep that import. `EconomicCalendarEventWithAnalysis extends EconomicCalendarEvent`, so all existing field reads (`ev.original.event`, `.estimate`, `.impact`, …) still typecheck.

(c) Add an analysis block at the end of each event `<li>` in `DayDetailPanel`, after the closing `</div>` of the flex row (still inside the `<li>`). Insert before the `</li>`:

```tsx
                        {ev.original.sentiment !== null &&
                            ev.original.summaryKo !== null && (
                                <div className="border-secondary-700/60 mt-2 space-y-1 border-t pt-2">
                                    <span
                                        className={cn(
                                            'inline-block rounded px-2 py-0.5 text-xs font-medium',
                                            SENTIMENT_CLASS[ev.original.sentiment]
                                        )}
                                    >
                                        {SENTIMENT_LABEL[ev.original.sentiment]}
                                    </span>
                                    <p className="text-secondary-200 text-sm">
                                        {ev.original.summaryKo}
                                    </p>
                                    {ev.original.interpretationKo !== null && (
                                        <p className="text-secondary-400 text-xs leading-relaxed">
                                            {ev.original.interpretationKo}
                                        </p>
                                    )}
                                </div>
                            )}
```

> Guard on both `sentiment !== null` AND `summaryKo !== null` so a partially-written row (should not happen — `attachEventAnalysis` writes all three atomically) never renders a lone badge. `interpretationKo` is guarded independently for defense in depth.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/widgets/economy/sections/__tests__/EconomicCalendarGrid.analysis.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full grid suite (no SP-A regression)**

Run: `npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx src/widgets/economy/sections/__tests__/EconomicCalendarGrid.analysis.test.tsx`
Expected: PASS — SP-A grid tests (default selection, empty state, SSR panels) stay green; the prop-type widening is source-compatible (SP-A tests pass plain `EconomicCalendarEvent` literals, which now need the four analysis fields → **update the SP-A test's event factory** to include `sentiment: null, summaryKo: null, interpretationKo: null, analyzedAt: null`, OR make those four fields optional on the props type). Choose the optional-field approach to avoid editing SP-A tests: see Step 6.

- [ ] **Step 6: Make analysis fields optional on the prop boundary (avoid SP-A test churn)**

To keep SP-A's `<EconomicCalendarGrid events={[plainEvent]} />` tests compiling without edits, accept the SP-A event shape at the prop boundary by making the four analysis fields optional there. Change `EconomicCalendarEventWithAnalysis` consumption in the grid to a prop-local type:

```typescript
/**
 * 그리드 입력 — SP-A `EconomicCalendarEvent` + (선택) SP-D 분석 필드. 분석 필드를
 * optional로 둬 SP-A 호출부(분석 없는 이벤트 리터럴)도 그대로 컴파일된다. DB reader
 * (`getCalendarFromDb`)는 항상 네 필드를 채워 넘기므로 런타임엔 항상 존재(또는 null).
 */
type CalendarGridEvent = EconomicCalendarEvent &
    Partial<
        Pick<
            EconomicCalendarEventWithAnalysis,
            'sentiment' | 'summaryKo' | 'interpretationKo' | 'analyzedAt'
        >
    >;
```

Use `CalendarGridEvent` in `KstEvent.original`, `groupEventsByKstDay`, and `EconomicCalendarGridProps.events`. The display guard `ev.original.sentiment !== null && ev.original.summaryKo !== null` already handles `undefined` correctly (`undefined !== null` is `true`, but then `SENTIMENT_CLASS[undefined]` would be unsafe — so tighten the guard to truthy):

Change the guard to:

```tsx
                        {ev.original.sentiment != null &&
                            ev.original.summaryKo != null && (
```

(`!= null` excludes both `null` and `undefined`, narrowing `sentiment` to `NewsSentiment` for the `SENTIMENT_CLASS` index.)

Re-run Step 4 + Step 5 commands — both green, SP-A tests untouched.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/sections/__tests__/EconomicCalendarGrid.analysis.test.tsx
git commit -m "feat(economy): display event AI sentiment/summary/interpretation (SP-D)"
```

---

## Task 8: Wire the on-access analysis trigger into the SP-A hook

**Files:**
- Modify: `src/widgets/economy/hooks/useEconomicCalendarTrigger.ts` (SP-A hook)
- Modify: `src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx` (SP-A test)

The SP-A hook already fires `ensureEconomicCalendarAction()` once on mount. SP-D adds a second fire of `ensureEconomicEventsAnalyzedAction()` on the same mount (sequenced after ingest so freshly-upserted announced rows are analyzed in the same visit; if ingest is slow the analysis still runs against whatever announced rows exist — eventual via the next mount). Bots included (spec: "봇 포함").

- [ ] **Step 1: Update the SP-A hook test**

In `src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx`, change the mock to include both actions and add an assertion:

```typescript
const ensureEconomicCalendarAction = vi.fn();
const ensureEconomicEventsAnalyzedAction = vi.fn();
vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction,
    ensureEconomicEventsAnalyzedAction,
}));
```

In the existing `beforeEach`, also reset the new mock:

```typescript
        ensureEconomicEventsAnalyzedAction.mockResolvedValue(undefined);
```

Add a test:

```typescript
    it('also fires the analysis ensure once on mount', () => {
        render(<Probe />);
        expect(ensureEconomicEventsAnalyzedAction).toHaveBeenCalledOnce();
    });
```

> The SP-A "fires once on mount" + "does not re-fire on re-render" + "swallows rejection" tests stay; the ingest assertions are unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx`
Expected: FAIL — `ensureEconomicEventsAnalyzedAction` is never called by the current hook.

- [ ] **Step 3: Update the hook**

In `src/widgets/economy/hooks/useEconomicCalendarTrigger.ts`, import both actions and fire both inside the existing once-guard effect:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import {
    ensureEconomicCalendarAction,
    ensureEconomicEventsAnalyzedAction,
} from '@/entities/economy/actions';

/**
 * Fire-and-forget on mount (봇 포함, 1회):
 * 1. `ensureEconomicCalendarAction` — ±1mo FMP 인제스션(SP-A).
 * 2. `ensureEconomicEventsAnalyzedAction` — 발표된 Medium+ 미분석 이벤트 AI 분석(SP-D).
 *
 * 인제스션 직후 분석을 트리거해 같은 방문에서 새로 채워진 actual을 분석한다. 둘 다 자체
 * refresh-flag로 쓰로틀되고 에러는 로깅만 — 실패해도 다음 접속/플래그 만료 시 재시도된다.
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
        void ensureEconomicEventsAnalyzedAction().catch((e: unknown) => {
            console.error(
                '[useEconomicCalendarTrigger] ensureEconomicEventsAnalyzedAction failed:',
                e
            );
        });
    }, []);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx`
Expected: PASS (SP-A tests + the new analysis-fire test).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/economy/hooks/useEconomicCalendarTrigger.ts src/widgets/economy/hooks/__tests__/useEconomicCalendarTrigger.test.tsx
git commit -m "feat(economy): fire analysis ensure on calendar mount (SP-D)"
```

---

## Task 9: One-time SEED script

**Files:**
- Create: `scripts/seedEconomicEventAnalysis.ts`
- Modify: `package.json` (add `db:seed:calendar-analysis`)

A one-time `tsx` SEED the user runs after the SP-A backfill: it analyzes **all** current Medium+ announced unanalyzed rows once (the spec's trigger mode (a)). It uses `postgres-js` + Drizzle directly (like SP-A's backfill script and `seed-korean-tickers.ts`) so it runs standalone against `DIRECT_DATABASE_URL`, calls the real core `analyzeEconomicEvent`, and writes via the same write-once update. Bounded sequential-chunk parallelism keeps the LLM load sane.

There is no automated test for `run()` (network + DB + LLM glue). Its logic-bearing pieces (repo write-once, the analyzer-input mapping) are unit-tested in Tasks 4/6. The script reuses the repo's `attachEventAnalysis`/`listUnanalyzedAnnounced` rather than re-implementing SQL.

- [ ] **Step 1: Write the script**

```typescript
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { analyzeEconomicEvent } from '@y0ngha/siglens-core';

import { DrizzleEconomicCalendarRepository } from '../src/entities/economy/api/economicCalendarRepository';
import { CALENDAR_ANALYZED_IMPACTS } from '../src/entities/economy/lib/economyCalendarConstants';

const databaseUrl =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}

/** 동시 분석 상한 — seed는 일괄이라 작게 잡아 LLM 큐 압박을 피한다. */
const SEED_PARALLEL_LIMIT = 4;

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client);
    const repo = new DrizzleEconomicCalendarRepository(
        db as unknown as Parameters<
            typeof DrizzleEconomicCalendarRepository.prototype.constructor
        >[0] extends never
            ? never
            : never
    );
    // NOTE: DrizzleEconomicCalendarRepository takes a SiglensDatabase; the
    // postgres-js drizzle instance is structurally compatible for the queries
    // used here (insert/select/update). Cast through the constructor param type.

    const pending = await repo.listUnanalyzedAnnounced(CALENDAR_ANALYZED_IMPACTS);
    console.log(`Seeding analysis for ${pending.length} Medium+ announced event(s)`);

    let analyzed = 0;
    let failed = 0;
    for (let i = 0; i < pending.length; i += SEED_PARALLEL_LIMIT) {
        const chunk = pending.slice(i, i + SEED_PARALLEL_LIMIT);
        const results = await Promise.allSettled(
            chunk.map(async row => {
                const analysis = await analyzeEconomicEvent({
                    event: row.event,
                    impact: row.impact,
                    actual: row.actual,
                    estimate: row.estimate,
                    previous: row.previous,
                    unit: row.unit,
                });
                await repo.attachEventAnalysis(row.id, analysis);
            })
        );
        for (const r of results) {
            if (r.status === 'fulfilled') analyzed += 1;
            else {
                failed += 1;
                console.error('  analyze failed:', r.reason);
            }
        }
        console.log(`  ${Math.min(i + SEED_PARALLEL_LIMIT, pending.length)}/${pending.length}`);
    }

    console.log(`Done — analyzed ${analyzed}, failed ${failed}`);
    await client.end();
}

run().catch(error => {
    console.error('[seedEconomicEventAnalysis] failed:', error);
    process.exitCode = 1;
});
```

> **Simplify the repo-construction cast before finalizing:** the awkward conditional type above is a placeholder to flag that `drizzle(postgres(...))` is a `PostgresJsDatabase`, not the app's Neon `SiglensDatabase`. SP-A's `backfillEconomicCalendar.ts` does NOT reuse the repo — it inlines the upsert against the `postgres-js` db. **Mirror that here:** do the same and inline the write-once update + select using the `postgres-js` `db`, OR (cleaner) construct the repo with `new DrizzleEconomicCalendarRepository(db as unknown as SiglensDatabase)` importing `type { SiglensDatabase } from '../src/shared/db/types'`. Use the simple `as unknown as SiglensDatabase` cast (the repo only uses `insert/select/update`, present on both adapters) and delete the conditional-type block. Final repo line:
>
> ```typescript
> import type { SiglensDatabase } from '../src/shared/db/types';
> // ...
> const repo = new DrizzleEconomicCalendarRepository(
>     db as unknown as SiglensDatabase
> );
> ```

- [ ] **Step 2: Add the package.json script**

In `package.json` `scripts`, next to SP-A's `db:backfill:calendar`:

```json
"db:seed:calendar-analysis": "dotenv -e .env.local -- node_modules/.bin/tsx scripts/seedEconomicEventAnalysis.ts",
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: PASS. (The `as unknown as SiglensDatabase` cast is the single intentional structural bridge between the script's `postgres-js` db and the app's Neon db type — documented inline.)

- [ ] **Step 4: Commit**

```bash
git add scripts/seedEconomicEventAnalysis.ts package.json
git commit -m "feat(economy): add one-time event-analysis seed script (SP-D)"
```

> Note: running `yarn db:seed:calendar-analysis` against the live DB (requires `DIRECT_DATABASE_URL` + the core LLM env) is an operational step the user performs once after the SP-A backfill. The on-access trigger keeps subsequent newly-announced events analyzed.

---

## Task 10: Full-suite green + final gates

**Files:** none (verification only)

- [ ] **Step 1: Run the economy + market-news suites**

Run: `npx vitest run src/entities/economy src/widgets/economy src/entities/market-news`
Expected: PASS (SP-A + SP-D economy tests, no market-news regression from the shared sentiment-constants reuse).

- [ ] **Step 2: Full unit suite**

Run: `yarn test`
Expected: PASS (no repo-wide regressions).

- [ ] **Step 3: Lint + format + typecheck gates**

Run: `npx tsc --noEmit && yarn lint && yarn format`
Expected: tsc PASS, lint PASS, format applies no pending changes (or only this plan's files, already clean).

- [ ] **Step 4: Build — ISR/cold-gen safety unchanged**

Run: `yarn build > /tmp/economy-spd-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`. SP-D adds no new page render path; `/economy` must still build without `DYNAMIC_SERVER_USAGE` (the AI columns flow through SP-A's `unstable_cache`-wrapped `getCalendarFromDb`; the action is client-triggered, not in the cold-gen path). Inspect: `grep -iE "economy|DYNAMIC_SERVER_USAGE|error" /tmp/economy-spd-build.log` — no `DYNAMIC_SERVER_USAGE` attributed to `/economy`.

- [ ] **Step 5: Commit any formatting fixups (if produced)**

```bash
git add -A
git commit -m "chore(economy): formatting + lint fixups (SP-D)"
```

(Skip if nothing changed.)

---

## Self-Review

**Spec coverage (SP-D section + shared data model AI columns note):**

| Spec requirement | Task |
|---|---|
| **CORE** `analyzeEconomicEvent(input): EconomicEventAnalysis`, input {event, impact, actual, estimate, previous, unit} (+ optional recent trend), output {sentiment, summaryKo, interpretationKo}; PROMPT_TEMPLATE_VERSION in core; user-released; siglens mocks it | Cross-repo note (exact contract) + Task 0 (gate/version bump) + every siglens task mocks `@y0ngha/siglens-core` |
| Migration adding `sentiment`/`summaryKo`/`interpretationKo`/`analyzedAt` to `economic_calendar` (deferred from SP-A) | Task 1 (additive nullable `0019` migration) |
| `ensureEconomicEventsAnalyzedAction` — `impact IN ('High','Medium') AND actual IS NOT NULL AND analyzedAt IS NULL` → core → write sentiment/summaryKo/interpretationKo/analyzedAt | Task 4 (`listUnanalyzedAnnounced` + `attachEventAnalysis`) + Task 6 (action) |
| Trigger mode (a) SEED — batch over all current Medium+ announced once | Task 9 (seed script) |
| Trigger mode (b) ON-ACCESS — fired on /economy mount (mirror market-news; bots included) for not-yet-analyzed announced | Task 8 (SP-A hook fires analysis ensure on mount, bots included) |
| Cooldown / idempotency | Task 5 (analysis refresh-flag, separate key) + Task 4 (`analyzed_at IS NULL` write-once guard) + Task 6 (mark-before-async dedup) |
| Display in DayDetailPanel — sentiment badge (ui-*-text AA tokens), summary, interpretation; unchanged for unannounced/Low/not-yet-analyzed | Task 7 (badge via reused AA `SENTIMENT_CLASS` + summary + interpretation, null-guarded) |
| Expensive/async → submit/poll, else market-news-style ensure; justify | Cross-repo note §"Sync vs async" (synchronous `analyzeEconomicEvent`, justified by spec contract + low volume + small output) + Task 6 (ensure with direct call, swap-contained) |
| Reuse SP-A `economic_calendar` repo (don't duplicate) | Task 4 extends the SP-A `DrizzleEconomicCalendarRepository`; Tasks 6/9 consume it; no SP-A artifact re-declared |
| Same on-access condition as News | Task 6 mirrors `ensureMarketNewsCardsAnalyzedAction` (refresh-flag, allSettled, majority guard, single revalidateTag, `isE2E` short-circuit) |

**Cross-repo ordering (explicit):** SP-D depends on **(1) SP-A merged** (table, repo, `getCalendarFromDb`, `ensureEconomicCalendarAction`, the trigger hook, the `actions.ts` barrel, the constants file — all extended here) **and (2) the core release** of `analyzeEconomicEvent` (Task 0). Within SP-D: Task 0 (core gate) → Task 1 (migration) → Task 2 (guard/type) → Task 3 (constants) → Task 4 (repo) → Task 5 (flag) → Task 6 (action) → Task 7 (display) → Task 8 (trigger wiring) → Task 9 (seed) → Task 10 (gates). Tasks 1–5 are independent of each other after Task 0; Task 6 needs 3+4+5; Task 7 needs 2; Task 8 needs 6; Task 9 needs 4.

**Placeholder scan:** No TBD/TODO/"similar to Task N" left as code. The only inline "decide-at-execution" note is Task 9 Step 1's repo-construction cast — it gives the **exact final code** (`as unknown as SiglensDatabase` + the import) and instructs deleting the placeholder conditional-type; not a gap. Every other code step is complete; every command is exact with expected output.

**Type-consistency check:**
- `EconomicEventAnalysisInput` / `EconomicEventAnalysis` / `analyzeEconomicEvent` — contract defined once (Cross-repo note); mocked identically in Tasks 6/7 tests; consumed in Task 6 action + Task 9 seed with the same 6-field input object (`event/impact/actual/estimate/previous/unit`). ✓
- `DrizzleEconomicCalendarRepository` gains `attachEventAnalysis(id, analysis)` + `listUnanalyzedAnnounced(impacts)` and widens `listInRange` → `EconomicCalendarEventWithAnalysis[]` — defined Task 4, consumed Tasks 6/9, mocked identically in Task 6 test. ✓
- `UnanalyzedAnnouncedEvent` (id + 6 analyzer fields) — exported Task 4, imported Task 6. ✓
- `EconomicCalendarEventWithAnalysis extends EconomicCalendarEvent` — defined Task 2 (`model.ts`), consumed Task 4 (repo return) + Task 7 (grid prop, via optional `CalendarGridEvent` bridge). Backward-compatible with SP-A consumers. ✓
- `toEventSentiment` (Task 2) — read-boundary coercion used in Task 4 mapper + Task 7 display tri-state. ✓
- Constants `CALENDAR_ANALYSIS_PARALLEL_LIMIT`/`CALENDAR_ANALYZED_IMPACTS`/analysis-flag key+TTL — defined Task 3, consumed Tasks 5/6/9. ✓
- `ECONOMY_CALENDAR_CACHE_TAG` — SP-A constant reused by Task 6 `revalidateTag` (same tag → SP-A reader refresh). ✓
- `SENTIMENT_LABEL`/`SENTIMENT_CLASS` (`Record<NewsSentiment, …>`) — real existing exports (`src/widgets/market-news/utils/sentimentConstants.ts`, verified), reused in Task 7. ✓
- `isE2E` (`@/shared/api/e2eEnv`) — real existing export used by `ensureMarketNewsCardsAnalyzedAction`, reused in Task 6. ✓

**Gates honored:** additive nullable migration (no backfill); `'use server'` file function-only (guards/constants/flag in separate files); barrel-excluded `api/` modules deep-imported; SP-A `actions.ts` barrel gets the new re-export (no `'use server'` on barrel); ISR cold-gen path untouched (Task 10 build check); reused-not-duplicated SP-A repo/table/hook/constants; no `eslint-disable`; multi-line JSDoc allowed per Documentation Policy; sentiment validated at read boundary; commit-per-task, no push.
