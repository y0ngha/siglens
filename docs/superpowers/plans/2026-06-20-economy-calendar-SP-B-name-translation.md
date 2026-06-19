# Economy Calendar SP-B — Indicator-Name Korean Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render English FMP economic-indicator names (e.g. `"Core PCE Price Index YoY (May)"`) in Korean across the `/economy` calendar grid, backed by a code const dictionary (source-of-truth, `dict`) with a DB cache (`ai`) populated on-miss by a core AI translator. Mapped names render Korean immediately; unmapped names render English and trigger a background AI translation that is cached for the next render (mirroring the news "translate-then-cache" flow).

**Architecture:** A pure i18n module `entities/economy/lib/indicatorNameKo.ts` owns `INDICATOR_NAME_KO` (a `Record<string, string>` base-name → Korean map), a `normalizeIndicatorName(raw)` splitter (strips the trailing `(May)`/`(Q1)`/`(Jun/20)` period parenthetical, returning `{ base, period }`), and a period-token Korean-izer (`YoY`→`전년比`, `MoM`→`전월比`, `QoQ`→`전분기比`, month/quarter names). A new `economic_indicator_translations` Drizzle table (mirroring `assetTranslations`) caches AI translations keyed by `normalizedName`. A server-only `DrizzleIndicatorTranslationRepository` reads/upserts that table. A `'use server'` `ensureIndicatorTranslatedAction` calls **core** `translateIndicatorName(normalizedName)` and upserts the result with `source: 'ai'`. The display path splits into two parts: a **pure synchronous** `indicatorLabelKoFromMaps(raw, dbMap)` used inside the client grid (dict + already-loaded DB map → Korean, else English), and a **server-side** `resolveIndicatorLabels(events)` reader that, per request, looks up the DB cache for every distinct normalized base name, returns the resolved label map to the grid, and fire-and-forget triggers `ensureIndicatorTranslatedAction` for the misses. The grid applies the resolved labels at the cell-preview and detail-panel display sites; English is the deterministic fallback.

**Tech Stack:** TypeScript, Drizzle ORM (Neon serverless), `drizzle-kit` migrations, Next.js 16 (RSC + `unstable_cache` + `revalidateTag`), vitest, `@y0ngha/siglens-core` (`translateIndicatorName` — **new core export, see CROSS-REPO note**).

---

## ⚠️ CROSS-REPO DEPENDENCY (separate repo, user publishes)

The AI translation of unmapped indicator names is **analysis-domain logic** and therefore belongs in `@y0ngha/siglens-core` per the spec table ("미매핑 지표명 **AI 번역** → siglens-core") and the CLAUDE.md cross-repo scope guard. **Do NOT implement the core translator in this repo.** The siglens side consumes a new core export whose exact contract is:

```typescript
// @y0ngha/siglens-core  (NEW export — implemented & published by the user in the core repo)
//
// Translates a single normalized (suffix-stripped) economic-indicator base name
// to Korean. Pure prompt + normalization + validation live in core; siglens only
// calls it and caches the result. Returns the Korean string, or throws on failure
// (the siglens caller catches and leaves the row uncached so a later render retries).
export function translateIndicatorName(normalizedName: string): Promise<string>;
```

**Until the core export exists, every siglens task in this plan mocks `translateIndicatorName`** via `vi.mock('@y0ngha/siglens-core', ...)`. The single real import site is the server action (Task 7); a `// CORE DEPENDENCY` comment marks it. Sequencing for the human operator: (1) implement + `npm version` + `git push --tags` the core change in the core repo; (2) bump the `@y0ngha/siglens-core` pin in siglens `package.json` and `yarn install`; (3) the import in Task 7 resolves against the real export. The siglens code, tests, and gates in this plan are fully implementable and green **before** core lands, because the action's only real dependency is mocked in its test.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/entities/economy/lib/indicatorNameKo.ts` | Create | `INDICATOR_NAME_KO` const map (seed of confirmed entries), `normalizeIndicatorName(raw): NormalizedIndicatorName`, `koreanizePeriodToken(token): string`, `indicatorLabelKoFromMaps(raw, dbMap): string` pure display helper. |
| `src/entities/economy/lib/__tests__/indicatorNameKo.test.ts` | Create | Tests: normalize splitting, period Korean-ization, dict hit, DB-map hit, English fallback. |
| `src/shared/db/schema.ts` | Modify | Add `economicIndicatorTranslations` `pgTable` (normalizedName PK, koreanName, source, updatedAt). |
| `src/shared/db/types.ts` | Modify | Add `IndicatorTranslationRecord` + `IndicatorTranslationRepository` interfaces. |
| `src/shared/db/__tests__/schema.test.ts` | Modify | Add a presence assertion for the new table (matches existing schema-test style). |
| `drizzle/0019_*.sql` + `drizzle/meta/*` | Create (generated) | Migration creating `economic_indicator_translations` (output of `yarn db:generate`). |
| `src/entities/economy/api/indicatorTranslationRepository.ts` | Create | `DrizzleIndicatorTranslationRepository`: `findByNames(names)` (batch) + `upsert(record)`. |
| `src/entities/economy/api/__tests__/indicatorTranslationRepository.test.ts` | Create | Repository query-shape tests against a mocked db. |
| `src/entities/economy/lib/indicatorTranslationConstants.ts` | Create | Cache-tag + refresh-flag-key + TTL constants shared by reader/action. |
| `src/entities/economy/api/indicatorTranslationFlag.ts` | Create | Per-name Redis refresh-flag (`isIndicatorTranslationPending` / `markIndicatorTranslationPending`) to dedupe concurrent AI submissions. |
| `src/entities/economy/api/__tests__/indicatorTranslationFlag.test.ts` | Create | Redis-null + get/set TTL tests. |
| `src/entities/economy/actions/ensureIndicatorTranslatedAction.ts` | Create | `'use server'` — call core `translateIndicatorName`, upsert `source:'ai'`, `revalidateTag`. **Only real core import site.** |
| `src/entities/economy/actions/__tests__/ensureIndicatorTranslatedAction.test.ts` | Create | Tests: skip when cached/pending, translate→upsert→revalidate, graceful core failure (no upsert). |
| `src/entities/economy/actions.ts` | Modify (or create) | Barrel re-export of `ensureIndicatorTranslatedAction` (no `'use server'`). |
| `src/entities/economy/api/resolveIndicatorLabels.ts` | Create | Server reader: distinct base names → DB-cache lookup → label map; fire-and-forget triggers AI for misses; `unstable_cache`-wrapped DB read (ISR-safe). |
| `src/entities/economy/api/__tests__/resolveIndicatorLabels.test.ts` | Create | Tests: dict short-circuit (no DB call), DB hit, miss triggers ensure, label-map shape, ISR safety. |
| `src/widgets/economy/sections/EconomicCalendarGrid.tsx` | Modify | Accept `labels?: Record<string, string>` (raw event name → display label); apply at cell preview + detail panel. |
| `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx` | Modify | Add Korean-label-applied + English-fallback display tests. |
| `src/app/economy/page.tsx` | Modify | Compute `labels = await resolveIndicatorLabels(calendarEvents)`; pass `labels` to `<EconomicCalendar>`. |
| `docs/superpowers/seeding/indicator-name-ko-seeding.md` | Create | Documented one-time dictionary-seeding procedure (SP-A name-dump → core AI draft → curate → fill `INDICATOR_NAME_KO`). |

**FSD compliance:** pure i18n + display helper live in `entities/economy/lib/` (no React, no server-only); DB repository + reader + refresh-flag live in `entities/economy/api/` (server-only, barrel-excluded); the server action lives in `entities/economy/actions/`; the grid (client) consumes only the pre-resolved `labels` map (no server import); the page composes the reader. The grid's `indicatorLabelKoFromMaps` import is a pure `lib/` function (client-safe). `economic_indicator_translations` schema lives in `shared/db` alongside `assetTranslations`.

---

## Conventions to honor (gates)

- **Tests colocated** in `__tests__/` next to the unit. Run a single file with `npx vitest run <path>`.
- **`tsc`, ESLint, Prettier must pass.** No `eslint-disable` (MISTAKES.md #13). Run `yarn lint` and `yarn format` before each commit if unsure.
- **Hook order** (MISTAKES.md "Predictability"): no derived const between hooks in the grid; the new `labels` prop is read in render/`useMemo`, not via a conditional hook.
- **Named return types** on every exported function (MISTAKES.md "TypeScript") — e.g. `normalizeIndicatorName(raw): NormalizedIndicatorName`, not an inferred inline object.
- **No WHAT comments** (MISTAKES.md "Documentation") — comments explain WHY (caching strategy, cross-repo seam), not what the next line does.
- **Exact assertions** (MISTAKES.md "Tests") — `toBe`/`toEqual` with concrete values, not `toBeTruthy`/`expect.anything()`.
- **ISR 4-axis safety** (`src/app/CLAUDE.md`): the reader wraps its DB read in `unstable_cache`; no `cookies()`/`headers()`/`connection()`/`Date.now()` in the cold-gen render path. The page's `resolveIndicatorLabels` call is awaited in the RSC the same way `getCalendarFromDb` already is (SP-A).
- **`'use server'` files** export only async functions; constants/classes/types live in separate files (`entities/CLAUDE.md`).
- **Barrel exclusion:** `api/` server-only modules and `actions/*` stay out of `entities/economy/index.ts`; consumers deep-import. The pure `lib/indicatorNameKo.ts` MAY be barrel-exported, but the grid deep-imports it from `@/entities/economy/lib/indicatorNameKo` to avoid pulling server-only siblings (matching the existing economy barrel comment).
- **Commit per task** with the conventional-commit messages given. Do not push (git-agent's job).

---

## Task 1: Pure i18n module — normalize + period Korean-ization + dictionary seed

**Files:**
- Create: `src/entities/economy/lib/indicatorNameKo.ts`
- Test: `src/entities/economy/lib/__tests__/indicatorNameKo.test.ts`

This module is the heart of SP-B and is **pure** (no React, no server-only, no DB). It owns the source-of-truth dictionary seed, the splitter, the period Korean-izer, and a synchronous display helper that takes an already-loaded DB-cache map.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import {
    normalizeIndicatorName,
    koreanizePeriodToken,
    indicatorLabelKoFromMaps,
    INDICATOR_NAME_KO,
} from '@/entities/economy/lib/indicatorNameKo';

describe('normalizeIndicatorName', () => {
    it('splits a trailing month parenthetical into base + period', () => {
        expect(
            normalizeIndicatorName('Core PCE Price Index YoY (May)')
        ).toEqual({ base: 'Core PCE Price Index YoY', period: 'May' });
    });

    it('splits a trailing quarter parenthetical', () => {
        expect(normalizeIndicatorName('GDP Growth Rate QoQ (Q1)')).toEqual({
            base: 'GDP Growth Rate QoQ',
            period: 'Q1',
        });
    });

    it('splits a slash date-token parenthetical', () => {
        expect(
            normalizeIndicatorName('Fed Interest Rate Decision (Jun/20)')
        ).toEqual({ base: 'Fed Interest Rate Decision', period: 'Jun/20' });
    });

    it('returns an empty period when there is no parenthetical', () => {
        expect(normalizeIndicatorName('Initial Jobless Claims')).toEqual({
            base: 'Initial Jobless Claims',
            period: '',
        });
    });

    it('strips only the final parenthetical, preserving interior ones', () => {
        expect(normalizeIndicatorName('Index (ex Food) MoM (Apr)')).toEqual({
            base: 'Index (ex Food) MoM',
            period: 'Apr',
        });
    });

    it('trims surrounding whitespace from base', () => {
        expect(normalizeIndicatorName('  CPI YoY (Apr)  ')).toEqual({
            base: 'CPI YoY',
            period: 'Apr',
        });
    });
});

describe('koreanizePeriodToken', () => {
    it('translates change-direction tokens', () => {
        expect(koreanizePeriodToken('YoY')).toBe('전년比');
        expect(koreanizePeriodToken('MoM')).toBe('전월比');
        expect(koreanizePeriodToken('QoQ')).toBe('전분기比');
    });

    it('translates month abbreviations', () => {
        expect(koreanizePeriodToken('May')).toBe('5월');
        expect(koreanizePeriodToken('Jan')).toBe('1월');
        expect(koreanizePeriodToken('Dec')).toBe('12월');
    });

    it('translates quarter tokens', () => {
        expect(koreanizePeriodToken('Q1')).toBe('1분기');
        expect(koreanizePeriodToken('Q4')).toBe('4분기');
    });

    it('returns an unknown token unchanged', () => {
        expect(koreanizePeriodToken('Jun/20')).toBe('Jun/20');
        expect(koreanizePeriodToken('')).toBe('');
    });
});

describe('indicatorLabelKoFromMaps', () => {
    it('renders dict base + Korean period when the base is mapped', () => {
        expect(
            indicatorLabelKoFromMaps('Core PCE Price Index YoY (May)', {})
        ).toBe('근원 PCE 물가지수(전년比) (5월)');
    });

    it('renders a mapped base with no period parenthetical', () => {
        expect(indicatorLabelKoFromMaps('Nonfarm Payrolls', {})).toBe(
            '비농업 고용'
        );
    });

    it('falls back to the DB-cache map when dict misses', () => {
        expect(
            indicatorLabelKoFromMaps('Some Obscure Index YoY (May)', {
                'Some Obscure Index YoY': '어떤 모호한 지수(전년比)',
            })
        ).toBe('어떤 모호한 지수(전년比) (5월)');
    });

    it('falls back to the raw English name when both maps miss', () => {
        expect(
            indicatorLabelKoFromMaps('Totally Unknown Thing (Apr)', {})
        ).toBe('Totally Unknown Thing (Apr)');
    });

    it('seeds the dictionary with confirmed common indicators', () => {
        expect(INDICATOR_NAME_KO['Nonfarm Payrolls']).toBe('비농업 고용');
        expect(INDICATOR_NAME_KO['ADP Employment Change']).toBe(
            'ADP 고용 변화'
        );
        expect(INDICATOR_NAME_KO['10-Year Note Auction']).toBe(
            '10년물 국채 입찰'
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/lib/__tests__/indicatorNameKo.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/lib/indicatorNameKo'`.

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * 경제 지표명 한국어화 — 코드 const 사전(source-of-truth, `dict`)이 1차, DB 캐시(`ai`)가
 * 2차다. 이 모듈은 순수(React/server-only/DB 비의존)하므로 클라 그리드와 서버 reader가
 * 함께 import할 수 있다. DB 캐시 룩업과 AI 트리거는 서버 계층(api/, actions/)이 담당하고,
 * 여기서는 이미 로드된 DB 맵을 받아 동기 합성만 한다.
 *
 * 초기 사전은 FMP 샘플에서 가장 흔한 지표 일부만 확정해 시드한다. 전체 ~277개 큐레이션은
 * SP-A 백필 name-dump를 소비하는 별도 데이터 작업이다(docs/superpowers/seeding 참조).
 */

/** `INDICATOR_NAME_KO`/DB 캐시의 키 = 정규화된 base 지표명, 값 = 한국어. */
export const INDICATOR_NAME_KO: Record<string, string> = {
    // 물가
    'Core PCE Price Index YoY': '근원 PCE 물가지수(전년比)',
    'Core PCE Price Index MoM': '근원 PCE 물가지수(전월比)',
    'PCE Price Index YoY': 'PCE 물가지수(전년比)',
    'Inflation Rate YoY': '소비자물가 상승률(전년比)',
    'Core Inflation Rate YoY': '근원 소비자물가 상승률(전년比)',
    CPI: '소비자물가지수',
    'CPI YoY': '소비자물가지수(전년比)',
    'CPI MoM': '소비자물가지수(전월比)',
    'Core CPI YoY': '근원 소비자물가지수(전년比)',
    'Core CPI MoM': '근원 소비자물가지수(전월比)',
    'PPI MoM': '생산자물가지수(전월比)',
    'Core PPI MoM': '근원 생산자물가지수(전월比)',
    // 고용
    'Nonfarm Payrolls': '비농업 고용',
    'ADP Employment Change': 'ADP 고용 변화',
    'Initial Jobless Claims': '신규 실업수당 청구',
    'Continuing Jobless Claims': '연속 실업수당 청구',
    'Unemployment Rate': '실업률',
    'Average Hourly Earnings MoM': '시간당 평균 임금(전월比)',
    'JOLTs Job Openings': '구인 건수(JOLTs)',
    // 성장·심리
    'GDP Growth Rate QoQ': 'GDP 성장률(전분기比)',
    'Retail Sales MoM': '소매판매(전월比)',
    'ISM Manufacturing PMI': 'ISM 제조업 PMI',
    'ISM Services PMI': 'ISM 서비스업 PMI',
    'Michigan Consumer Sentiment': '미시간대 소비자심리지수',
    // 정책·국채
    'Fed Interest Rate Decision': '연준 기준금리 결정',
    '10-Year Note Auction': '10년물 국채 입찰',
    '30-Year Bond Auction': '30년물 국채 입찰',
    '2-Year Note Auction': '2년물 국채 입찰',
    '3-Month Bill Auction': '3개월물 국채 입찰',
};

/** 변화-방향 접미 토큰의 한국어 매핑. */
const PERIOD_DIRECTION_KO: Record<string, string> = {
    YoY: '전년比',
    MoM: '전월比',
    QoQ: '전분기比',
};

/** 영어 월 약어 → 1-indexed 월. */
const MONTH_INDEX: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
};

/** `normalizeIndicatorName` 반환 형태. */
export interface NormalizedIndicatorName {
    /** 접미 괄호를 제거한 base 지표명. */
    base: string;
    /** 마지막 괄호 안의 기간 토큰(없으면 ''). 예 'May' | 'Q1' | 'Jun/20'. */
    period: string;
}

/**
 * 마지막 괄호 그룹을 base와 period로 분리한다. 중간 괄호('Index (ex Food) MoM')는
 * 보존하고 끝 괄호만 떼어낸다. 접미 괄호가 없으면 period는 ''.
 */
export function normalizeIndicatorName(raw: string): NormalizedIndicatorName {
    const match = raw.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (match === null) {
        return { base: raw.trim(), period: '' };
    }
    return { base: match[1].trim(), period: match[2].trim() };
}

/**
 * 기간 토큰을 한국어로 변환한다 — 변화-방향(YoY/MoM/QoQ), 월 약어(May→5월),
 * 분기(Q1→1분기). 미지 토큰은 원문 유지(예 'Jun/20').
 */
export function koreanizePeriodToken(token: string): string {
    if (token in PERIOD_DIRECTION_KO) {
        return PERIOD_DIRECTION_KO[token];
    }
    if (token in MONTH_INDEX) {
        return `${MONTH_INDEX[token]}월`;
    }
    const quarter = token.match(/^Q([1-4])$/);
    if (quarter !== null) {
        return `${quarter[1]}분기`;
    }
    return token;
}

/**
 * 동기 표시 헬퍼 — dict(코드 사전) → dbMap(이미 로드된 DB 캐시) 순으로 base를 룩업한다.
 * 둘 다 miss면 raw 영어 원문을 그대로 반환(결정론적 fallback). hit이면 한국어 base에
 * period 토큰을 한국어로 붙인다(' (5월)'). period가 dict base 안에 이미 녹아 있으면
 * (예 'Core PCE Price Index YoY' base는 '(전년比)' 포함) period 괄호만 추가된다.
 *
 * AI 트리거/캐시 쓰기는 서버 계층(resolveIndicatorLabels)이 담당 — 이 함수는 순수.
 */
export function indicatorLabelKoFromMaps(
    raw: string,
    dbMap: Record<string, string>
): string {
    const { base, period } = normalizeIndicatorName(raw);
    const ko = INDICATOR_NAME_KO[base] ?? dbMap[base];
    if (ko === undefined) {
        return raw;
    }
    if (period === '') {
        return ko;
    }
    return `${ko} (${koreanizePeriodToken(period)})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/lib/__tests__/indicatorNameKo.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/lib/indicatorNameKo.ts src/entities/economy/lib/__tests__/indicatorNameKo.test.ts
git commit -m "feat(economy): add indicator name Korean i18n module + dict seed (SP-B)"
```

---

## Task 2: `economic_indicator_translations` Drizzle table + types

**Files:**
- Modify: `src/shared/db/schema.ts` (append after `economicCalendar` from SP-A, before `termsKindEnum`)
- Modify: `src/shared/db/types.ts` (add record + repository interfaces)
- Modify: `src/shared/db/__tests__/schema.test.ts` (presence assertion)
- Create (generated): `drizzle/0019_*.sql`, `drizzle/meta/0019_snapshot.json`, updated `drizzle/meta/_journal.json`

> Prereq: SP-A's `economicCalendar` table + migration `0018_*` exist. If SP-A has not yet landed, this becomes migration `0018_*` instead — confirm the next free number with `ls drizzle/*.sql | tail -1` before `db:generate` and adjust the commit `git add` glob accordingly.

- [ ] **Step 1: Add the table to the schema**

In `src/shared/db/schema.ts`, add this block immediately after the `economicCalendar` `pgTable` definition (SP-A), before `export const termsKindEnum`. It mirrors `assetTranslations` column style and reuses existing imports (`pgTable`, `text`, `timestamp`).

```typescript
/**
 * 경제 지표명 한국어 번역 캐시 — `assetTranslations` 미러. 코드 const 사전
 * (`INDICATOR_NAME_KO`)이 source-of-truth이고, 이 테이블은 미매핑 지표명의 core AI
 * 번역 결과를 `source:'ai'`로 캐시한다(추후 코드 사전으로 승격). `normalizedName`은
 * 접미 괄호를 제거한 base 지표명(`normalizeIndicatorName`의 base).
 */
export const economicIndicatorTranslations = pgTable(
    'economic_indicator_translations',
    {
        normalizedName: text('normalized_name').primaryKey(),
        koreanName: text('korean_name').notNull(),
        // 'dict' | 'ai' — 출처. text 저장, 읽기 경계에서 검증.
        source: text('source').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    }
);
```

- [ ] **Step 2: Add the record + repository types**

In `src/shared/db/types.ts`, add after the `ProfileDescriptionTranslationRepository` interface (the translation-types cluster):

```typescript
/** 'dict' | 'ai' — indicator 번역 출처. */
export type IndicatorTranslationSource = 'dict' | 'ai';

/** 경제 지표명 한국어 번역 캐시 행. */
export interface IndicatorTranslationRecord {
    /** 정규화된 base 지표명(접미 괄호 제거). 예 'Core PCE Price Index YoY'. */
    normalizedName: string;
    /** 한국어 번역. */
    koreanName: string;
    /** 'dict'(코드 승격) | 'ai'(core 번역 캐시). */
    source: IndicatorTranslationSource;
}

/** {@link IndicatorTranslationRecord}를 백킹하는 영속화 연산. */
export interface IndicatorTranslationRepository {
    findByNames(
        normalizedNames: readonly string[]
    ): Promise<IndicatorTranslationRecord[]>;
    upsert(record: IndicatorTranslationRecord): Promise<void>;
}
```

- [ ] **Step 3: Add the schema presence test**

In `src/shared/db/__tests__/schema.test.ts`, add an assertion next to the existing table-presence checks (match the file's existing style — verify the import name first with `grep -n "economicIndicatorTranslations\|assetTranslations" src/shared/db/__tests__/schema.test.ts`). Append:

```typescript
import { economicIndicatorTranslations } from '@/shared/db/schema';

describe('economicIndicatorTranslations table', () => {
    it('exposes the expected columns', () => {
        const cols = Object.keys(economicIndicatorTranslations);
        expect(cols).toContain('normalizedName');
        expect(cols).toContain('koreanName');
        expect(cols).toContain('source');
        expect(cols).toContain('updatedAt');
    });
});
```

> If `schema.test.ts` already imports from `@/shared/db/schema` with a single import statement, add `economicIndicatorTranslations` to that existing import list instead of adding a second `import`, to keep lint clean (no duplicate-import).

- [ ] **Step 4: Generate the migration**

Run: `yarn db:generate`
Expected: drizzle-kit reports a new migration `0019_*` creating `economic_indicator_translations`; new files appear under `drizzle/` and `drizzle/meta/`. (No DB connection needed for `generate`.)

- [ ] **Step 5: Verify the generated SQL**

Run: `cat drizzle/0019_*.sql`
Expected: `CREATE TABLE "economic_indicator_translations"` with `"normalized_name" text PRIMARY KEY NOT NULL`, `"korean_name" text NOT NULL`, `"source" text NOT NULL`, `"updated_at" timestamp with time zone DEFAULT now() NOT NULL`. If columns don't match, fix the schema and re-run `yarn db:generate`.

- [ ] **Step 6: Typecheck + run the schema test**

Run: `npx tsc --noEmit && npx vitest run src/shared/db/__tests__/schema.test.ts`
Expected: PASS (no type errors; schema presence test green).

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/schema.ts src/shared/db/types.ts src/shared/db/__tests__/schema.test.ts drizzle/0019_*.sql drizzle/meta
git commit -m "feat(economy): add economic_indicator_translations table + types (SP-B)"
```

> Note: applying the migration (`yarn db:migrate`) is an operational step the user runs against their environment — not part of this code plan.

---

## Task 3: Indicator-translation DB repository

**Files:**
- Create: `src/entities/economy/api/indicatorTranslationRepository.ts`
- Test: `src/entities/economy/api/__tests__/indicatorTranslationRepository.test.ts`

`DrizzleIndicatorTranslationRepository.findByNames` reads cached rows for a batch of normalized base names (`inArray`); `upsert` writes one AI translation with `onConflictDoUpdate` + `sql\`now()\`` (mirroring `DrizzleAssetTranslationRepository`, since Drizzle's `onConflictDoUpdate` does not fire the `$onUpdateFn` hook — MISTAKES.md DB note).

- [ ] **Step 1: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { IndicatorTranslationRecord } from '@/shared/db/types';
import { DrizzleIndicatorTranslationRepository } from '@/entities/economy/api/indicatorTranslationRepository';

/** Chainable select/from/where + insert/values/onConflictDoUpdate stub. */
function makeDb(selectRows: unknown[]) {
    const where = vi.fn(async () => selectRows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const onConflictDoUpdate = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    return {
        db: { select, insert } as never,
        spies: { select, from, where, insert, values, onConflictDoUpdate },
    };
}

const RECORD: IndicatorTranslationRecord = {
    normalizedName: 'Some Obscure Index YoY',
    koreanName: '어떤 모호한 지수(전년比)',
    source: 'ai',
};

describe('DrizzleIndicatorTranslationRepository.findByNames', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns [] without querying when names is empty', async () => {
        const { db, spies } = makeDb([]);
        const repo = new DrizzleIndicatorTranslationRepository(db);
        const rows = await repo.findByNames([]);
        expect(rows).toEqual([]);
        expect(spies.select).not.toHaveBeenCalled();
    });

    it('maps DB rows to IndicatorTranslationRecord', async () => {
        const { db } = makeDb([
            {
                normalizedName: 'Nonfarm Payrolls',
                koreanName: '비농업 고용',
                source: 'ai',
            },
        ]);
        const repo = new DrizzleIndicatorTranslationRepository(db);
        const rows = await repo.findByNames(['Nonfarm Payrolls']);
        expect(rows).toEqual([
            {
                normalizedName: 'Nonfarm Payrolls',
                koreanName: '비농업 고용',
                source: 'ai',
            },
        ]);
    });
});

describe('DrizzleIndicatorTranslationRepository.upsert', () => {
    beforeEach(() => vi.clearAllMocks());

    it('inserts with the normalized name, korean name, and source', async () => {
        const { db, spies } = makeDb([]);
        const repo = new DrizzleIndicatorTranslationRepository(db);
        await repo.upsert(RECORD);
        expect(spies.insert).toHaveBeenCalledOnce();
        const inserted = spies.values.mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(inserted.normalizedName).toBe('Some Obscure Index YoY');
        expect(inserted.koreanName).toBe('어떤 모호한 지수(전년比)');
        expect(inserted.source).toBe('ai');
        expect(spies.onConflictDoUpdate).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/api/__tests__/indicatorTranslationRepository.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/api/indicatorTranslationRepository'`.

- [ ] **Step 3: Write the implementation**

```typescript
import 'server-only';
import { inArray, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { economicIndicatorTranslations } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    IndicatorTranslationRecord,
    IndicatorTranslationRepository,
    IndicatorTranslationSource,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

const indicatorTranslationColumns = {
    normalizedName: economicIndicatorTranslations.normalizedName,
    koreanName: economicIndicatorTranslations.koreanName,
    source: economicIndicatorTranslations.source,
};

interface IndicatorTranslationRow {
    normalizedName: string;
    koreanName: string;
    source: string;
}

/** 읽기 경계에서 source를 검증 — 미지값은 'ai'로 흡수(캐시 행이므로 합리적 기본). */
function toSource(value: string): IndicatorTranslationSource {
    return value === 'dict' ? 'dict' : 'ai';
}

function toRecord(row: IndicatorTranslationRow): IndicatorTranslationRecord {
    return {
        normalizedName: row.normalizedName,
        koreanName: row.koreanName,
        source: toSource(row.source),
    };
}

/**
 * `economic_indicator_translations`를 읽고 쓰는 Drizzle repository.
 * `DrizzleAssetTranslationRepository` 미러 — onConflictDoUpdate는 schema의
 * `$onUpdateFn`을 트리거하지 않으므로 `updatedAt`을 `sql\`now()\``로 명시한다.
 */
export class DrizzleIndicatorTranslationRepository
    implements IndicatorTranslationRepository
{
    constructor(private readonly db: SiglensDatabase) {}

    async findByNames(
        normalizedNames: readonly string[]
    ): Promise<IndicatorTranslationRecord[]> {
        if (normalizedNames.length === 0) return [];
        const rows = await withRetry(
            () =>
                this.db
                    .select(indicatorTranslationColumns)
                    .from(economicIndicatorTranslations)
                    .where(
                        inArray(
                            economicIndicatorTranslations.normalizedName,
                            [...normalizedNames]
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
        return rows.map(toRecord);
    }

    async upsert(record: IndicatorTranslationRecord): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(economicIndicatorTranslations)
                    .values(record)
                    .onConflictDoUpdate({
                        target: economicIndicatorTranslations.normalizedName,
                        set: {
                            koreanName: sql`excluded.korean_name`,
                            source: sql`excluded.source`,
                            updatedAt: sql`now()`,
                        },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/api/__tests__/indicatorTranslationRepository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/api/indicatorTranslationRepository.ts src/entities/economy/api/__tests__/indicatorTranslationRepository.test.ts
git commit -m "feat(economy): add indicator translation DB repository (SP-B)"
```

---

## Task 4: Translation constants module

**Files:**
- Create: `src/entities/economy/lib/indicatorTranslationConstants.ts`

Constants-only module so the `'use server'` action (no non-function exports) and the reader can share the cache tag, refresh-flag key prefix, and TTL. No test (trivial literals; covered transitively by Tasks 5–7).

- [ ] **Step 1: Write the module**

```typescript
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

/**
 * revalidateTag 대상 — indicator 번역 캐시만 무효화한다(캘린더 데이터 캐시와 분리).
 * AI 번역이 새로 캐시되면 다음 렌더에서 reader가 한국어를 집어 오도록 이 태그를 bust.
 */
export const INDICATOR_TRANSLATION_CACHE_TAG = 'economy:indicator-translation';

/** Redis pending-flag 키 prefix — 동일 지표명의 동시 AI 제출을 dedupe. */
export const INDICATOR_TRANSLATION_FLAG_PREFIX = 'economy:indicator-xlate';

const INDICATOR_TRANSLATION_FLAG_TTL_MINUTES = 10;

/**
 * pending-flag TTL — 이 윈도 안에 같은 지표명이 다시 miss로 들어와도 AI 재제출을
 * 건너뛴다(in-flight 또는 직전 실패 쿨다운). market-news refresh-flag 패턴 미러.
 */
export const INDICATOR_TRANSLATION_FLAG_TTL_SECONDS =
    INDICATOR_TRANSLATION_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/entities/economy/lib/indicatorTranslationConstants.ts
git commit -m "feat(economy): add indicator translation constants (SP-B)"
```

---

## Task 5: Per-name Redis pending-flag

**Files:**
- Create: `src/entities/economy/api/indicatorTranslationFlag.ts`
- Test: `src/entities/economy/api/__tests__/indicatorTranslationFlag.test.ts`

Mirrors `market-news` `isRecentlyFetched`/`markFetched`, but keyed per normalized name so concurrent renders of the same unmapped indicator submit at most one AI translation per TTL window.

- [ ] **Step 1: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockRedis } = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockRedis: Pick<import('@upstash/redis').Redis, 'get' | 'set'> = {
        get: mockGet,
        set: mockSet,
    };
    return { mockGet, mockSet, mockRedis };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '@/entities/economy/api/indicatorTranslationFlag';
import { INDICATOR_TRANSLATION_FLAG_TTL_SECONDS } from '@/entities/economy/lib/indicatorTranslationConstants';

describe('indicatorTranslationFlag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    it('returns false and does not call get when Redis is null', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(false);
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('returns true when the flag is set', async () => {
        mockGet.mockResolvedValue('1');
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(true);
    });

    it('returns false when the flag is absent', async () => {
        mockGet.mockResolvedValue(null);
        expect(await isIndicatorTranslationPending('CPI YoY')).toBe(false);
    });

    it('sets the pending flag with the TTL', async () => {
        await markIndicatorTranslationPending('CPI YoY');
        expect(mockSet).toHaveBeenCalledWith(
            expect.stringContaining('CPI YoY'),
            '1',
            { ex: INDICATOR_TRANSLATION_FLAG_TTL_SECONDS }
        );
    });

    it('is a no-op when Redis is null on mark', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);
        await markIndicatorTranslationPending('CPI YoY');
        expect(mockSet).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/api/__tests__/indicatorTranslationFlag.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/api/indicatorTranslationFlag'`.

- [ ] **Step 3: Write the implementation**

```typescript
import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    INDICATOR_TRANSLATION_FLAG_PREFIX,
    INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
} from '../lib/indicatorTranslationConstants';

function flagKey(normalizedName: string): string {
    return `${INDICATOR_TRANSLATION_FLAG_PREFIX}:${normalizedName}`;
}

/**
 * 해당 지표명의 AI 번역이 최근 TTL 내에 제출됐는지 — Redis 실패/미구성 시 false
 * (항상 제출 시도). market-news `isRecentlyFetched` 미러.
 */
export async function isIndicatorTranslationPending(
    normalizedName: string
): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(flagKey(normalizedName))) !== null;
    } catch (error) {
        console.error('[indicatorTranslationFlag] get failed', error);
        return false;
    }
}

/** "이 지표명 번역 제출함" 마킹 — Redis 실패 시 noop. */
export async function markIndicatorTranslationPending(
    normalizedName: string
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(flagKey(normalizedName), '1', {
            ex: INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[indicatorTranslationFlag] set failed', error);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/api/__tests__/indicatorTranslationFlag.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/economy/api/indicatorTranslationFlag.ts src/entities/economy/api/__tests__/indicatorTranslationFlag.test.ts
git commit -m "feat(economy): add per-name indicator translation pending-flag (SP-B)"
```

---

## Task 6: `ensureIndicatorTranslatedAction` (core seam) + barrel

**Files:**
- Create: `src/entities/economy/actions/ensureIndicatorTranslatedAction.ts`
- Modify (or create): `src/entities/economy/actions.ts`
- Test: `src/entities/economy/actions/__tests__/ensureIndicatorTranslatedAction.test.ts`

> **This is the only real core import site.** The test mocks `@y0ngha/siglens-core`'s `translateIndicatorName`; the action imports it for real (resolves once the user publishes core — see CROSS-REPO note). A `// CORE DEPENDENCY` comment marks the import.

The action takes a normalized base name, short-circuits if it's already in the code dict (`INDICATOR_NAME_KO`) or pending (Redis flag), marks pending, calls core `translateIndicatorName`, upserts `source:'ai'`, and `revalidateTag`s the translation cache. Graceful on core failure (no upsert, no revalidate — a later render retries after the pending flag's TTL).

- [ ] **Step 1: Write the failing test**

```typescript
vi.mock('server-only', () => ({}));

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));

const translateIndicatorName = vi.fn();
vi.mock('@y0ngha/siglens-core', () => ({ translateIndicatorName }));

const isPending = vi.fn();
const markPending = vi.fn();
vi.mock('@/entities/economy/api/indicatorTranslationFlag', () => ({
    isIndicatorTranslationPending: isPending,
    markIndicatorTranslationPending: markPending,
}));

const upsert = vi.fn();
vi.mock('@/entities/economy/api/indicatorTranslationRepository', () => ({
    DrizzleIndicatorTranslationRepository: class {
        upsert = upsert;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ensureIndicatorTranslatedAction } from '@/entities/economy/actions/ensureIndicatorTranslatedAction';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '@/entities/economy/lib/indicatorTranslationConstants';

describe('ensureIndicatorTranslatedAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isPending.mockResolvedValue(false);
        markPending.mockResolvedValue(undefined);
        translateIndicatorName.mockResolvedValue('어떤 모호한 지수(전년比)');
        upsert.mockResolvedValue(undefined);
    });

    it('skips when the name is already in the code dictionary', async () => {
        await ensureIndicatorTranslatedAction('Nonfarm Payrolls');
        expect(translateIndicatorName).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('skips when a translation is already pending', async () => {
        isPending.mockResolvedValue(true);
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(translateIndicatorName).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('translates, upserts source=ai, and revalidates the cache tag', async () => {
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(markPending).toHaveBeenCalledOnce();
        expect(translateIndicatorName).toHaveBeenCalledWith(
            'Some Obscure Index YoY'
        );
        expect(upsert).toHaveBeenCalledWith({
            normalizedName: 'Some Obscure Index YoY',
            koreanName: '어떤 모호한 지수(전년比)',
            source: 'ai',
        });
        expect(revalidateTag).toHaveBeenCalledWith(
            INDICATOR_TRANSLATION_CACHE_TAG,
            'max'
        );
    });

    it('swallows a core failure without upserting or revalidating', async () => {
        translateIndicatorName.mockRejectedValue(new Error('llm down'));
        await expect(
            ensureIndicatorTranslatedAction('Some Obscure Index YoY')
        ).resolves.toBeUndefined();
        expect(upsert).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not upsert an empty translation', async () => {
        translateIndicatorName.mockResolvedValue('   ');
        await ensureIndicatorTranslatedAction('Some Obscure Index YoY');
        expect(upsert).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/actions/__tests__/ensureIndicatorTranslatedAction.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/actions/ensureIndicatorTranslatedAction'`.

- [ ] **Step 3: Write the action**

```typescript
'use server';

import { revalidateTag } from 'next/cache';
// CORE DEPENDENCY (separate repo, user publishes): analysis-domain AI translation
// of an unmapped indicator name. See SP-B plan CROSS-REPO note. Until core ships
// this export, only the unit test (which mocks it) exercises this file.
import { translateIndicatorName } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleIndicatorTranslationRepository } from '../api/indicatorTranslationRepository';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '../api/indicatorTranslationFlag';
import { INDICATOR_NAME_KO } from '../lib/indicatorNameKo';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '../lib/indicatorTranslationConstants';

/**
 * Server Action: 미매핑 지표명 1건을 core AI로 번역해 `economic_indicator_translations`에
 * `source:'ai'`로 캐시하고 번역 캐시 태그를 무효화한다(다음 렌더에서 한국어 반영).
 *
 * 코드 사전(`INDICATOR_NAME_KO`)에 이미 있으면 즉시 반환 — dict가 source-of-truth라
 * AI를 호출할 이유가 없다. pending-flag로 동시/연속 제출을 dedupe한다. core 실패 시
 * graceful(캐시 미기록) — pending-flag TTL 만료 후 다음 렌더가 재시도한다.
 * `waitUntil` 안에서 fire-and-forget으로 도는 설계 — 응답 스트림 비차단.
 */
export async function ensureIndicatorTranslatedAction(
    normalizedName: string
): Promise<void> {
    try {
        if (normalizedName in INDICATOR_NAME_KO) {
            return;
        }
        if (await isIndicatorTranslationPending(normalizedName)) {
            return;
        }
        // core 왕복 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 제출을 생략.
        await markIndicatorTranslationPending(normalizedName);

        const koreanName = await translateIndicatorName(normalizedName);
        if (koreanName.trim() === '') {
            console.error(
                `[ensureIndicatorTranslatedAction] empty translation for "${normalizedName}"`
            );
            return;
        }

        const { db } = getDatabaseClient();
        const repo = new DrizzleIndicatorTranslationRepository(db);
        await repo.upsert({
            normalizedName,
            koreanName: koreanName.trim(),
            source: 'ai',
        });

        // 번역 캐시 태그만 무효화 — 캘린더 데이터 ISR 캐시는 무관.
        // Next 16 revalidateTag(tag, profile) — 'max'는 즉시 무효화.
        revalidateTag(INDICATOR_TRANSLATION_CACHE_TAG, 'max');
    } catch (error) {
        console.error('[ensureIndicatorTranslatedAction]', error);
    }
}
```

- [ ] **Step 4: Create/extend the action barrel**

Run `ls src/entities/economy/actions.ts` first.
- If SP-A already created it (re-exporting `ensureEconomicCalendarAction`), **add** this line to it:

```typescript
export { ensureIndicatorTranslatedAction } from './actions/ensureIndicatorTranslatedAction';
```

- If it does not exist, create `src/entities/economy/actions.ts` (no `'use server'` — re-export only, per `entities/CLAUDE.md`):

```typescript
export { ensureIndicatorTranslatedAction } from './actions/ensureIndicatorTranslatedAction';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/actions/__tests__/ensureIndicatorTranslatedAction.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If core has NOT yet published `translateIndicatorName`, `tsc` will error `'translateIndicatorName' is not exported`. That is the expected cross-repo gate — see CROSS-REPO note. The vitest suite still passes because the test mocks the module. Mark this task done on green vitest; resolve `tsc` once the core pin is bumped. Until then, the executing worker should note the `tsc` failure is attributable ONLY to the missing core export and to no other code in this task.)

- [ ] **Step 7: Commit**

```bash
git add src/entities/economy/actions/ensureIndicatorTranslatedAction.ts src/entities/economy/actions/__tests__/ensureIndicatorTranslatedAction.test.ts src/entities/economy/actions.ts
git commit -m "feat(economy): add ensureIndicatorTranslatedAction core translation seam (SP-B)"
```

---

## Task 7: ISR-safe label resolver (reader + on-miss AI trigger)

**Files:**
- Create: `src/entities/economy/api/resolveIndicatorLabels.ts`
- Test: `src/entities/economy/api/__tests__/resolveIndicatorLabels.test.ts`

`resolveIndicatorLabels(events)` is the server bridge between the DB cache and the client grid:

1. Collect the **distinct** normalized base names from the events; partition into dict-hits (already known) and unknowns.
2. For unknowns, read the DB cache (`unstable_cache`-wrapped, revalidate 24h + `economy:indicator-translation` tag → ISR cold-gen safe; `@neondatabase/serverless` HTTP is no-store).
3. Build the per-raw-event-name `labels` map by running the pure `indicatorLabelKoFromMaps(raw, dbMap)` for each distinct raw event name.
4. Fire-and-forget `ensureIndicatorTranslatedAction(name)` for names that are still unresolved (not in dict, not in DB) — this seeds the cache for the next render. Bots included (matches SP-A on-access policy).

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

const findByNames = vi.fn();
vi.mock('@/entities/economy/api/indicatorTranslationRepository', () => ({
    DrizzleIndicatorTranslationRepository: class {
        findByNames = findByNames;
    },
}));

const ensureIndicatorTranslatedAction = vi.fn();
vi.mock('@/entities/economy/actions/ensureIndicatorTranslatedAction', () => ({
    ensureIndicatorTranslatedAction,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';

const ev = (event: string): EconomicCalendarEvent => ({
    date: '2026-06-13 08:30:00',
    event,
    impact: 'High',
    actual: null,
    estimate: 1,
    previous: 1,
    unit: '%',
});

describe('resolveIndicatorLabels', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findByNames.mockResolvedValue([]);
        ensureIndicatorTranslatedAction.mockResolvedValue(undefined);
    });

    it('maps dict-known names to Korean without a DB lookup', async () => {
        const labels = await resolveIndicatorLabels([
            ev('Nonfarm Payrolls'),
        ]);
        expect(labels['Nonfarm Payrolls']).toBe('비농업 고용');
        // All distinct bases were dict-known → no unknowns → no DB query.
        expect(findByNames).not.toHaveBeenCalled();
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });

    it('applies a DB-cached translation for an unmapped name', async () => {
        findByNames.mockResolvedValue([
            {
                normalizedName: 'Some Obscure Index YoY',
                koreanName: '어떤 모호한 지수(전년比)',
                source: 'ai',
            },
        ]);
        const labels = await resolveIndicatorLabels([
            ev('Some Obscure Index YoY (May)'),
        ]);
        expect(labels['Some Obscure Index YoY (May)']).toBe(
            '어떤 모호한 지수(전년比) (5월)'
        );
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });

    it('falls back to English and triggers AI for a name missing everywhere', async () => {
        const labels = await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
        ]);
        expect(labels['Totally Unknown Thing (Apr)']).toBe(
            'Totally Unknown Thing (Apr)'
        );
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledWith(
            'Totally Unknown Thing'
        );
    });

    it('queries and triggers each distinct base only once', async () => {
        await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
            ev('Totally Unknown Thing (May)'),
        ]);
        expect(findByNames).toHaveBeenCalledTimes(1);
        expect(findByNames).toHaveBeenCalledWith(['Totally Unknown Thing']);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledTimes(1);
    });

    it('degrades to English-only labels on DB failure (graceful)', async () => {
        findByNames.mockRejectedValue(new Error('neon down'));
        const labels = await resolveIndicatorLabels([
            ev('Totally Unknown Thing (Apr)'),
        ]);
        expect(labels['Totally Unknown Thing (Apr)']).toBe(
            'Totally Unknown Thing (Apr)'
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/economy/api/__tests__/resolveIndicatorLabels.test.ts`
Expected: FAIL — `Cannot find module '@/entities/economy/api/resolveIndicatorLabels'`.

- [ ] **Step 3: Write the implementation**

```typescript
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleIndicatorTranslationRepository } from './indicatorTranslationRepository';
import { ensureIndicatorTranslatedAction } from '../actions/ensureIndicatorTranslatedAction';
import {
    INDICATOR_NAME_KO,
    indicatorLabelKoFromMaps,
    normalizeIndicatorName,
} from '../lib/indicatorNameKo';
import {
    INDICATOR_TRANSLATION_CACHE_TAG,
    INDICATOR_TRANSLATION_REVALIDATE_SECONDS,
} from '../lib/indicatorTranslationConstants';

/**
 * 미매핑 base 이름들의 DB 캐시 행을 읽는다. ISR cold-gen 안전: `@neondatabase/serverless`
 * HTTP는 no-store라 static generate가 `DYNAMIC_SERVER_USAGE`를 throw하므로 `unstable_cache`로
 * 감싼다(src/app/CLAUDE.md 4축 축1). revalidate=24h + `economy:indicator-translation` 태그로
 * `ensureIndicatorTranslatedAction`이 on-demand 무효화 가능. DB 실패 시 빈 맵으로 graceful.
 *
 * 캐시 키에 정렬된 이름 목록을 박아 입력이 바뀌면 자연히 리프레시된다.
 */
async function readDbMap(
    unknownNames: string[]
): Promise<Record<string, string>> {
    if (unknownNames.length === 0) return {};
    const sorted = [...unknownNames].toSorted((a, b) => a.localeCompare(b));
    return unstable_cache(
        async () => {
            try {
                const { db } = getDatabaseClient();
                const repo = new DrizzleIndicatorTranslationRepository(db);
                const rows = await repo.findByNames(sorted);
                return Object.fromEntries(
                    rows.map(r => [r.normalizedName, r.koreanName])
                );
            } catch (error) {
                console.error('[resolveIndicatorLabels] DB read failed:', error);
                return {};
            }
        },
        ['economy-indicator-translation', sorted.join('|')],
        {
            revalidate: INDICATOR_TRANSLATION_REVALIDATE_SECONDS,
            tags: [INDICATOR_TRANSLATION_CACHE_TAG],
        }
    )();
}

/**
 * 이벤트들의 raw 지표명을 표시 레이블(한국어 우선, 영어 fallback)로 매핑한 레코드를
 * 반환한다(키 = raw event명). dict-known은 즉시, 미매핑은 DB 캐시 룩업, 둘 다 miss면
 * 영어 fallback + fire-and-forget AI 트리거(다음 렌더 캐시 시드, 봇 포함).
 *
 * 그리드(client)는 이 순수 레이블 맵만 받아 표시한다 — server-only 의존성 누출 없음.
 */
export async function resolveIndicatorLabels(
    events: readonly EconomicCalendarEvent[]
): Promise<Record<string, string>> {
    const distinctRaw = [...new Set(events.map(e => e.event))];
    const baseByRaw = new Map(
        distinctRaw.map(raw => [raw, normalizeIndicatorName(raw).base])
    );

    const distinctBases = [...new Set(baseByRaw.values())];
    const unknownBases = distinctBases.filter(
        base => !(base in INDICATOR_NAME_KO)
    );

    const dbMap = await readDbMap(unknownBases);

    // 여전히 미해결인(dict X, DB X) base에 대해서만 AI 번역을 트리거 — 각 1회.
    for (const base of unknownBases) {
        if (!(base in dbMap)) {
            void ensureIndicatorTranslatedAction(base).catch(
                (e: unknown) => {
                    console.error(
                        '[resolveIndicatorLabels] ensureIndicatorTranslatedAction failed:',
                        e
                    );
                }
            );
        }
    }

    return Object.fromEntries(
        distinctRaw.map(raw => [raw, indicatorLabelKoFromMaps(raw, dbMap)])
    );
}
```

- [ ] **Step 4: Add the missing reader-TTL constant**

`readDbMap` references `INDICATOR_TRANSLATION_REVALIDATE_SECONDS`, which Task 4 did not define. Add it to `src/entities/economy/lib/indicatorTranslationConstants.ts`:

```typescript
import { SECONDS_PER_DAY } from '@/shared/config/time';
```

(merge into the existing `@/shared/config/time` import line so there is a single import — `import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/shared/config/time';`), and append:

```typescript
/**
 * 번역 reader의 `unstable_cache` revalidate — 24h, /economy revalidate(86400)와 단일
 * TTL 공유. 신선도는 `ensureIndicatorTranslatedAction`의 revalidateTag가 책임진다.
 */
export const INDICATOR_TRANSLATION_REVALIDATE_SECONDS = SECONDS_PER_DAY;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/entities/economy/api/__tests__/resolveIndicatorLabels.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (modulo the same cross-repo `translateIndicatorName` export gate noted in Task 6 Step 6, since this file transitively imports the action). On green vitest + a `tsc` failure attributable ONLY to the missing core export, proceed.

- [ ] **Step 7: Commit**

```bash
git add src/entities/economy/api/resolveIndicatorLabels.ts src/entities/economy/api/__tests__/resolveIndicatorLabels.test.ts src/entities/economy/lib/indicatorTranslationConstants.ts
git commit -m "feat(economy): add ISR-safe indicator label resolver + on-miss AI trigger (SP-B)"
```

---

## Task 8: Apply labels in `EconomicCalendarGrid` display

**Files:**
- Modify: `src/widgets/economy/sections/EconomicCalendarGrid.tsx`
- Modify: `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`

The grid receives a pre-resolved `labels?: Record<string, string>` (raw event name → display label) and applies it at the two display sites: the inline cell preview (`DayCell`) and the detail panel (`DayDetailPanel`). When `labels` is omitted or a name is absent, it falls back to the raw `ev.original.event` (current behavior preserved). The label map threads down through props (no new hooks → hook order untouched).

- [ ] **Step 1: Write the failing tests**

Append to `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx` a new describe block. (If SP-A already added the `@/entities/economy/actions` mock for the trigger hook, reuse it; otherwise add `vi.mock('@/entities/economy/actions', () => ({ ensureEconomicCalendarAction: vi.fn().mockResolvedValue(undefined) }));` at the top with the other mocks.)

```typescript
describe('EconomicCalendarGrid Korean indicator labels', () => {
    const ev = (date: string, event: string): EconomicCalendarEvent => ({
        date: `${date} 08:30:00`,
        event,
        impact: 'High',
        actual: null,
        estimate: 1,
        previous: 1,
        unit: '%',
    });

    it('renders the Korean label in the detail panel when provided', () => {
        render(
            <EconomicCalendarGrid
                events={[ev('2026-06-20', 'Nonfarm Payrolls')]}
                today="2026-06-20"
                labels={{ 'Nonfarm Payrolls': '비농업 고용' }}
            />
        );
        // The selected (today) panel shows the Korean label, not the English name.
        expect(screen.getAllByText('비농업 고용').length).toBeGreaterThan(0);
        expect(screen.queryByText('Nonfarm Payrolls')).toBeNull();
    });

    it('falls back to the English event name when no label is provided', () => {
        render(
            <EconomicCalendarGrid
                events={[ev('2026-06-20', 'Mystery Index')]}
                today="2026-06-20"
            />
        );
        expect(screen.getAllByText('Mystery Index').length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`
Expected: FAIL — `labels` is not yet a prop, and the panel renders the English name (so the Korean-label assertion and the `queryByText('Nonfarm Payrolls')` null assertion fail).

- [ ] **Step 3: Implement the `labels` prop threading**

In `src/widgets/economy/sections/EconomicCalendarGrid.tsx`:

(a) Add a label-lookup helper above `DayDetailPanel` (next to `kstDayOfWeekLabel`):

```typescript
/**
 * raw 이벤트명을 표시 레이블로 매핑한다 — `labels`(서버가 resolveIndicatorLabels로 미리
 * 해결한 한국어 우선 맵)에 있으면 그 값을, 없으면 raw 영어 원문을 반환(결정론적 fallback).
 */
function displayEventLabel(
    rawEvent: string,
    labels: Record<string, string>
): string {
    return labels[rawEvent] ?? rawEvent;
}
```

(b) Thread `labels` through the prop interfaces. Extend `DayDetailPanelProps` and `DayCellProps`:

```typescript
interface DayDetailPanelProps {
    group: DayGroup;
    isSelected: boolean;
    labels: Record<string, string>;
}
```

```typescript
interface DayCellProps {
    group: DayGroup;
    isSelected: boolean;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}
```

and `MonthCalendarProps`:

```typescript
interface MonthCalendarProps {
    year: number;
    /** 0-indexed */
    month: number;
    groupMap: Map<string, DayGroup>;
    selectedDateKey: string;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}
```

(c) In `DayDetailPanel`, change the event-name line:

```typescript
                                <p className="text-secondary-100 text-sm font-medium">
                                    {ev.original.event}
                                </p>
```

to:

```typescript
                                <p className="text-secondary-100 text-sm font-medium">
                                    {displayEventLabel(
                                        ev.original.event,
                                        labels
                                    )}
                                </p>
```

and add `labels` to the destructured props: `function DayDetailPanel({ group, isSelected, labels }: DayDetailPanelProps) {`.

(d) In `DayCell`, change the inline-preview event-name span:

```typescript
                            {ev.kstTimeLabel.replace(/^(오전|오후)\s*/, '')}{' '}
                            {ev.original.event}
```

to:

```typescript
                            {ev.kstTimeLabel.replace(/^(오전|오후)\s*/, '')}{' '}
                            {displayEventLabel(ev.original.event, labels)}
```

and add `labels` to its destructured props: `function DayCell({ group, isSelected, onSelect, labels }: DayCellProps) {`.

(e) In `MonthCalendar`, accept `labels` and forward it to each `DayCell`:

```typescript
function MonthCalendar({
    year,
    month,
    groupMap,
    selectedDateKey,
    onSelect,
    labels,
}: MonthCalendarProps) {
```

and in the `DayCell` render, add `labels={labels}`:

```typescript
                                    <DayCell
                                        key={cell.dateKey}
                                        group={cell}
                                        isSelected={
                                            selectedDateKey === cell.dateKey
                                        }
                                        onSelect={onSelect}
                                        labels={labels}
                                    />
```

(f) Extend `EconomicCalendarGridProps` with the optional prop and default it in the component, then forward it to `MonthCalendar` and `DayDetailPanel`:

```typescript
interface EconomicCalendarGridProps {
    events: readonly EconomicCalendarEvent[];
    today?: string;
    /**
     * raw 이벤트명 → 표시 레이블(한국어 우선) 맵. 서버 RSC가 `resolveIndicatorLabels`로
     * 미리 해결해 주입한다. 생략 시 모든 이벤트가 영어 원문으로 표시된다(결정론적 fallback).
     */
    labels?: Record<string, string>;
}
```

In the component signature add `labels = {}`:

```typescript
export function EconomicCalendarGrid({
    events,
    today = '',
    labels = {},
}: EconomicCalendarGridProps) {
```

In the months map, pass `labels={labels}`:

```typescript
                    <MonthCalendar
                        key={`${year}-${month}`}
                        year={year}
                        month={month}
                        groupMap={groupMap}
                        selectedDateKey={selectedDateKey}
                        onSelect={setSelectedDateKey}
                        labels={labels}
                    />
```

In the detail-panels map, pass `labels={labels}`:

```typescript
                    <DayDetailPanel
                        key={group.dateKey}
                        group={group}
                        isSelected={group.dateKey === selectedDateKey}
                        labels={labels}
                    />
```

> Note: `today` is shown as optional here assuming SP-A landed it. If SP-A has NOT landed, drop the `today` prop references from this task (keep only `events` + `labels`) and re-add `today` when SP-A merges. The `labels` change is independent of `today`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`
Expected: PASS — Korean-label + English-fallback tests pass and all pre-existing grid tests still pass (omitted `labels` → English).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: PASS (modulo the cross-repo core-export `tsc` gate if Task 6/7 are in the same tree; the grid file itself introduces no core import). No new hooks added → exhaustive-deps and hook-order untouched.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
git commit -m "feat(economy): render Korean indicator labels in calendar grid (SP-B)"
```

---

## Task 9: Wire the page to resolve + pass labels

**Files:**
- Modify: `src/app/economy/page.tsx`

Compute `labels = await resolveIndicatorLabels(calendarEvents)` in the RSC (right after the SP-A `calendarEvents` line) and pass it to `<EconomicCalendar>`. The page already awaits `getCalendarFromDb` (SP-A); this adds one more awaited reader on the same data.

> Prereq: SP-A's page wiring (`calendarEvents` + `<EconomicCalendar events={calendarEvents} today={todayKstKey} />`) is in place. If SP-A has not landed, adapt to whatever the calendar events source is currently named (e.g. `snapshot.calendar`).

- [ ] **Step 1: Add the import**

In `src/app/economy/page.tsx`, after the SP-A `getCalendarFromDb` import:

```typescript
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
```

- [ ] **Step 2: Resolve labels after the calendar events**

In `EconomyContent`, after the `calendarEvents` assignment (SP-A), add:

```typescript
    // 지표명 한국어 레이블을 서버에서 미리 해결한다(dict → DB 캐시 → 영어 fallback +
    // 미매핑 AI 트리거). 그리드는 순수 레이블 맵만 받아 표시한다(SP-B).
    const indicatorLabels = await resolveIndicatorLabels(calendarEvents).catch(
        e => {
            console.error('[EconomyContent] resolveIndicatorLabels failed:', e);
            return {} as Record<string, string>;
        }
    );
```

- [ ] **Step 3: Pass `labels` to the grid**

Change:

```typescript
            <EconomicCalendar events={calendarEvents} today={todayKstKey} />
```

to:

```typescript
            <EconomicCalendar
                events={calendarEvents}
                today={todayKstKey}
                labels={indicatorLabels}
            />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (modulo the cross-repo core-export gate). `resolveIndicatorLabels(events): Promise<Record<string,string>>`; `EconomicCalendar` (= `EconomicCalendarGrid`) accepts the optional `labels`.

- [ ] **Step 5: Run economy suites**

Run: `npx vitest run src/widgets/economy src/entities/economy`
Expected: PASS (all economy widget/entity tests green).

- [ ] **Step 6: Build to verify ISR/cold-gen safety (after core pin is bumped)**

Run: `yarn build > /tmp/economy-spb-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0` and `/economy` builds without `DYNAMIC_SERVER_USAGE`. Inspect: `grep -iE "economy|DYNAMIC_SERVER_USAGE|translateIndicatorName|error" /tmp/economy-spb-build.log`. There must be **no** `DYNAMIC_SERVER_USAGE` attributed to `/economy` (the `unstable_cache` wrapper in `readDbMap` makes the DB read static-safe). If the build fails with `translateIndicatorName is not exported`, the core pin has not been bumped yet — this build step is **deferred until the user publishes core and bumps the pin** (see CROSS-REPO note). Record the deferral; do not work around it by stubbing core in app code.

- [ ] **Step 7: Commit**

```bash
git add src/app/economy/page.tsx
git commit -m "feat(economy): resolve + pass Korean indicator labels on economy page (SP-B)"
```

---

## Task 10: Dictionary-seeding procedure doc

**Files:**
- Create: `docs/superpowers/seeding/indicator-name-ko-seeding.md`

A documented one-time data task (not code): consume SP-A's name-dump, draft via core AI, curate, and fill `INDICATOR_NAME_KO`. The seed in Task 1 covers the most common ~28 indicators; the full ~277 curation is this follow-up.

- [ ] **Step 1: Write the procedure doc**

```markdown
# Indicator Name Korean Dictionary — One-Time Seeding Procedure

`INDICATOR_NAME_KO` (`src/entities/economy/lib/indicatorNameKo.ts`) is the
source-of-truth (`dict`) for economic-indicator Korean names. SP-B Task 1 seeds
the ~28 most common indicators from the FMP sample. This procedure curates the
full ~277 distinct normalized base names into the dictionary as a follow-up data
task. Anything not in the dictionary is AI-translated on-miss and cached
(`source:'ai'`) in `economic_indicator_translations` — so this seeding is an
optimization (instant Korean, no AI round-trip) and a quality-control gate
(human-curated vs. machine draft), not a correctness requirement.

## Inputs

- **`scripts/output/economic-calendar-indicator-names.json`** — the distinct
  normalized base-name set produced by SP-A's backfill
  (`yarn db:backfill:calendar`). ~277 entries, sorted.

## Steps

1. **Run the SP-A backfill** (user, one-time) to regenerate the name dump:
   `yarn db:backfill:calendar`. Confirm the JSON file exists and its length is
   ~277.

2. **Draft translations via core AI.** For each name not already in
   `INDICATOR_NAME_KO`, obtain a Korean draft. Two equivalent options:
   - Let the running app self-heal: deploy SP-B, let `/economy` traffic trigger
     `ensureIndicatorTranslatedAction` for misses, then `SELECT normalized_name,
     korean_name FROM economic_indicator_translations WHERE source = 'ai'` to
     read the machine drafts back.
   - Or call core `translateIndicatorName(name)` directly in a throwaway script
     over the dump (core must be published first).

3. **Curate.** Review each draft for: domain accuracy (지표 의미), consistent
   terminology (e.g. always `근원` for "Core", `전년比`/`전월比`/`전분기比` for
   YoY/MoM/QoQ — these come from `koreanizePeriodToken`, so the **base** must NOT
   embed the period token; keep base period-free except where the FMP base name
   itself carries a direction, like `... YoY`, which the seed already folds into
   the Korean), and house style (no trailing punctuation). Fix anything wrong.

4. **Fill `INDICATOR_NAME_KO`.** Add the curated `'<base>': '<korean>'` entries
   to the const map, keeping the existing grouping comments (물가 / 고용 /
   성장·심리 / 정책·국채 / …). Keys MUST be the **normalized base** form
   (`normalizeIndicatorName(raw).base`) — no trailing `(May)`/`(Q1)`.

5. **Promote, optionally.** Rows curated into the dict can have their DB cache
   row updated to `source:'dict'` (or left as-is — the dict short-circuits the
   DB read either way, since `INDICATOR_NAME_KO` is checked first).

6. **Verify.** Extend `indicatorNameKo.test.ts` with spot-check assertions for a
   handful of newly-added high-traffic indicators, then `yarn test`.

## Guardrails

- Do NOT machine-bulk-paste drafts without review — a wrong indicator
  translation is user-visible and misleading.
- Keep base keys period-free; the period parenthetical is Korean-ized separately
  by `koreanizePeriodToken` at display time.
- The dictionary is plain data — no logic. Reviewers should treat large dict
  additions as a data PR (spot-check, not line-by-line lint).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/seeding/indicator-name-ko-seeding.md
git commit -m "docs(economy): add indicator-name Korean dictionary seeding procedure (SP-B)"
```

---

## Task 11: Full-suite green + final gates

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `yarn test`
Expected: PASS (no regressions across the repo). SP-B's only un-mocked external dependency is core `translateIndicatorName`, which every test mocks — so the unit suite is green independent of the core publish.

- [ ] **Step 2: Lint + format gates**

Run: `yarn lint && yarn format`
Expected: lint PASS, format applies no pending changes (or only files this plan touched, already clean). If `yarn format` rewrites files, re-run `yarn lint` and amend the relevant commit.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS **once the core `translateIndicatorName` export is published and the pin is bumped**. If core has not landed, the ONLY acceptable `tsc` error is `'translateIndicatorName' is not exported from '@y0ngha/siglens-core'` in `ensureIndicatorTranslatedAction.ts`. Any other type error is a real defect to fix.

- [ ] **Step 4: Commit any formatting fixups (if produced)**

```bash
git add -A
git commit -m "chore(economy): formatting + lint fixups (SP-B)"
```

(Skip if nothing changed.)

---

## Self-Review

**Spec coverage (SP-B section + `economic_indicator_translations` shared data model):**

| Spec requirement | Task |
|---|---|
| `indicatorNameKo.ts`: `INDICATOR_NAME_KO: Record<string,string>` code const (source-of-truth) | Task 1 (seed of confirmed common indicators) + Task 10 (full ~277 curation procedure) |
| `normalizeIndicatorName(raw)`: strip trailing `(May)`/`(Q1)`/`(Jun/20)`, return base + period token | Task 1 (`normalizeIndicatorName` → `{ base, period }`, final-parenthetical only, interior preserved) |
| Period-token Korean-ization (YoY→전년比, MoM→전월比, QoQ→전분기比, month/quarter names) | Task 1 (`koreanizePeriodToken`) |
| `indicatorLabelKo(raw)` display helper: normalize → dict → DB-cache → miss returns English + background AI trigger | Split per FSD: pure sync `indicatorLabelKoFromMaps` (Task 1) for client; server `resolveIndicatorLabels` (Task 7) does DB-cache lookup + on-miss `ensureIndicatorTranslatedAction` trigger |
| `economic_indicator_translations` table mirroring `assetTranslations` (normalizedName PK, koreanName, source 'dict'\|'ai', updatedAt) + migration | Task 2 (schema + `$onUpdateFn` updatedAt + types + `db:generate` migration) |
| siglens adapter calling CORE `translateIndicatorName(normalizedName): Promise<string>`, upsert result `source:'ai'` | Task 6 (`ensureIndicatorTranslatedAction`, only real core import, marked `// CORE DEPENDENCY`) + Task 3 (repository upsert) |
| CORE CONTRACT defined, core NOT implemented, marked cross-repo, mocked in tests | CROSS-REPO note (exact signature) + Tasks 6/7 mock `@y0ngha/siglens-core` |
| Apply `indicatorLabelKo` in `EconomicCalendarGrid` (cell preview + detail panel), Korean when mapped, English fallback | Task 8 (`displayEventLabel` at `DayCell` inline preview + `DayDetailPanel`) + Task 9 (page resolves + passes `labels`) |
| Dictionary seeding (one-time): SP-A name-dump → core AI draft → curate → fill, with a confirmed seed | Task 1 (seed incl. 'Core PCE Price Index YoY'→'근원 PCE 물가지수(전년比)', 'Nonfarm Payrolls'→'비농업 고용', 'ADP Employment Change'→'ADP 고용 변화', 'CPI', 'Initial Jobless Claims', 'Fed Interest Rate Decision', '10-Year Note Auction'→'10년물 국채 입찰') + Task 10 (procedure) |
| Tests: normalize (suffix split + period token), dict lookup, DB-cache fallback, unmapped English-kept | Task 1 (normalize/period/dict/DB-map/English-fallback) + Task 3 (repo) + Task 7 (resolver: dict short-circuit, DB hit, miss→trigger, graceful) + Task 8 (grid display) |

**Gate compliance:**
- **No `eslint-disable`** anywhere; no `react-hooks` suppression — Task 8 adds no hooks (label map threads via props).
- **Named return types** on every export: `normalizeIndicatorName(raw): NormalizedIndicatorName`, `koreanizePeriodToken(token): string`, `indicatorLabelKoFromMaps(...): string`, `resolveIndicatorLabels(...): Promise<Record<string,string>>`, repository methods, action `: Promise<void>`.
- **Exact assertions** in every test (`toBe`/`toEqual` with concrete Korean strings + call args), no `toBeTruthy`.
- **WHY comments only** — caching strategy, cross-repo seam, ISR safety, dedupe rationale; no line-narration.
- **`'use server'` purity** — Task 6 action exports only the async function; constants (Task 4), repository (Task 3), flag (Task 5), and the i18n module (Task 1) are separate files.
- **FSD layers/barrels** — pure `lib/` (client-safe) consumed by both grid and reader; server-only `api/` + `actions/` barrel-excluded; grid imports only the pure `lib/` helper and the pre-resolved `labels` prop (no server import).
- **ISR 4-axis** — `resolveIndicatorLabels` wraps its DB read in `unstable_cache` (revalidate 24h + tag); no `cookies()`/`headers()`/`connection()`/`Date.now()` on the cold-gen path; Task 9 Step 6 build-asserts no `DYNAMIC_SERVER_USAGE` for `/economy`.

**Cross-repo handling:** core `translateIndicatorName` is defined as a contract (exact signature in the CROSS-REPO note), NOT implemented in siglens, mocked in every siglens test, imported for real at exactly one site (Task 6, marked). The two cross-repo gates the executing worker may legitimately hit before the core publish are flagged inline (Task 6 Step 6, Task 7 Step 6, Task 9 Step 6, Task 11 Step 3) with the exact, attributable `tsc`/build error and the deferral rule (do NOT stub core in app code as a workaround).

**Placeholder scan:** No TBD/TODO/"similar to". Every code step is complete TypeScript; every command is exact with expected output. Error handling is concrete (try/catch + `console.error` + graceful fallback to English-only labels) in Tasks 3, 5, 6, 7, 9.

**Type-consistency check:**
- `normalizeIndicatorName(raw): { base, period }` — same shape in Tasks 1 (def/test), 7 (`.base` consumed). ✓
- `indicatorLabelKoFromMaps(raw, dbMap): string` — Task 1 def, Task 7 consumes per raw name. ✓
- `DrizzleIndicatorTranslationRepository` exposes `findByNames(names)` + `upsert(record)` — defined Task 3, mocked identically in Tasks 6 (`upsert`) and 7 (`findByNames`). ✓
- `ensureIndicatorTranslatedAction(normalizedName): Promise<void>` — Task 6 def/barrel, Task 7 trigger, mocked Task 7 test. ✓
- `resolveIndicatorLabels(events): Promise<Record<string,string>>` — Task 7 def/test, Task 9 page call. ✓
- `EconomicCalendarGridProps.labels?: Record<string,string>` — Task 8 def matches Task 9 usage (`labels={indicatorLabels}`). ✓
- Constants `INDICATOR_TRANSLATION_CACHE_TAG`/`INDICATOR_TRANSLATION_FLAG_*`/`INDICATOR_TRANSLATION_REVALIDATE_SECONDS` — defined Tasks 4/7-Step4, consumed Tasks 5/6/7. ✓
- CORE `translateIndicatorName(normalizedName: string): Promise<string>` — contract in CROSS-REPO note, mocked Task 6 test, imported Task 6 action. ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-06-20-economy-calendar-SP-B-name-translation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
