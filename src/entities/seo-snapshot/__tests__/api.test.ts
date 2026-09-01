import { eq, inArray } from 'drizzle-orm';
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
    model: 'deepseek-v4-flash',
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
    model: 'deepseek-v4-flash',
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
            model: 'deepseek-v4-flash',
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
        expect(set.model).toBe('deepseek-v4-flash');
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
