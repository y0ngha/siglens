import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import {
    DrizzleNewsRepository,
    type NewsRow,
} from '@/infrastructure/db/newsRepository';

const baseItem: NewsItem = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://example.com/news/1',
    publishedAt: '2025-08-01T10:00:00.000Z',
    titleEn: 'Apple hits all-time high',
    bodyEn: 'The stock reached a new record.',
};

const analysis: NewsCardAnalysis = {
    titleKo: '애플 사상 최고가 달성',
    bodyKo: '주가가 신기록을 세웠다.',
    summaryKo: '애플 주가 신기록.',
    sentiment: 'bullish',
    category: 'other',
};

// --- DB mock helpers ---

/** Build a mock `db` that handles insert→onConflictDoUpdate chains. */
function makeUpsertDb(): {
    db: SiglensDatabase;
    insert: jest.Mock;
    values: jest.Mock;
    onConflictDoUpdate: jest.Mock;
} {
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn(() => ({ onConflictDoUpdate }));
    const insert = jest.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
    };
}

/** Build a mock `db` that handles update→set→where chains. */
function makeUpdateDb(): {
    db: SiglensDatabase;
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
} {
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn(() => ({ where }));
    const update = jest.fn(() => ({ set }));
    return {
        db: { update } as unknown as SiglensDatabase,
        update,
        set,
        where,
    };
}

/** Build a mock `db` for a select…where…orderBy chain returning `rows`. */
function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: jest.Mock;
    orderBy: jest.Mock;
} {
    const orderBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        orderBy,
    };
}

// --- Tests ---

describe('DrizzleNewsRepository', () => {
    describe('upsertNewsItem', () => {
        it('insert 경로: insert + onConflictDoUpdate 를 호출한다', async () => {
            const { db, insert, values, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem(baseItem);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledTimes(1);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['id']).toBe('abc123');
            expect(row['symbol']).toBe('AAPL');
            expect(row['url']).toBe('https://example.com/news/1');
        });

        it('bodyEn 이 null 인 항목도 정상 삽입된다', async () => {
            const { db, values } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem({ ...baseItem, bodyEn: null });

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['bodyEn']).toBeNull();
        });
    });

    describe('attachAnalysis', () => {
        it('update + set + where 를 호출한다', async () => {
            const { db, update, set, where } = makeUpdateDb();
            const repo = new DrizzleNewsRepository(db);
            const analyzedAt = new Date('2025-08-01T12:00:00.000Z');
            await repo.attachAnalysis('abc123', analysis, analyzedAt);

            expect(update).toHaveBeenCalledTimes(1);
            expect(set).toHaveBeenCalledTimes(1);
            expect(where).toHaveBeenCalledTimes(1);

            const setArg = set.mock.calls[0][0] as Record<string, unknown>;
            expect(setArg['titleKo']).toBe('애플 사상 최고가 달성');
            expect(setArg['sentiment']).toBe('bullish');
            expect(setArg['category']).toBe('other');
            expect(setArg['analyzedAt']).toBe(analyzedAt);
        });
    });

    describe('listBySymbol', () => {
        interface DbRow {
            id: string;
            symbol: string;
            source: string;
            url: string;
            publishedAt: Date;
            titleEn: string;
            bodyEn: string | null;
            titleKo: string | null;
            bodyKo: string | null;
            summaryKo: string | null;
            sentiment: string | null;
            category: string | null;
            analyzedAt: Date | null;
        }

        const dbRow: DbRow = {
            id: 'abc123',
            symbol: 'AAPL',
            source: 'Reuters',
            url: 'https://example.com/news/1',
            publishedAt: new Date('2025-08-01T10:00:00.000Z'),
            titleEn: 'Apple hits all-time high',
            bodyEn: 'The stock reached a new record.',
            titleKo: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            analyzedAt: null,
        };

        it('publishedAt 을 ISO 문자열로 변환해 반환한다', async () => {
            const { db } = makeSelectDb([dbRow]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listBySymbol('AAPL', 86_400_000);

            expect(results).toHaveLength(1);
            expect(results[0]?.publishedAt).toBe('2025-08-01T10:00:00.000Z');
        });

        it('결과가 없으면 빈 배열을 반환한다', async () => {
            const { db } = makeSelectDb([]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listBySymbol('AAPL', 86_400_000);
            expect(results).toEqual([]);
        });

        it('분석 완료 row 는 sentiment/category 를 포함한다', async () => {
            const analyzedRow: DbRow = {
                ...dbRow,
                titleKo: '애플 사상 최고가 달성',
                summaryKo: '애플 주가 신기록.',
                sentiment: 'bullish',
                category: 'other',
                analyzedAt: new Date('2025-08-01T12:00:00.000Z'),
            };
            const { db } = makeSelectDb([analyzedRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBe('bullish');
            expect(result.category).toBe('other');
            expect(result.titleKo).toBe('애플 사상 최고가 달성');
        });
    });
});
