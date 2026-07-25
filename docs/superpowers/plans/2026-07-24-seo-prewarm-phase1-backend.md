# SEO Pre-warm Phase 1 (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 스냅샷 백엔드 완성 — DB 테이블·repository·적용성/신선도 엔진·server-only prewarm seam·Redis 가드·cron 라우트·AWS 인프라 스크립트.

**Architecture:** 스펙 `docs/superpowers/specs/2026-07-24-seo-recovery-bot-ssr-prewarm-design.md`(v3) §4~§6·§8·§9. EventBridge(UTC 룰)→PATCH `/api/cron/seo-prewarm`(202+`after()`)→server-only prewarm lib(`skipEnqueueIfMiss:false`, 익명 free 컨텍스트 고정)→수확분을 `seo_analysis_snapshots`에 upsert→심볼 완료 시 `revalidateTag('seo-snapshot:{SYM}','max')`+`revalidatePath`.

**Tech Stack:** Next 16.2 route handler + `after()`, drizzle(pgTable→`yarn db:generate`), Upstash Redis(`getRedisClient`), `@y0ngha/siglens-core` submit API(force 지원), vitest.

**Branch:** `feat/seo-prewarm-backend` (워크트리에서 작업 — main 워킹트리 청결 유지. `node_modules`는 `cp -al` 하드링크 + core 버전 일치 확인)

**스펙 대비 구현 선택(승인된 정제)**: 스펙 §4의 "액션 본문을 lib으로 추출" 대신 **전용 prewarm lib 신설**로 충족한다 — NB-1의 요건(lib 내 request-context 0건·public 시그니처 무변경·cron이 `skipEnqueueIfMiss:false`)을 라이브 액션 7개를 건드리지 않고 만족시키며, 캐시 키 5축은 "익명 free 방문자의 액션이 만드는 core 호출"을 그대로 재현해 정합(§7). 중복은 provider 셋업 ~10줄뿐.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/shared/db/schema.ts` (수정) | `seoAnalysisSnapshots` pgTable 추가 |
| `drizzle/00XX_*.sql` (생성) | `yarn db:generate` 산출물 |
| `src/entities/seo-snapshot/model.ts` | 탭 상수·타입 |
| `src/entities/seo-snapshot/api.ts` | `DrizzleSeoSnapshotRepository` (server-only) |
| `src/entities/seo-snapshot/lib/applicability.ts` | 자산군별 적용 탭 매트릭스 + prewarm universe |
| `src/entities/seo-snapshot/lib/freshness.ts` | ET 마감(+30분 버퍼) 경계 계산 |
| `src/entities/seo-snapshot/index.ts` | barrel (model·applicability·freshness만 — api.ts는 server-only 제외) |
| `src/entities/analysis/lib/prewarmSubmits.ts` | technical·overall·fundamental·financials·congress prewarm seam |
| `src/entities/news-article/lib/prewarmSubmitNews.ts` | news prewarm seam (force 없음) |
| `src/entities/options-chain/lib/prewarmSubmitOptions.ts` | options prewarm seam |
| `src/app/api/cron/seo-prewarm/lock.ts` | Redis 루트 락·in-flight 마커·FMP 일일 카운터 |
| `src/app/api/cron/seo-prewarm/runPrewarmBatch.ts` | 배치 오케스트레이션(선정→실행→수확→revalidate) |
| `src/app/api/cron/seo-prewarm/route.ts` | PATCH 핸들러(인증→락→202→after) |
| `infra/aws/13-seo-prewarm.sh` | EventBridge Connection·API Destination·Rule 2개 |
| `docs/reference/CRON.md` (수정) | AWS 패턴으로 개정 |

각 태스크 완료 시 커밋. 테스트는 vitest(`yarn test <path>`), 스코프 게이트만 (tsc+스코프 테스트+lint — 전체 build/e2e는 pre-push·CI 몫).

---

### Task 1: `seoAnalysisSnapshots` 테이블 + 마이그레이션

**Files:**
- Modify: `src/shared/db/schema.ts` (파일 끝, `sharedAnalyses` 뒤)
- Create: `drizzle/00XX_*.sql` (자동 생성)

- [ ] **Step 1: schema.ts에 테이블 추가** — 기존 `sharedAnalyses`(schema.ts:570) 패턴 준수. `SYMBOL_MAX_LENGTH`는 파일 상단에 이미 import/정의돼 있는 상수를 재사용한다(grep으로 확인).

```ts
/**
 * SEO 분석 스냅샷 — 심볼×탭당 last-known-good 1행 (spec 2026-07-24 §5).
 * SSR "최근 분석 요약" 섹션의 유일한 데이터 소스. pre-warm cron만 write하고
 * 실패 시 이전 행이 유지된다(fail-open). content는 core 정규화 타입드 결과
 * (탭별 스키마 상이 — HTML 아님, 렌더러가 산문 변환).
 */
export const seoAnalysisSnapshots = pgTable(
    'seo_analysis_snapshots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        tab: varchar('tab', { length: 16 }).notNull(),
        content: jsonb('content').notNull(),
        model: varchar('model', { length: 64 }).notNull(),
        generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('seo_analysis_snapshots_symbol_tab_uq').on(
            table.symbol,
            table.tab
        ),
        index('seo_analysis_snapshots_symbol_idx').on(table.symbol),
    ]
);
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `yarn db:generate`
Expected: `drizzle/00XX_<slug>.sql`에 `CREATE TABLE "seo_analysis_snapshots"` + unique index 포함. 다른 테이블 변경이 섞여 있으면 STOP(스키마 drift — 사용자 보고).

- [ ] **Step 3: 로컬 DB에 적용 확인**

Run: `yarn db:migrate`
Expected: 에러 없이 적용.

- [ ] **Step 4: Commit** — `feat(seo-snapshot): add seo_analysis_snapshots table`

### Task 2: `entities/seo-snapshot` model + repository

**Files:**
- Create: `src/entities/seo-snapshot/model.ts`
- Create: `src/entities/seo-snapshot/api.ts`
- Create: `src/entities/seo-snapshot/index.ts`
- Test: `src/entities/seo-snapshot/__tests__/api.test.ts`

- [ ] **Step 1: model.ts 작성**

```ts
export const SEO_SNAPSHOT_TABS = [
    'technical',
    'overall',
    'fundamental',
    'financials',
    'congress',
    'news',
    'options',
] as const;

export type SeoSnapshotTab = (typeof SEO_SNAPSHOT_TABS)[number];

export interface SeoAnalysisSnapshot {
    symbol: string;
    tab: SeoSnapshotTab;
    /** core 정규화 타입드 결과 — 탭별 스키마 상이. 렌더러가 좁혀서 사용. */
    content: unknown;
    model: string;
    generatedAt: Date;
    updatedAt: Date;
}

export interface SeoSnapshotUpsertInput {
    symbol: string;
    tab: SeoSnapshotTab;
    content: unknown;
    model: string;
    generatedAt: Date;
}
```

- [ ] **Step 2: 실패하는 repository 테스트 작성** — 기존 repository 테스트 패턴(`src/entities/shared-analysis` 또는 `src/entities/portfolio`의 `__tests__`에서 drizzle mock 방식을 확인해 동일 패턴 사용). 최소 케이스:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DrizzleSeoSnapshotRepository } from '../api';

// drizzle db mock — onConflictDoUpdate 체인 검증
function createDbMock() {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { insert, select } as never, insert, values, onConflictDoUpdate, select, from, where };
}

describe('DrizzleSeoSnapshotRepository', () => {
    let mock: ReturnType<typeof createDbMock>;
    beforeEach(() => { mock = createDbMock(); });

    it('upsert는 symbol을 대문자 정규화하고 onConflictDoUpdate로 last-known-good 1행을 유지한다', async () => {
        const repo = new DrizzleSeoSnapshotRepository(mock.db);
        await repo.upsert({
            symbol: 'aapl', tab: 'technical', content: { summary: 'x' },
            model: 'deepseek-v4-flash', generatedAt: new Date('2026-07-24T21:00:00Z'),
        });
        expect(mock.values).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'AAPL', tab: 'technical' })
        );
        expect(mock.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('findBySymbol은 대문자 정규화로 조회한다', async () => {
        const repo = new DrizzleSeoSnapshotRepository(mock.db);
        await repo.findBySymbol('tsla');
        expect(mock.where).toHaveBeenCalled(); // eq(symbol,'TSLA') — 구현 후 인자 단언 강화
    });

    it('findGeneratedAtMap은 `${symbol}:${tab}` 키 Map을 반환한다', async () => {
        mock.where.mockResolvedValueOnce([
            { symbol: 'AAPL', tab: 'technical', generatedAt: new Date('2026-07-24T21:00:00Z') },
        ]);
        const repo = new DrizzleSeoSnapshotRepository(mock.db);
        const map = await repo.findGeneratedAtMap(['AAPL']);
        expect(map.get('AAPL:technical')).toEqual(new Date('2026-07-24T21:00:00Z'));
    });
});
```

- [ ] **Step 3: 실패 확인** — Run: `yarn test src/entities/seo-snapshot` / Expected: FAIL (모듈 없음)

- [ ] **Step 4: api.ts 구현**

```ts
import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { seoAnalysisSnapshots } from '@/shared/db/schema';
import type {
    SeoAnalysisSnapshot,
    SeoSnapshotTab,
    SeoSnapshotUpsertInput,
} from './model';

/** DB client 타입은 shared/db/client의 반환 타입과 정렬 — 기존 repository들이 쓰는 타입 별칭을 그대로 사용한다(예: DrizzlePortfolioRepository 참조). */
export class DrizzleSeoSnapshotRepository {
    constructor(private readonly db: NodePgDatabase<Record<string, unknown>>) {}

    async upsert(input: SeoSnapshotUpsertInput): Promise<void> {
        const symbol = input.symbol.toUpperCase();
        await this.db
            .insert(seoAnalysisSnapshots)
            .values({
                symbol,
                tab: input.tab,
                content: input.content,
                model: input.model,
                generatedAt: input.generatedAt,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [seoAnalysisSnapshots.symbol, seoAnalysisSnapshots.tab],
                set: {
                    content: input.content,
                    model: input.model,
                    generatedAt: input.generatedAt,
                    updatedAt: new Date(),
                },
            });
    }

    async findBySymbol(symbol: string): Promise<SeoAnalysisSnapshot[]> {
        const rows = await this.db
            .select()
            .from(seoAnalysisSnapshots)
            .where(eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()));
        return rows as SeoAnalysisSnapshot[];
    }

    async findBySymbolAndTab(
        symbol: string,
        tab: SeoSnapshotTab
    ): Promise<SeoAnalysisSnapshot | null> {
        const rows = await this.db
            .select()
            .from(seoAnalysisSnapshots)
            .where(
                and(
                    eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()),
                    eq(seoAnalysisSnapshots.tab, tab)
                )
            );
        return (rows[0] as SeoAnalysisSnapshot | undefined) ?? null;
    }

    /** 배치 선정용 — 심볼 목록의 (symbol,tab)→generatedAt 1쿼리 로드. */
    async findGeneratedAtMap(symbols: string[]): Promise<Map<string, Date>> {
        if (symbols.length === 0) return new Map();
        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                tab: seoAnalysisSnapshots.tab,
                generatedAt: seoAnalysisSnapshots.generatedAt,
            })
            .from(seoAnalysisSnapshots)
            .where(inArray(seoAnalysisSnapshots.symbol, symbols.map(s => s.toUpperCase())));
        return new Map(rows.map(r => [`${r.symbol}:${r.tab}`, r.generatedAt]));
    }
}
```

⚠️ `NodePgDatabase` 타입 별칭은 실제 repo가 쓰는 것과 맞춘다 — `src/entities/portfolio/api.ts`의 constructor 타입을 열어 동일하게(Neon/postgres-js면 그 타입). 다르면 그쪽으로 교체.

- [ ] **Step 5: index.ts barrel** — `api.ts`는 server-only이므로 **barrel 제외**(entities/CLAUDE.md 규칙). model만:

```ts
export * from './model';
```

- [ ] **Step 6: 통과 확인** — Run: `yarn test src/entities/seo-snapshot` / Expected: PASS
- [ ] **Step 7: Commit** — `feat(seo-snapshot): add model + drizzle repository`

### Task 3: 적용성 매트릭스 + prewarm universe

**Files:**
- Create: `src/entities/seo-snapshot/lib/applicability.ts`
- Test: `src/entities/seo-snapshot/__tests__/applicability.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import {
    applicableTabsFor,
    buildPrewarmUniverse,
} from '../lib/applicability';

describe('applicableTabsFor', () => {
    it('크립토는 technical/overall/news만', () => {
        expect(applicableTabsFor('BTCUSD')).toEqual(['technical', 'overall', 'news']);
    });
    it('옵션 상장 주식은 7탭 전부', () => {
        expect(applicableTabsFor('AAPL')).toHaveLength(7);
        expect(applicableTabsFor('AAPL')).toContain('options');
    });
    it('옵션 미상장 주식(TCEHY)은 options 제외 6탭', () => {
        expect(applicableTabsFor('TCEHY')).toHaveLength(6);
        expect(applicableTabsFor('TCEHY')).not.toContain('options');
    });
});

describe('buildPrewarmUniverse', () => {
    it('전체 유닛 수는 스펙 §5와 일치한다 (260×7 + 1×6 + 29×3 = 1913)', () => {
        const universe = buildPrewarmUniverse();
        const units = universe.reduce((n, u) => n + u.tabs.length, 0);
        expect(units).toBe(1913);
    });
    it('화이트리스트 밖 심볼은 없다', () => {
        const universe = buildPrewarmUniverse();
        expect(universe).toHaveLength(290);
    });
});
```

⚠️ 1913·290은 현재 상수 기준(스펙 §5 실측). 상수 목록이 커지면 테스트가 알려주도록 **하드코딩 단언 유지**(스냅샷 개수 회귀 감지 목적) — 단 실패 시 스펙 수치도 함께 갱신하라는 주석을 남긴다.

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/seo-snapshot/__tests__/applicability.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
// 의도적 cross-entity import (eslint entities→entities 허용) — options 서브라우트 게이팅과
// 동일 소스를 써야 sitemap과 적용성이 어긋나지 않는다.
import { POPULAR_OPTIONS_TICKERS } from '@/entities/sitemap-entry/config/popular-options-tickers';
import { SEO_SNAPSHOT_TABS, type SeoSnapshotTab } from '../model';

const CRYPTO_TABS: readonly SeoSnapshotTab[] = ['technical', 'overall', 'news'];
const CRYPTO_SET = new Set<string>(POPULAR_CRYPTOS);
const OPTIONS_SET = new Set<string>(POPULAR_OPTIONS_TICKERS);

/** 자산군별 적용 탭 (spec §5 적용성 매트릭스). 화이트리스트 밖 심볼은 빈 배열. */
export function applicableTabsFor(symbol: string): SeoSnapshotTab[] {
    const upper = symbol.toUpperCase();
    if (CRYPTO_SET.has(upper)) return [...CRYPTO_TABS];
    if (!POPULAR_TICKERS.includes(upper as (typeof POPULAR_TICKERS)[number])) {
        return [];
    }
    if (OPTIONS_SET.has(upper)) return [...SEO_SNAPSHOT_TABS];
    return SEO_SNAPSHOT_TABS.filter(t => t !== 'options');
}

export interface PrewarmSymbol {
    symbol: string;
    tabs: SeoSnapshotTab[];
}

/** 화이트리스트 전체의 prewarm 대상 목록 — 주식 먼저, 크립토 뒤 (주말엔 주식이 fresh라 자동 skip). */
export function buildPrewarmUniverse(): PrewarmSymbol[] {
    const equities = POPULAR_TICKERS.map(symbol => ({
        symbol,
        tabs: applicableTabsFor(symbol),
    }));
    const cryptos = POPULAR_CRYPTOS.map(symbol => ({
        symbol,
        tabs: applicableTabsFor(symbol),
    }));
    return [...equities, ...cryptos];
}
```

⚠️ `POPULAR_TICKERS.includes` 타입 캐스트가 lint에 걸리면 `Set`으로 통일. `POPULAR_TICKERS`/`POPULAR_CRYPTOS`의 실제 export 형태(readonly array)를 열어 맞춘다.

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/seo-snapshot` / Expected: PASS
- [ ] **Step 5: Commit** — `feat(seo-snapshot): applicability matrix + prewarm universe`

### Task 4: 신선도 엔진 (ET 마감 + 30분 버퍼)

**Files:**
- Create: `src/entities/seo-snapshot/lib/freshness.ts`
- Test: `src/entities/seo-snapshot/__tests__/freshness.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — DST 양쪽·주말·버퍼 경계 커버:

```ts
import { describe, expect, it } from 'vitest';
import { lastCompletedEtCloseWithBuffer, isSnapshotFresh } from '../lib/freshness';

describe('lastCompletedEtCloseWithBuffer', () => {
    // EDT(여름): 16:00 ET = 20:00 UTC → 버퍼 포함 경계 20:30 UTC
    it('EDT 평일 21:00 UTC 시점 → 같은 날 20:00 UTC 마감을 반환', () => {
        const now = new Date('2026-07-24T21:00:00Z'); // 금요일
        expect(lastCompletedEtCloseWithBuffer(now)).toEqual(new Date('2026-07-24T20:00:00Z'));
    });
    it('EDT 평일 20:15 UTC(버퍼 미경과) → 전 거래일 마감으로 후퇴', () => {
        const now = new Date('2026-07-24T20:15:00Z');
        expect(lastCompletedEtCloseWithBuffer(now)).toEqual(new Date('2026-07-23T20:00:00Z'));
    });
    it('주말(토) → 금요일 마감', () => {
        const now = new Date('2026-07-25T12:00:00Z'); // 토요일
        expect(lastCompletedEtCloseWithBuffer(now)).toEqual(new Date('2026-07-24T20:00:00Z'));
    });
    it('월요일 아침(마감 전) → 금요일 마감', () => {
        const now = new Date('2026-07-27T13:00:00Z'); // 월요일 09:00 ET
        expect(lastCompletedEtCloseWithBuffer(now)).toEqual(new Date('2026-07-24T20:00:00Z'));
    });
    // EST(겨울): 16:00 ET = 21:00 UTC → 버퍼 경계 21:30 UTC
    it('EST 평일 21:15 UTC(버퍼 미경과) → 전 거래일 21:00 UTC 마감', () => {
        const now = new Date('2026-01-13T21:15:00Z'); // 화요일, EST
        expect(lastCompletedEtCloseWithBuffer(now)).toEqual(new Date('2026-01-12T21:00:00Z'));
    });
});

describe('isSnapshotFresh', () => {
    const boundary = new Date('2026-07-24T20:00:00Z');
    it('경계 이후 생성 → fresh', () => {
        expect(isSnapshotFresh(new Date('2026-07-24T20:01:00Z'), boundary)).toBe(true);
    });
    it('경계 이전 생성 → stale', () => {
        expect(isSnapshotFresh(new Date('2026-07-24T19:59:00Z'), boundary)).toBe(false);
    });
    it('undefined(스냅샷 없음) → stale', () => {
        expect(isSnapshotFresh(undefined, boundary)).toBe(false);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/seo-snapshot/__tests__/freshness.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — DST 판정은 기존 `src/shared/lib/eastern.ts`의 `getEasternOffsetHours(utcDate)`(-4|-5)를 재사용한다. 새 TZ 라이브러리 금지.

```ts
import { getEasternOffsetHours } from '@/shared/lib/eastern';

const CLOSE_HOUR_ET = 16;
const SETTLE_BUFFER_MS = 30 * 60 * 1000; // 30min — EOD 데이터 정착 대기 (spec §6)
const DAY_MS = 24 * 60 * 60 * 1000;

/** 해당 UTC 자정 기준 날짜의 16:00 ET를 UTC Date로. */
function closeUtcFor(utcMidnight: Date): Date {
    const offset = getEasternOffsetHours(utcMidnight); // -4(EDT) | -5(EST)
    return new Date(utcMidnight.getTime() + (CLOSE_HOUR_ET - offset) * 60 * 60 * 1000);
}

function isWeekendEt(closeUtc: Date): boolean {
    // 마감 시각의 ET 요일 = UTC 요일과 동일(16:00 ET는 UTC로 20~21시, 날짜 경계 안 넘음)
    const day = closeUtc.getUTCDay();
    return day === 0 || day === 6;
}

/**
 * "가장 최근에 완료된 ET 정규장 마감(16:00 ET)" — 정착 버퍼 30분이 지난 것만 완료로 본다.
 * 미국 휴장일 캘린더는 의도적으로 없다(spec §6): 휴장일엔 전 거래일과 동일 데이터로
 * 1회 재생성/HIT 수확이 일어날 뿐(무해한 낭비 허용).
 */
export function lastCompletedEtCloseWithBuffer(now: Date): Date {
    // 오늘(UTC) 자정부터 하루씩 후퇴하며 "주중 && now >= close+buffer"인 첫 마감을 찾는다.
    let midnight = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));
    for (let i = 0; i < 7; i++) {
        const close = closeUtcFor(midnight);
        if (!isWeekendEt(close) && now.getTime() >= close.getTime() + SETTLE_BUFFER_MS) {
            return close;
        }
        midnight = new Date(midnight.getTime() - DAY_MS);
    }
    // unreachable (7일 내 주중 마감 항상 존재) — 방어적 반환
    return closeUtcFor(midnight);
}

export function isSnapshotFresh(
    generatedAt: Date | undefined,
    closeBoundary: Date
): boolean {
    if (generatedAt === undefined) return false;
    return generatedAt.getTime() >= closeBoundary.getTime();
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/seo-snapshot` / Expected: PASS (DST 케이스 포함 전부)
- [ ] **Step 5: Commit** — `feat(seo-snapshot): ET-close freshness engine with settle buffer`

### Task 5: Redis 가드 (루트 락 · in-flight · FMP 카운터)

**Files:**
- Create: `src/app/api/cron/seo-prewarm/lock.ts`
- Test: `src/app/api/cron/seo-prewarm/__tests__/lock.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `getRedisClient` mock(vi.mock `@/shared/cache/redisClient`):

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const redis = { set: vi.fn(), del: vi.fn(), get: vi.fn(), incrby: vi.fn() };
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => redis,
}));

import {
    acquirePrewarmLock, releasePrewarmLock,
    markInFlight, isInFlight,
    addFmpBudget, getFmpBudgetUsed,
} from '../lock';

beforeEach(() => vi.clearAllMocks());

describe('prewarm root lock', () => {
    it('acquire는 SET NX EX(900)로 시도하고 성공 시 true', async () => {
        redis.set.mockResolvedValueOnce('OK');
        expect(await acquirePrewarmLock()).toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
            'seo-prewarm:lock', expect.any(String), { nx: true, ex: 900 }
        );
    });
    it('락 보유 중이면 false (2xx no-op 근거 — EventBridge 재시도 폭풍 방지)', async () => {
        redis.set.mockResolvedValueOnce(null);
        expect(await acquirePrewarmLock()).toBe(false);
    });
    it('release는 DEL', async () => {
        await releasePrewarmLock();
        expect(redis.del).toHaveBeenCalledWith('seo-prewarm:lock');
    });
});

describe('in-flight marker', () => {
    it('markInFlight는 30분 TTL로 기록', async () => {
        await markInFlight('AAPL', 'technical');
        expect(redis.set).toHaveBeenCalledWith(
            'seo-prewarm:inflight:AAPL:technical', expect.any(String), { ex: 1800 }
        );
    });
    it('isInFlight는 존재 여부 boolean', async () => {
        redis.get.mockResolvedValueOnce('1');
        expect(await isInFlight('AAPL', 'technical')).toBe(true);
    });
});

describe('FMP daily budget', () => {
    it('addFmpBudget은 날짜 키에 incrby + 자정만료 TTL', async () => {
        redis.incrby.mockResolvedValueOnce(22);
        await addFmpBudget(22);
        expect(redis.incrby).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/app/api/cron/seo-prewarm` / Expected: FAIL

- [ ] **Step 3: 구현** — Upstash 클라이언트 메서드 시그니처는 `src/shared/cache/redisClient.ts`와 기존 사용처(`getOrSetCache`)에서 확인해 맞춘다. redis null(미설정 env)이면 락은 **false 반환**(cron 환경에서 redis 없으면 실행 불가 — 로그 후 no-op), in-flight는 false, 카운터는 no-op:

```ts
import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';

const LOCK_KEY = 'seo-prewarm:lock';
const LOCK_TTL_SECONDS = 900; // 15min ≥ 최대 배치 시간 (spec §6 락 라이프사이클)
const INFLIGHT_TTL_SECONDS = 1800; // 30min
const FMP_BUDGET_TTL_SECONDS = 172800; // 2d — 날짜 키라 자연 롤오버, TTL은 청소용

export async function acquirePrewarmLock(): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) {
        console.error('[seo-prewarm] redis unavailable — cannot run');
        return false;
    }
    const result = await redis.set(LOCK_KEY, String(Date.now()), {
        nx: true,
        ex: LOCK_TTL_SECONDS,
    });
    return result === 'OK';
}

export async function releasePrewarmLock(): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.del(LOCK_KEY);
}

export async function markInFlight(symbol: string, tab: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.set(`seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`, '1', {
        ex: INFLIGHT_TTL_SECONDS,
    });
}

export async function isInFlight(symbol: string, tab: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    const value = await redis.get(
        `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`
    );
    return value !== null;
}

function fmpBudgetKey(now = new Date()): string {
    return `seo-prewarm:fmp-budget:${now.toISOString().slice(0, 10)}`;
}

export async function addFmpBudget(calls: number): Promise<number> {
    const redis = getRedisClient();
    if (redis === null) return 0;
    const key = fmpBudgetKey();
    const total = await redis.incrby(key, calls);
    await redis.expire(key, FMP_BUDGET_TTL_SECONDS);
    return total;
}

export async function getFmpBudgetUsed(): Promise<number> {
    const redis = getRedisClient();
    if (redis === null) return 0;
    const value = await redis.get(fmpBudgetKey());
    return typeof value === 'number' ? value : Number(value ?? 0);
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/api/cron/seo-prewarm` / Expected: PASS
- [ ] **Step 5: Commit** — `feat(seo-prewarm): redis root lock, in-flight marker, fmp budget counter`

### Task 6: prewarm seam — technical (완전 구현 예시)

**Files:**
- Create: `src/entities/analysis/lib/prewarmSubmits.ts`
- Test: `src/entities/analysis/__tests__/lib/prewarmSubmits.test.ts`

**설계 원칙 (전 seam 공통 — spec §4 NB-1)**: request-context 호출(`headers()`/`cookies()`/`getCurrentUser()`/`isBot()`) **0건**. 익명 free 방문자의 액션이 만드는 core 호출을 그대로 재현하되 `skipEnqueueIfMiss: false` + `force` 파라미터만 다르다. `'use server'` 선언 금지(server action 아님), `import 'server-only'` 선언, barrel 미노출(cron 라우트가 deep import).

- [ ] **Step 1: 실패하는 테스트 작성** — core `submitAnalysis`를 mock하고 인자 검증:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const submitAnalysis = vi.fn();
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    submitAnalysis: (...args: unknown[]) => submitAnalysis(...args),
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us_equity'),
}));
// getCachedMarketDataProvider / sessionSpecFor / getDescriptor 도 동일하게 mock
// (submitAnalysisAction.test.ts의 기존 mock 세트를 그대로 복사해 재사용)

import { prewarmTechnical } from '../../lib/prewarmSubmits';

beforeEach(() => vi.clearAllMocks());

describe('prewarmTechnical', () => {
    it('익명 free 컨텍스트 고정 + skipEnqueueIfMiss:false로 core를 호출한다', async () => {
        submitAnalysis.mockResolvedValueOnce({ status: 'submitted', jobId: 'j1' });
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, false);
        expect(submitAnalysis).toHaveBeenCalledWith(
            'AAPL', 'Apple Inc.', '1Day', false, undefined,
            expect.objectContaining({
                skipEnqueueIfMiss: false,
                tierContext: { userId: null, tier: 'free' },
                reasoning: false,
                positionBucket: undefined,
            })
        );
    });
    it('force=true 전달 시 캐시 우회 재생성', async () => {
        submitAnalysis.mockResolvedValueOnce({ status: 'submitted', jobId: 'j2' });
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, true);
        expect(submitAnalysis.mock.calls[0][3]).toBe(true); // force positional
    });
    it('request-context 모듈을 import하지 않는다 (정적 보증)', async () => {
        const source = await import('node:fs/promises').then(fs =>
            fs.readFile('src/entities/analysis/lib/prewarmSubmits.ts', 'utf8')
        );
        expect(source).not.toMatch(/next\/headers|getCurrentUser|isBot/);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/analysis/__tests__/lib/prewarmSubmits.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — `submitAnalysisAction.ts:174-207`의 익명(anonymous, modelId=undefined) 브랜치를 request-context 없이 재현:

```ts
import 'server-only';
import {
    submitAnalysis,
    type SubmitAnalysisGatedResult,
} from '@y0ngha/siglens-core';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';

/**
 * SEO pre-warm 전용 technical submit (spec 2026-07-24 §4 seam).
 * 익명 free 방문자의 submitAnalysisAction 익명 브랜치와 동일한 core 호출을
 * 재현한다(캐시 키 5축 정합: model default / tier free / reasoning false /
 * no bucket / 동일 core fingerprint). 차이는 skipEnqueueIfMiss:false(항상
 * enqueue)와 force 뿐. request-context(headers/getCurrentUser/isBot) 호출
 * 금지 — cron의 after() 컨텍스트에서 실행된다.
 */
export async function prewarmTechnical(
    symbol: string,
    companyName: string,
    fmpSymbol: string | undefined,
    force: boolean
): Promise<SubmitAnalysisGatedResult> {
    const marketProfile = await resolveMarketProfile(symbol);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const marketDataProvider = getCachedMarketDataProvider(
        sessionSpecFor(marketProfile)
    );
    return submitAnalysis(symbol, companyName, '1Day', force, fmpSymbol, {
        skipEnqueueIfMiss: false,
        marketDataProvider,
        assetClass,
        tierContext: { userId: null, tier: 'free' },
        reasoning: false,
        positionBucket: undefined,
    });
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/analysis/__tests__/lib/prewarmSubmits.test.ts` / Expected: PASS
- [ ] **Step 5: Commit** — `feat(analysis): prewarmTechnical server-only seam`

### Task 7: prewarm seam — 나머지 6탭

**Files:**
- Modify: `src/entities/analysis/lib/prewarmSubmits.ts` (overall·fundamental·financials·congress 추가)
- Create: `src/entities/news-article/lib/prewarmSubmitNews.ts`
- Create: `src/entities/options-chain/lib/prewarmSubmitOptions.ts`
- Test: `src/entities/analysis/__tests__/lib/prewarmSubmits.test.ts` (확장) + 각 entity 테스트

**공통 레시피** — 각 액션 파일의 비봇(non-bot) 경로를 다음 치환표로 재현한다 (Task 6과 동일 원칙·동일 테스트 패턴):

| 액션 코드 | prewarm seam |
|---|---|
| `await getCurrentUser()` → userId | `userId = null` 상수 |
| `resolveTierOnly(userId)` / `resolveTierAndByok(...)` | `tier = 'free'` 상수 (BYOK 게이트 없음 — modelId 기본값 사용) |
| `await headers()` + `isBot(...)` → skipEnqueueIfMiss | `skipEnqueueIfMiss: false` 상수 |
| `resolveReasoning(tier, x)` | `false` 상수 |
| `isE2E()` 브랜치 | 제거 (cron은 프로덕션 전용; E2E에서 cron 라우트는 스킵) |
| `options.force` | 함수 파라미터 `force: boolean` 그대로 스레딩 |

- [ ] **Step 1: `prewarmOverall` 추가** — `submitOverallAnalysisAction.ts:91-183`의 비봇 경로 재현. **주의: 봇 게이트로 skip되던 options/financials fetch가 prewarm에선 실행된다(의도됨 — spec §8 FMP 산정에 포함).** 시그니처와 core 호출:

```ts
export async function prewarmOverall(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<SubmitOverallAnalysisResult> {
    // submitOverallAnalysisAction.ts:91-160 의 데이터 수집 블록을 그대로 복사하되
    // skipEnqueueIfMiss 조건 분기는 "항상 fetch"로 단순화한다:
    //   optionsSnapshotPromise = fetchOptionsSnapshot(symbol).catch(...→null)
    //   financialsScorecardPromise = getFinancialsSnapshot(symbol).then(computeFinancialsScorecard).catch(...→undefined)
    //   [rows, next, optionsSnapshot, financialsScorecard] = Promise.all([...])  // 동일
    //   enrichedNews = buildAnalysisNewsItems(rows)                              // 동일
    //   optionsOiStale 계산                                                        // 동일 (:147-150)
    //   marketProfile/assetClass/marketDataProvider                              // 동일 (:156-160)
    // 그리고 core 호출 (:162-183)을 아래 고정 컨텍스트로:
    return submitOverallAnalysis({
        symbol, companyName, timeframe: '1Day', modelId: undefined,
        fundamentalProvider: getFundamentalDataProvider(),
        marketDataProvider,
        newsItems: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        technical: { tierContext: { userId: null, tier: 'free' } },
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        assetClass,
        optionsSnapshot: optionsSnapshot ?? undefined,
        optionsOiStale,
        financialsScorecard,
        ...(force ? { force: true } : {}),
    });
}
```

⚠️ `modelId: undefined`가 core에서 기본 모델(DEEPSEEK_V4_FLASH)로 해석되는지 core 타입(`SubmitOverallAnalysisOptions`)에서 확인 — 액션이 modelId를 명시 인자로 받으므로, 익명 클라이언트가 실제로 보내는 기본값과 동일하게 맞춘다(클라 호출부 `useOverallAnalysis` 훅에서 기본 modelId 확인).

- [ ] **Step 2: `prewarmFundamental`/`prewarmFinancials`/`prewarmCongress` 추가** — 각각 `submitFundamentalAnalysisAction.ts`·`submitFinancialsAnalysisAction.ts`·`submitCongressTrendAction.ts`의 비봇 경로를 치환표로 재현. 각 core 함수의 options 객체에 `force`가 있음(3차 검토 확정: core types.d.ts fundamental :57 / financials :56 / congress :34). 함수 시그니처는 통일: `(symbol: string, companyName: string, force: boolean)` (+액션이 요구하는 추가 인자 있으면 액션과 동일하게).

- [ ] **Step 3: `prewarmSubmitNews`(news-article entity)·`prewarmSubmitOptions`(options-chain entity) 생성** — 동일 레시피. **news도 core `SubmitNewsAnalysisOptions.force`가 존재**(core news types.d.ts:60 — 4차 정합성 검증으로 확정, spec §6 v3.1) — 다른 평탄 TTL 탭과 동일하게 `prewarmNews(symbol: string, companyName: string, force: boolean)` 시그니처로 force를 스레딩한다. options 액션(`optionsActions.ts`)은 `cookies()`도 쓴다 — 치환표대로 제거하고 익명 기본값 고정.

- [ ] **Step 4: 각 seam 테스트** — Task 6 Step 1과 동일 패턴(core 함수 mock + 고정 컨텍스트 인자 단언 + force 스레딩 + request-context 정적 보증 grep)을 seam마다 1세트. Run: `yarn test src/entities/analysis src/entities/news-article/__tests__ src/entities/options-chain/__tests__` / Expected: PASS

- [ ] **Step 5: 기존 액션 테스트 무회귀 확인** — Run: `yarn test src/entities/analysis src/entities/news-article src/entities/options-chain` / Expected: 전부 PASS (액션 파일은 무변경이므로 당연 통과 — 실패 시 STOP)

- [ ] **Step 6: Commit** — `feat(prewarm): server-only submit seams for all 7 tabs`

### Task 8: cron 라우트 골격 (인증→락→202→after)

**Files:**
- Create: `src/app/api/cron/seo-prewarm/route.ts`
- Test: `src/app/api/cron/seo-prewarm/__tests__/route.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const runPrewarmBatch = vi.fn().mockResolvedValue({ submitted: 0, harvested: 0, revalidated: 0, remaining: 0, fmpBudgetUsed: 0 });
vi.mock('../runPrewarmBatch', () => ({ runPrewarmBatch: (...a: unknown[]) => runPrewarmBatch(...a) }));

const lock = { acquirePrewarmLock: vi.fn(), releasePrewarmLock: vi.fn() };
vi.mock('../lock', () => lock);

const afterCallbacks: Array<() => Promise<void>> = [];
vi.mock('next/server', async importOriginal => ({
    ...(await importOriginal<object>()),
    after: (cb: () => Promise<void>) => { afterCallbacks.push(cb); },
}));

import { PATCH } from '../route';

function makeRequest(auth?: string): Request {
    return new Request('http://localhost/api/cron/seo-prewarm', {
        method: 'PATCH',
        headers: auth ? { authorization: auth } : {},
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    process.env.CRON_SECRET = 'test-secret';
});

describe('PATCH /api/cron/seo-prewarm', () => {
    it('CRON_SECRET 미설정 → 401 (fail-closed)', async () => {
        delete process.env.CRON_SECRET;
        expect((await PATCH(makeRequest('Bearer x'))).status).toBe(401);
    });
    it('잘못된 Bearer → 401', async () => {
        expect((await PATCH(makeRequest('Bearer wrong'))).status).toBe(401);
    });
    it('락 보유 중 → 204 (2xx — EventBridge 재시도 방지, spec §6)', async () => {
        lock.acquirePrewarmLock.mockResolvedValueOnce(false);
        expect((await PATCH(makeRequest('Bearer test-secret'))).status).toBe(204);
        expect(afterCallbacks).toHaveLength(0);
    });
    it('정상 → 202 즉시 + after()에 배치 등록, 배치 완료 시 락 해제', async () => {
        lock.acquirePrewarmLock.mockResolvedValueOnce(true);
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(202);
        expect(afterCallbacks).toHaveLength(1);
        await afterCallbacks[0]();
        expect(runPrewarmBatch).toHaveBeenCalled();
        expect(lock.releasePrewarmLock).toHaveBeenCalled();
    });
    it('배치가 throw해도 락은 해제된다', async () => {
        lock.acquirePrewarmLock.mockResolvedValueOnce(true);
        runPrewarmBatch.mockRejectedValueOnce(new Error('boom'));
        await PATCH(makeRequest('Bearer test-secret'));
        await afterCallbacks[0]();
        expect(lock.releasePrewarmLock).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/app/api/cron/seo-prewarm/__tests__/route.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — timingSafeEqual 비교는 `cleanupExpiredSessionsAction.ts`의 `safeBearerCompare`와 동일 구현(재사용 가능하면 shared로 승격하지 말고 — 3번째 사용 전 — 로컬 복사 + 출처 주석):

```ts
import { timingSafeEqual } from 'crypto';
import { after } from 'next/server';
import { acquirePrewarmLock, releasePrewarmLock } from './lock';
import { runPrewarmBatch } from './runPrewarmBatch';

/** cleanupExpiredSessionsAction의 safeBearerCompare와 동일 — 3번째 사용처가 생기면 shared로 승격. */
function safeBearerCompare(actual: string | null, expected: string): boolean {
    if (actual === null) return false;
    const a = Buffer.from(actual);
    const b = Buffer.from(`Bearer ${expected}`);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/**
 * SEO pre-warm cron 엔드포인트 (spec 2026-07-24 §6).
 * EventBridge API Destination(~5s 타임아웃)·ALB idle 60s를 피하기 위해
 * 202를 즉시 반환하고 배치는 after()로 백그라운드 실행한다. 중첩 실행은
 * Redis 루트 락이 차단하며, 락 보유 중엔 204(2xx — EventBridge 재시도 방지).
 */
export async function PATCH(request: Request): Promise<Response> {
    const expected = process.env.CRON_SECRET;
    if (!expected) return new Response(null, { status: 401 });
    if (!safeBearerCompare(request.headers.get('authorization'), expected)) {
        return new Response(null, { status: 401 });
    }

    if (!(await acquirePrewarmLock())) {
        return new Response(null, { status: 204 });
    }

    after(async () => {
        try {
            const counts = await runPrewarmBatch();
            console.log('[seo-prewarm] batch done:', JSON.stringify(counts));
        } catch (error) {
            console.error('[seo-prewarm] batch failed:', error);
        } finally {
            await releasePrewarmLock();
        }
    });

    return new Response(null, { status: 202 });
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/api/cron/seo-prewarm` / Expected: PASS
- [ ] **Step 5: Commit** — `feat(seo-prewarm): cron route skeleton (auth + lock + 202/after)`

### Task 9: 배치 오케스트레이션 `runPrewarmBatch`

**Files:**
- Create: `src/app/api/cron/seo-prewarm/runPrewarmBatch.ts`
- Test: `src/app/api/cron/seo-prewarm/__tests__/runPrewarmBatch.test.ts`

**로직 (spec §6)**: ① 신선도 경계 계산 → ② universe에서 stale 유닛 보유 심볼 최대 10개 선정 → ③ 심볼 동시성 3으로, 심볼 내 탭 순서 `technical→fundamental→financials→congress→news→options→overall`(overall 마지막 — Redis HIT 유도) 직렬 실행 → ④ 결과 판정: `cached`이고 콘텐츠 자체 시각 ≥ 경계 → 수확(upsert)+in-flight 해제 / `cached`인데 stale → **force 재호출 1회**(news 제외) / `submitted` → in-flight 마커 / 기타 → 로그 → ⑤ 심볼의 적용 탭 전부 fresh면 `revalidateTag('seo-snapshot:'+SYM, 'max')` + 적용 라우트 `revalidatePath` → ⑥ 카운트 반환.

- [ ] **Step 1: 실패하는 테스트 작성** — 모든 seam·repository·lock·revalidate mock. 핵심 케이스:

```ts
// mock 대상: ../lock, next/cache(revalidateTag/revalidatePath),
// @/entities/seo-snapshot(model/lib), @/entities/seo-snapshot/api,
// @/shared/db/client, 7개 prewarm seam 모듈
// 케이스:
it('fresh 심볼은 배치에서 제외된다 (마감 전 전량 fresh → no-op, submitted:0)', ...);
it('cached+신선 결과는 upsert되고 심볼 완료 시 revalidateTag/Path가 호출된다', ...);
it('cached+stale 결과는 force로 1회 재호출된다 (news는 force 없이 정직 저장)', ...);
it('submitted 결과는 in-flight 마커만 남긴다 (upsert 없음)', ...);
it('in-flight 유닛은 이번 틱에서 skip된다', ...);
it('심볼 10개 상한을 지킨다', ...);
it('한 심볼의 seam 실패는 다른 심볼 진행을 막지 않는다 (fail-open)', ...);
```

각 케이스는 Task 8 테스트와 동일한 vi.mock 스타일로 작성한다 — mock 세트가 크므로 파일 상단에 한 번 정의하고 `beforeEach`로 리셋.

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/app/api/cron/seo-prewarm/__tests__/runPrewarmBatch.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — 골격 (탭→seam 매핑·수확 판정·동시성 3):

```ts
import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import {
    buildPrewarmUniverse,
    type PrewarmSymbol,
} from '@/entities/seo-snapshot/lib/applicability';
import {
    lastCompletedEtCloseWithBuffer,
    isSnapshotFresh,
} from '@/entities/seo-snapshot/lib/freshness';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';
import { addFmpBudget, getFmpBudgetUsed, isInFlight, markInFlight } from './lock';
import {
    prewarmTechnical, prewarmOverall, prewarmFundamental,
    prewarmFinancials, prewarmCongress,
} from '@/entities/analysis/lib/prewarmSubmits';
import { prewarmNews } from '@/entities/news-article/lib/prewarmSubmitNews';
import { prewarmOptions } from '@/entities/options-chain/lib/prewarmSubmitOptions';

const SYMBOLS_PER_TICK = 10; // spec §6 용량 모델
const SYMBOL_CONCURRENCY = 3; // spec §8 순간 FMP 버스트 캡 (3×13≈40)
// overall 마지막 — 심볼 데이터(bars/scorecard)가 Redis HIT되도록 (spec §6)
const TAB_ORDER: readonly SeoSnapshotTab[] = [
    'technical', 'fundamental', 'financials', 'congress', 'news', 'options', 'overall',
];

export interface PrewarmBatchCounts {
    submitted: number;
    harvested: number;
    revalidated: number;
    remaining: number;
    fmpBudgetUsed: number;
}

// 탭별 심볼 페이지 라우트 (revalidatePath 대상)
const TAB_PATHS: Record<SeoSnapshotTab, (s: string) => string> = {
    technical: s => `/${s}`,
    overall: s => `/${s}/overall`,
    fundamental: s => `/${s}/fundamental`,
    financials: s => `/${s}/financials`,
    congress: s => `/${s}/congress`,
    news: s => `/${s}/news`,
    options: s => `/${s}/options`,
};

export async function runPrewarmBatch(): Promise<PrewarmBatchCounts> {
    const boundary = lastCompletedEtCloseWithBuffer(new Date());
    const universe = buildPrewarmUniverse();
    const { db } = getDatabaseClient();
    const repo = new DrizzleSeoSnapshotRepository(db);
    const generatedAtMap = await repo.findGeneratedAtMap(
        universe.map(u => u.symbol)
    );

    // stale 유닛이 남은 심볼만, 등록 순서 유지로 상한 선정
    const staleSymbols = universe.filter(u =>
        u.tabs.some(tab => !isSnapshotFresh(generatedAtMap.get(`${u.symbol}:${tab}`), boundary))
    );
    const batch = staleSymbols.slice(0, SYMBOLS_PER_TICK);
    const counts: PrewarmBatchCounts = {
        submitted: 0, harvested: 0, revalidated: 0,
        remaining: Math.max(0, staleSymbols.length - batch.length),
        fmpBudgetUsed: 0,
    };

    // 심볼 동시성 3 — p-limit 대신 단순 청크(의존 추가 없이 상한 보장)
    for (let i = 0; i < batch.length; i += SYMBOL_CONCURRENCY) {
        await Promise.all(
            batch.slice(i, i + SYMBOL_CONCURRENCY).map(u =>
                processSymbol(u, boundary, generatedAtMap, repo, counts).catch(
                    error => console.error(`[seo-prewarm] ${u.symbol} failed:`, error)
                )
            )
        );
    }
    counts.fmpBudgetUsed = await getFmpBudgetUsed();
    return counts;
}
```

`processSymbol`은 TAB_ORDER 직렬 루프: stale 탭만, `isInFlight` skip, seam 호출 → 결과 판정 → 판정 함수 `resolveHarvest(result, boundary)`:

```ts
/**
 * seam 결과 판정 (spec §6 수확 규칙).
 * - cached + 콘텐츠 자체 생성 시각 ≥ boundary → { kind: 'harvest', content, generatedAt }
 * - cached + stale → { kind: 'stale_cached' } (호출부가 force 재시도 1회 — 평탄 TTL 5탭
 *   전부, news 포함: core force가 7탭 전부 지원됨이 확정, spec §6 v3.1)
 * - submitted → { kind: 'in_flight' }
 * - 그 외(error/miss_no_trigger) → { kind: 'skip' }
 * 콘텐츠 생성 시각 필드는 탭별 core 결과 타입에서 확인해 확정한다. 판정 규칙:
 * KST-앵커 탭(technical/overall)은 cached=항상 신선(마감 직후 만료 — spec §6)이라
 * 시각 필드 불요. 평탄 TTL 5탭은 시각 필드가 있으면 boundary 비교, 없으면
 * "stale 가능성 불명 → 무조건 force 재시도 1회"로 통일(불명을 신선으로 오인 금지).
 */
```

수확 시: `repo.upsert(...)` 후 심볼 전 탭 fresh 확인 → `revalidateTag('seo-snapshot:' + symbol, 'max')` + 적용 탭 `revalidatePath(TAB_PATHS[tab](symbol))` (Next 16 revalidateTag는 2-인자 — app/CLAUDE.md 축 1).

**추가 규칙 3가지 (스펙 §6·§8)**:
1. **companyName·fmpSymbol 해석**: universe에는 심볼만 있다. `processSymbol` 진입 시 자산 표시명·fmpSymbol을 기존 자산 조회 lib(심볼 페이지가 쓰는 `getAssetInfoResilient` 경로 — `grep -rn "getAssetInfoResilient" src`로 위치 확정, server-only deep import)로 1회 해석하고 탭 전체에 재사용한다. 해석 실패 시 `companyName = symbol`로 degrade(분석 품질 저하일 뿐 차단 아님), fmpSymbol은 `undefined`.
2. **FMP 예산 추정 기록**: 정밀 계측 대신 심볼 처리 완료마다 `addFmpBudget(22)`(주식)/`addFmpBudget(2)`(크립토) — 스펙 §8 산정치 기반 추정 카운터. 목적은 모니터링·중단 판단이지 회계가 아니다(주석 명시).
3. **에러 격리 — 402는 중단 아님 (사용자 정책, spec §8 v3.1)**: 402는 특정 심볼 국소 이슈다. seam 결과/throw를 유닛 단위 try/catch로 격리하고: **402**(`getFmpErrorStatus(error) === 402` — `src/shared/api/fmp/fmpUserMessage.ts:54` 기존 헬퍼 재사용, 신규 판별 함수 금지) → 해당 유닛 skip + `[seo-prewarm] fmp-402 {symbol}:{tab}` 로그 후 **배치 계속**. **429** → `fmpRetry` 백오프가 이미 처리(추가 로직 없음). **500·예상치 못한 4xx** → 유닛 skip + 에러 로그 후 배치 계속(이전 스냅샷 유지 = fail-open). 배치 전체를 죽이는 예외 전파 금지. 테스트 케이스: `it('402/500 유닛은 격리되고 나머지 유닛·심볼은 계속 처리된다', ...)`.

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/api/cron/seo-prewarm` / Expected: PASS
- [ ] **Step 5: 스코프 게이트** — Run: `yarn tsc --noEmit && yarn lint src/app/api/cron src/entities/seo-snapshot src/entities/analysis/lib` / Expected: 클린
- [ ] **Step 6: Commit** — `feat(seo-prewarm): batch orchestration (select→run→harvest→revalidate)`

### Task 10: AWS 인프라 스크립트 + CRON.md 개정

**Files:**
- Create: `infra/aws/13-seo-prewarm.sh`
- Modify: `docs/reference/CRON.md`

- [ ] **Step 1: 13-seo-prewarm.sh 작성** — 기존 스크립트 컨벤션(`lib.sh` 소싱, idempotent, 리소스 존재 시 skip)을 `12-isr-cache.sh`에서 확인해 동일 구조로. 내용:

```bash
#!/usr/bin/env bash
# EventBridge → API Destination → PATCH /api/cron/seo-prewarm (spec 2026-07-24 §6)
# 리소스: Connection(Bearer CRON_SECRET) + ApiDestination + Rule 2개(UTC 고정)
# ⚠️ repo 최초의 EventBridge 사용 — 배포 전 소규모 실검증 필수 (spec §11 딜리버리 스파이크)
set -euo pipefail
source "$(dirname "$0")/lib.sh"

CRON_SECRET="$(aws ssm get-parameter --name /siglens/CRON_SECRET --with-decryption --query 'Parameter.Value' --output text)"

# 1) Connection (API_KEY 타입 — Authorization 헤더에 Bearer 주입)
aws events create-connection \
  --name siglens-seo-prewarm \
  --authorization-type API_KEY \
  --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer ${CRON_SECRET}}"

# 2) API Destination
aws events create-api-destination \
  --name siglens-seo-prewarm \
  --connection-arn "<connection-arn>" \
  --invocation-endpoint "https://siglens.io/api/cron/seo-prewarm" \
  --http-method PATCH \
  --invocation-rate-limit-per-second 1

# 3) Rules — UTC 고정 (spec §6: 20:00~03:59 UTC, 5분 간격)
aws events put-rule --name siglens-seo-prewarm-evening \
  --schedule-expression "cron(0/5 20-23 * * ? *)"
aws events put-rule --name siglens-seo-prewarm-early \
  --schedule-expression "cron(0/5 0-3 * * ? *)"
# 각 rule에 put-targets로 API Destination 연결 (+ DLQ 없이 — 실패는 다음 틱이 흡수)
```

실제 작성 시: connection-arn 캡처·rule→target 연결·존재-검사 idempotency·IAM 롤(InvokeApiDestination)을 `lib.sh` 헬퍼 스타일로 완성한다. `04-params.sh`가 CRON_SECRET을 SSM에 이미 싣는지 확인(check-env가 .env.example에서 required 도출 — 3차 검토 N3), 없으면 값 주입 안내 echo.

- [ ] **Step 2: dry-run 검증** — Run: `bash -n infra/aws/13-seo-prewarm.sh` / Expected: 문법 클린. (실 AWS 실행은 배포 단계 — 사용자 개입)

- [ ] **Step 3: CloudWatch 알람 2종 추가 (스펙 §9 v3.1)** — `infra/aws/07-alarms.sh`의 기존 알람 패턴(로그 메트릭 필터→알람→SNS/ALARM_EMAIL)을 확인해 동일 방식으로 13-seo-prewarm.sh에 포함: ① 앱 로그 `"[seo-prewarm] batch failed"` 필터 — 3회/1h 초과 시 알람, ② FMP **429** 버스트 필터 — 임계(예: 10회/10분) 초과 시 알람. **402는 알람 제외**(심볼 국소 이슈 — `fmp-402` 로그 분류만, 사용자 정책). 로그 그룹 이름은 `10-logs.sh`에서 확인.

- [ ] **Step 4: CRON.md 개정** — GitHub Actions/Vercel 패턴 기술을 AWS EventBridge 패턴으로 교체하고 seo-prewarm 엔트리 추가(스케줄·엔드포인트·시크릿·모니터링 카운트 로그·알람).

- [ ] **Step 5: Commit** — `feat(infra): EventBridge seo-prewarm schedule + alarms + CRON.md AWS 개정`

### Task 11: Phase 1 마무리 게이트

- [ ] **Step 1: 스코프 전체 테스트** — Run: `yarn test src/entities/seo-snapshot src/entities/analysis src/entities/news-article src/entities/options-chain src/app/api/cron` / Expected: 전부 PASS
- [ ] **Step 2: 커버리지 (spec §10 ~90%)** — Run: `yarn test-coverage` 후 신규 파일들의 커버리지 확인 / Expected: 신규 모듈 라인 커버리지 ≥90% (미달 모듈은 케이스 보강)
- [ ] **Step 3: 타입 게이트** — Run: `yarn tsc --noEmit` / Expected: 에러 0 (테스트 파일 포함)
- [ ] **Step 4: 린트** — Run: `yarn lint` / Expected: 에러 0 (FSD 경계 위반 포함)
- [ ] **Step 5: PR 전 프로토콜** — 아래 「PR 전 감사·실증 프로토콜」 섹션 수행 (review-agent 단독 루프를 대체하는 확장 게이트)

---

## PR 전 감사·실증 프로토콜 (사용자 지정 — Phase 1·2 각 PR 직전 공통)

**A. 5종 fresh-context 감사 (전부 Opus 4.8, 이 세션 컨텍스트 미주입·독립 진입):**
1. `review-agent` — 코드 감사
2. 일반 agent — 변경사항 배포 안정성 감사
3. 일반 agent — "지금 배포한다고 가정"한 운영 준비 감사 (env/SSM/인프라 부트스트랩/롤백 경로)
4. 일반 agent — `seo-audit` 스킬 사용, 현재 SEO 상태 감사
5. 일반 agent — 테스트 커버리지 ≥90% + worst case·edge case·integration·e2e 커버 감사

**루프 규칙**: findings → 수정(구현은 Sonnet sub-agent) → **findings 0이 될 때까지 반복**. 직전 라운드에서 findings 0(Approved)인 에이전트는 **재스폰하지 않는다**.

**B. 실증 (전부 Opus 4.8):**
1. 변경 범위 실증용 Spec 작성 + **Test Case를 먼저 생성**
2. prod-like 빌드(`yarn build` → `yarn start`; 빌드 exit code는 파이프 없이 직접 캡처) 후 Test Case를 따라:
   - **curl**: 응답값·status code·meta robots·SSR 가시 텍스트·robots.txt·x-nextjs-cache
   - **Chrome 도구**: 실페이지 렌더·스냅샷 섹션 가시성·hydration 후 무회귀
3. 발견 문제 수정 → 해당 감사/실증 재실행

**C. 완료 후**: mistake-managing-agent → git-agent(PR 생성).
