import { and, eq, gte, inArray } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { KR_SYMBOL_RE } from '@/shared/config/ticker';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { seoAnalysisSnapshots } from '@/shared/db/schema';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import type { SiglensDatabase } from '@/shared/db/types';

const generatedAt = new Date('2026-07-24T00:00:00.000Z');
const updatedAt = new Date('2026-07-24T00:00:01.000Z');

/**
 * `findBySymbol`은 **컬럼을 명시해서** 읽으므로 `id` 같은 DB 내부 컬럼은
 * 결과에 오지 않는다 — bare `select()`는 스키마에 컬럼이 추가되는 순간
 * 마이그레이션 전 배포에서 통째로 실패하기 때문이다.
 */
const snapshotRow = {
    symbol: 'AAPL',
    tab: 'technical',
    content: { summary: 'bullish' },
    model: 'deepseek-v4.1-flash',
    generatedAt,
    updatedAt,
    locale: 'ko',
};

const UPSERT_INPUT = {
    symbol: 'aapl',
    tab: 'technical' as const,
    locale: 'ko' as const,
    content: { summary: 'bullish' },
    plain: null,
    model: 'deepseek-v4.1-flash',
    generatedAt,
};

function makeUpsertDb(): {
    db: SiglensDatabase;
    values: ReturnType<typeof vi.fn>;
    onConflictDoUpdate: ReturnType<typeof vi.fn>;
} {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        values,
        onConflictDoUpdate,
    };
}

function makeFindBySymbolDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        where,
    };
}

describe('DrizzleSeoSnapshotRepository.upsert', () => {
    it('uppercases the symbol and calls onConflictDoUpdate targeting (symbol, tab, locale)', async () => {
        const { db, values, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleSeoSnapshotRepository(db);

        await repo.upsert(UPSERT_INPUT);

        const [insertedValues] = values.mock.calls[0] ?? [];
        expect(insertedValues).toMatchObject({
            symbol: 'AAPL',
            tab: 'technical',
            content: { summary: 'bullish' },
            model: 'deepseek-v4.1-flash',
            generatedAt,
        });
        expect(
            (insertedValues as { updatedAt: Date }).updatedAt
        ).toBeInstanceOf(Date);

        const [conflictArgs] = onConflictDoUpdate.mock.calls[0] ?? [];
        const { target, set } = conflictArgs as {
            target: unknown[];
            set: {
                content: unknown;
                model: string;
                generatedAt: Date;
                updatedAt: Date;
            };
        };
        // 스위치와 무관하게 3열이다 — 2열로 돌아가면 0030을 적용할 수 있는
        // 시점이 사라진다(스위치 ON = 비-ko 쓰기 시작 = 구 unique와 23505 충돌).
        expect(target).toEqual([
            seoAnalysisSnapshots.symbol,
            seoAnalysisSnapshots.tab,
            seoAnalysisSnapshots.locale,
        ]);
        expect(set.content).toEqual({ summary: 'bullish' });
        expect(set.model).toBe('deepseek-v4.1-flash');
        expect(set.generatedAt).toBe(generatedAt);
        expect(set.updatedAt).toBeInstanceOf(Date);
    });
});

describe('DrizzleSeoSnapshotRepository.findBySymbol', () => {
    it('queries with the uppercased symbol and returns rows', async () => {
        const rows = [snapshotRow, { ...snapshotRow, tab: 'overall' }];
        const { db, where } = makeFindBySymbolDb(rows);
        const repo = new DrizzleSeoSnapshotRepository(db);

        const result = await repo.findBySymbol('aapl', 'ko');

        expect(result).toEqual(rows);
        expect(where.mock.calls[0]?.[0]).toEqual(
            eq(seoAnalysisSnapshots.symbol, 'AAPL')
        );
    });

    it('reader mode drops languages the reader cannot read (ko reader, ja-only row)', async () => {
        const { db } = makeFindBySymbolDb([{ ...snapshotRow, locale: 'ja' }]);
        const repo = new DrizzleSeoSnapshotRepository(db);

        await expect(repo.findBySymbol('AAPL', 'ko')).resolves.toEqual([]);
    });

    it('anyLocale picks the freshest row per tab in any language — a newer ja row beats an older ko row for a ko asker', async () => {
        const older = new Date('2026-09-10T00:00:00.000Z');
        const newer = new Date('2026-09-12T00:00:00.000Z');
        const rows = [
            {
                ...snapshotRow,
                locale: 'ko',
                generatedAt: older,
                content: { v: 'ko-old' },
            },
            {
                ...snapshotRow,
                locale: 'ja',
                generatedAt: newer,
                content: { v: 'ja-new' },
            },
            {
                ...snapshotRow,
                tab: 'news',
                locale: 'zh',
                generatedAt: older,
                content: { v: 'zh-only' },
            },
        ];
        const repo = new DrizzleSeoSnapshotRepository(
            makeFindBySymbolDb(rows).db
        );

        const ko = await repo.findBySymbol('AAPL', 'ko', { anyLocale: true });
        expect(ko).toHaveLength(2);
        expect(ko.find(s => s.tab === 'technical')?.content).toEqual({
            v: 'ja-new',
        });
        // A zh-only tab is still returned to a ko asker.
        expect(ko.find(s => s.tab === 'news')?.content).toEqual({
            v: 'zh-only',
        });
    });

    it('anyLocale breaks an exact generatedAt tie by requested language, then Korean', async () => {
        const rows = [
            { ...snapshotRow, locale: 'zh', content: { v: 'zh' } },
            { ...snapshotRow, locale: 'ko', content: { v: 'ko' } },
            { ...snapshotRow, locale: 'en', content: { v: 'en' } },
        ];
        const repo = new DrizzleSeoSnapshotRepository(
            makeFindBySymbolDb(rows).db
        );

        expect(
            (await repo.findBySymbol('AAPL', 'en', { anyLocale: true }))[0]
                ?.content
        ).toEqual({ v: 'en' });
        expect(
            (await repo.findBySymbol('AAPL', 'ja', { anyLocale: true }))[0]
                ?.content
        ).toEqual({ v: 'ko' });
    });

    it('returns an empty array when no snapshots exist', async () => {
        const { db } = makeFindBySymbolDb([]);
        const repo = new DrizzleSeoSnapshotRepository(db);

        await expect(repo.findBySymbol('AAPL', 'ko')).resolves.toEqual([]);
    });
});

describe('DrizzleSeoSnapshotRepository.findGeneratedAtMap', () => {
    it('returns an empty Map for empty input without querying the db', async () => {
        const { db, where } = makeFindBySymbolDb([]);
        const repo = new DrizzleSeoSnapshotRepository(db);

        const result = await repo.findGeneratedAtMap([]);

        expect(result).toEqual(new Map());
        expect(where).not.toHaveBeenCalled();
    });

    it('returns a Map keyed by `${symbol}:${tab}` to generatedAt, querying with uppercased symbols', async () => {
        const rows = [
            { symbol: 'AAPL', tab: 'technical', generatedAt },
            { symbol: 'MSFT', tab: 'overall', generatedAt: updatedAt },
        ];
        const { db, where } = makeFindBySymbolDb(rows);
        const repo = new DrizzleSeoSnapshotRepository(db);

        const result = await repo.findGeneratedAtMap(['aapl', 'msft']);

        expect(result).toEqual(
            new Map([
                ['AAPL:technical', generatedAt],
                ['MSFT:overall', updatedAt],
            ])
        );
        expect(where.mock.calls[0]?.[0]).toEqual(
            inArray(seoAnalysisSnapshots.symbol, ['AAPL', 'MSFT'])
        );
    });
});

describe('DrizzleSeoSnapshotRepository.listFreshSymbolTabs', () => {
    function repoReturning(rows: unknown[]) {
        const where = vi.fn().mockResolvedValue(rows);
        const from = vi.fn(() => ({ where }));
        const select = vi.fn((_fields: Record<string, unknown>) => ({ from }));
        const repo = new DrizzleSeoSnapshotRepository({
            select,
        } as unknown as SiglensDatabase);
        return { repo, select, where };
    }

    it('탭·독자 로케일 폴백·신선도로 거르고 본문 전체 없이 산문 원천 필드 투영만 읽는다', async () => {
        const generatedAt = new Date('2026-09-20T03:00:00.000Z');
        const { repo, select, where } = repoReturning([
            {
                symbol: 'AAPL',
                tab: 'news',
                locale: 'ko',
                generatedAt,
                prose: { currentDriverKo: '뉴스 동인 문단' },
            },
        ]);
        const since = new Date('2026-09-10T00:00:00.000Z');

        const result = await repo.listFreshSymbolTabs(
            ['technical', 'news'],
            'ko',
            since
        );

        expect(result).toEqual([
            { symbol: 'AAPL', tab: 'news', generatedAt, hasProse: true },
        ]);
        // 본문(JSONB) 전체가 아니라 `prose` 투영만 끌어온다 — sitemap 한 번에 수십 MB가 된다.
        // 호출 순서에 기대지 않고 판별 인자(`prose` 키)로 찾는다.
        const selected = select.mock.calls.find(
            ([fields]) => 'prose' in fields
        )![0];
        expect(Object.keys(selected).toSorted()).toEqual([
            'generatedAt',
            'locale',
            'prose',
            'symbol',
            'tab',
        ]);
        expect(selected).not.toHaveProperty('content');
        // 투영 SQL은 PROSE_SOURCE_FIELDS의 필드만 jsonb_build_object로 뽑는다.
        const { sql: projectionSql } = new PgDialect().sqlToQuery(
            selected.prose as never
        );
        expect(projectionSql).toContain('jsonb_build_object(');
        for (const field of [
            'summary',
            'patternSummaries',
            'strategyResults',
            'currentDriverKo',
            'keyEventsKo',
            'upcomingEventsKo',
        ]) {
            expect(projectionSql).toContain(`'${field}'`);
        }
        expect(where.mock.calls[0]?.[0]).toEqual(
            and(
                inArray(seoAnalysisSnapshots.tab, ['technical', 'news']),
                inArray(seoAnalysisSnapshots.locale, ['ko', 'en']),
                gte(seoAnalysisSnapshots.generatedAt, since)
            )
        );
    });

    it('투영된 산문이 렌더 가능하지 않으면 hasProse=false다 — 행 존재만으로 "산문 있음"이 되지 않는다', async () => {
        const generatedAt = new Date('2026-09-20T03:00:00.000Z');
        const { repo } = repoReturning([
            {
                symbol: 'AAPL',
                tab: 'technical',
                locale: 'ko',
                generatedAt,
                prose: { summary: null, patternSummaries: null },
            },
            {
                symbol: 'MSFT',
                tab: 'news',
                locale: 'ko',
                generatedAt,
                prose: { currentDriverKo: '  ', keyEventsKo: [] },
            },
            {
                symbol: 'NVDA',
                tab: 'technical',
                locale: 'ko',
                generatedAt,
                prose: null,
            },
            {
                symbol: 'TSLA',
                tab: 'technical',
                locale: 'ko',
                generatedAt,
                // 드라이버가 jsonb 식 결과를 문자열로 줘도 같은 판정이다.
                prose: JSON.stringify({ summary: '요약 문단입니다.' }),
            },
        ]);

        const result = await repo.listFreshSymbolTabs(
            ['technical', 'news'],
            'ko',
            new Date(0)
        );

        const hasProseOf = (symbol: string) =>
            result.find(r => r.symbol === symbol)?.hasProse;
        expect(hasProseOf('AAPL')).toBe(false);
        expect(hasProseOf('MSFT')).toBe(false);
        expect(hasProseOf('NVDA')).toBe(false);
        expect(hasProseOf('TSLA')).toBe(true);
    });

    it('같은 (symbol, tab)의 로케일별 행은 폴백 순서가 앞선 한 행으로 합친다 — 페이지가 렌더하는 행의 시각이다', async () => {
        const koAt = new Date('2026-09-20T03:00:00.000Z');
        const enAt = new Date('2026-09-21T03:00:00.000Z');
        // en 행이 더 최근이어도 ko 요청의 폴백 체인은 ko가 먼저다.
        const { repo } = repoReturning([
            {
                symbol: 'AAPL',
                tab: 'news',
                locale: 'en',
                generatedAt: enAt,
                prose: null,
            },
            {
                symbol: 'AAPL',
                tab: 'news',
                locale: 'ko',
                generatedAt: koAt,
                prose: null,
            },
            {
                symbol: 'MSFT',
                tab: 'news',
                locale: 'en',
                generatedAt: enAt,
                prose: null,
            },
        ]);

        const result = await repo.listFreshSymbolTabs(
            ['news'],
            'ko',
            new Date(0)
        );

        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            symbol: 'AAPL',
            tab: 'news',
            generatedAt: koAt,
            hasProse: false,
        });
        // ko 행이 없는 종목은 en 폴백 행의 시각을 쓴다.
        expect(result).toContainEqual({
            symbol: 'MSFT',
            tab: 'news',
            generatedAt: enAt,
            hasProse: false,
        });
    });

    it('같은 symbol의 서로 다른 탭은 각자 한 행이다', async () => {
        const { repo } = repoReturning([
            {
                symbol: 'AAPL',
                tab: 'news',
                locale: 'ko',
                generatedAt: new Date('2026-09-20T03:00:00.000Z'),
            },
            {
                symbol: 'AAPL',
                tab: 'technical',
                locale: 'ko',
                generatedAt: new Date('2026-09-20T23:00:00.000Z'),
            },
        ]);

        const result = await repo.listFreshSymbolTabs(
            ['technical', 'news'],
            'ko',
            new Date(0)
        );

        expect(result.map(r => `${r.symbol}:${r.tab}`).toSorted()).toEqual([
            'AAPL:news',
            'AAPL:technical',
        ]);
    });
});

function makeListPatternsDb(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn((..._args: unknown[]) => ({ limit }));
    const where = vi.fn((_condition: unknown) => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn((_projection: unknown) => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        where,
        orderBy,
        limit,
        select,
    };
}

describe('DrizzleSeoSnapshotRepository.listSymbolsWithDetectedPatterns', () => {
    const since = new Date('2026-10-23T00:00:00.000Z');
    const toQuery = (fragment: unknown) =>
        new PgDialect().sqlToQuery(fragment as never);

    it('패턴이 없으면 DB를 치지 않는다', async () => {
        const { db, where } = makeListPatternsDb([]);
        const repo = new DrizzleSeoSnapshotRepository(db);
        await expect(
            repo.listSymbolsWithDetectedPatterns([], {
                since,
                limit: 5,
                market: 'us',
            })
        ).resolves.toEqual([]);
        expect(where).not.toHaveBeenCalled();
    });

    it('행을 그대로 돌려주고 limit을 그대로 적용한다', async () => {
        const g1 = new Date('2026-10-24T21:00:00.000Z');
        const summaries = ['double_bottom'];
        const { db, limit } = makeListPatternsDb([
            { symbol: 'TSLA', generatedAt: g1, detectedPatterns: summaries },
            { symbol: 'AAPL', generatedAt: g1, detectedPatterns: summaries },
        ]);
        const repo = new DrizzleSeoSnapshotRepository(db);
        const hits = await repo.listSymbolsWithDetectedPatterns(
            ['double_bottom'],
            { since, limit: 2, market: 'us' }
        );
        expect(hits).toEqual([
            {
                symbol: 'TSLA',
                generatedAt: g1,
                detectedPatterns: ['double_bottom'],
            },
            {
                symbol: 'AAPL',
                generatedAt: g1,
                detectedPatterns: ['double_bottom'],
            },
        ]);
        expect(limit).toHaveBeenCalledWith(2);
    });

    it('행마다 SQL이 투영한 탐지 이름을 요청 순서대로 돌려준다', async () => {
        const g = new Date('2026-10-24T21:00:00.000Z');
        const { db } = makeListPatternsDb([
            {
                symbol: 'A',
                generatedAt: g,
                // 저장 순서가 요청 순서와 달라도 요청 순서로 돌려준다.
                detectedPatterns: ['cup_and_handle', 'double_bottom'],
            },
            {
                symbol: 'B',
                generatedAt: g,
                // 드라이버가 jsonb를 문자열로 줘도 같은 판정이 된다.
                detectedPatterns: JSON.stringify(['double_top']),
            },
            { symbol: 'C', generatedAt: g, detectedPatterns: null },
        ]);
        const hits = await new DrizzleSeoSnapshotRepository(
            db
        ).listSymbolsWithDetectedPatterns(
            ['double_bottom', 'double_top', 'cup_and_handle'],
            { since, limit: 5, market: 'us' }
        );
        expect(hits.map(h => [h.symbol, h.detectedPatterns])).toEqual([
            ['A', ['double_bottom', 'cup_and_handle']],
            ['B', ['double_top']],
            ['C', []],
        ]);
    });

    it('탐지된 요청 패턴 이름만 SQL에서 투영하고 이름은 바인드 파라미터로 넘긴다', async () => {
        const { db, select } = makeListPatternsDb([]);
        await new DrizzleSeoSnapshotRepository(
            db
        ).listSymbolsWithDetectedPatterns(['double_bottom', 'cup_and_handle'], {
            since,
            limit: 5,
            market: 'us',
        });
        const projection = (
            select.mock.calls[0] as unknown as [Record<string, unknown>]
        )[0];
        expect(Object.keys(projection)).toContain('detectedPatterns');
        expect(Object.keys(projection)).not.toContain('patternSummaries');
        const query = toQuery(projection.detectedPatterns);
        expect(query.sql).toContain(`->'patternSummaries'`);
        expect(query.sql).toContain('jsonb_array_elements(');
        expect(query.sql).toContain(`elem->>'detected' = 'true'`);
        expect(query.sql).toContain('jsonb_array_elements_text(');
        expect(query.params).toEqual([
            JSON.stringify(['double_bottom', 'cup_and_handle']),
        ]);
    });

    it('where 절이 technical·ko·since·크립토 제외·패턴 containment를 담는다', async () => {
        const { db, where } = makeListPatternsDb([]);
        const repo = new DrizzleSeoSnapshotRepository(db);
        await repo.listSymbolsWithDetectedPatterns(
            ['double_bottom', 'cup_and_handle'],
            { since, limit: 5, market: 'us' }
        );
        const query = toQuery(where.mock.calls[0]![0]);
        expect(query.sql).toContain('"tab" = ');
        expect(query.sql).toContain('"locale" = ');
        expect(query.sql).toContain('"generated_at" >= ');
        expect(query.sql).toContain('"symbol" not in (');
        expect(query.sql).toContain(`->'patternSummaries' @>`);
        // 두 containment는 OR로 묶인다.
        expect(query.sql).toMatch(/::jsonb or .*->'patternSummaries' @>/);
        expect(query.params).toEqual(
            expect.arrayContaining([
                'technical',
                'ko',
                since.toISOString(),
                JSON.stringify([
                    { patternName: 'double_bottom', detected: true },
                ]),
                JSON.stringify([
                    { patternName: 'cup_and_handle', detected: true },
                ]),
            ])
        );
    });

    it('크립토 심볼을 제외 목록으로 넘긴다', async () => {
        const { db, where } = makeListPatternsDb([]);
        const repo = new DrizzleSeoSnapshotRepository(db);
        await repo.listSymbolsWithDetectedPatterns(['double_bottom'], {
            since,
            limit: 5,
            market: 'us',
        });
        const { params } = toQuery(where.mock.calls[0]![0]);
        expect(params).toEqual(expect.arrayContaining([...POPULAR_CRYPTOS]));
    });

    it('generated_at 내림차순, symbol 오름차순으로 정렬한다', async () => {
        const { db, orderBy } = makeListPatternsDb([]);
        const repo = new DrizzleSeoSnapshotRepository(db);
        await repo.listSymbolsWithDetectedPatterns(['double_bottom'], {
            since,
            limit: 5,
            market: 'us',
        });
        const sqls = orderBy.mock.calls[0]!.map(arg => toQuery(arg).sql);
        expect(sqls).toEqual([
            '"seo_analysis_snapshots"."generated_at" desc',
            '"seo_analysis_snapshots"."symbol" asc',
        ]);
    });

    it('kr은 KR_SYMBOL_RE 패턴을 대소문자 무시 매칭으로, us는 그 부정으로 건다', async () => {
        const kr = makeListPatternsDb([]);
        await new DrizzleSeoSnapshotRepository(
            kr.db
        ).listSymbolsWithDetectedPatterns(['double_bottom'], {
            since,
            limit: 5,
            market: 'kr',
        });
        const krQuery = toQuery(kr.where.mock.calls[0]![0]);
        expect(krQuery.sql).toContain('"symbol" ~* ');
        expect(krQuery.sql).not.toContain('NOT (');
        expect(krQuery.params).toContain(KR_SYMBOL_RE.source);

        const us = makeListPatternsDb([]);
        await new DrizzleSeoSnapshotRepository(
            us.db
        ).listSymbolsWithDetectedPatterns(['double_bottom'], {
            since,
            limit: 5,
            market: 'us',
        });
        const usQuery = toQuery(us.where.mock.calls[0]![0]);
        expect(usQuery.sql).toContain(
            'NOT ("seo_analysis_snapshots"."symbol" ~* '
        );
        expect(usQuery.params).toContain(KR_SYMBOL_RE.source);
    });
});
