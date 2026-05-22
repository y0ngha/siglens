import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import {
    DrizzleNewsRepository,
    type NewsRow,
} from '@/infrastructure/db/newsRepository';

// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 retry 케이스의 실제
// 대기 시간을 없앤다. retry 발생 시 sleep이 호출되는 것만 검증.
jest.mock('@/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

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
    priceImpact: 'medium',
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

        it('conflict 경로에서 publishedAt도 갱신한다', async () => {
            const { db, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem(baseItem);

            const conflictArg = onConflictDoUpdate.mock.calls[0][0] as {
                set: Record<string, unknown>;
            };
            expect(conflictArg.set).toHaveProperty('publishedAt');
        });

        it('Neon transient 에러 발생 시 재시도해 결국 성공한다', async () => {
            // 첫 chain은 onConflictDoUpdate에서 transient NeonDbError를 던지고,
            // 두 번째 chain은 성공해야 retry 정책이 의도대로 동작함을 보장한다.
            const neonTransient = Object.assign(
                new Error('Error connecting to database: fetch failed'),
                { name: 'NeonDbError' }
            );
            const onConflictDoUpdate = jest
                .fn()
                .mockRejectedValueOnce(neonTransient)
                .mockResolvedValueOnce(undefined);
            const values = jest.fn(() => ({ onConflictDoUpdate }));
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;

            const repo = new DrizzleNewsRepository(db);
            await expect(
                repo.upsertNewsItem(baseItem)
            ).resolves.toBeUndefined();

            // insert chain이 두 번 재구성됐는지 확인 — 동일 promise를 await 한 것이 아니라
            // 매 retry마다 새 query builder를 만들고 있다는 증거.
            expect(insert).toHaveBeenCalledTimes(2);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
        });

        it('non-transient 에러는 재시도 없이 즉시 전파한다', async () => {
            // Constraint 위반 같은 영구 에러는 retry 해도 동일하게 실패할 뿐이므로
            // 첫 시도에서 즉시 throw 되어야 한다.
            const constraintError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "news_pkey"'
                ),
                { name: 'NeonDbError' }
            );
            const onConflictDoUpdate = jest
                .fn()
                .mockRejectedValueOnce(constraintError);
            const values = jest.fn(() => ({ onConflictDoUpdate }));
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;

            const repo = new DrizzleNewsRepository(db);
            await expect(repo.upsertNewsItem(baseItem)).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
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
            expect(setArg['priceImpact']).toBe('medium');
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
            priceImpact: string | null;
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
            priceImpact: null,
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
                priceImpact: 'medium',
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

        it('알 수 없는 enum 문자열은 null 로 정규화한다', async () => {
            // DB에 (수동 SQL 또는 스키마 변경 등으로) 등록되지 않은 값이 들어오면
            // 표시 단의 fallback이 처리할 수 있도록 read 시점에 null로 떨어뜨려야 한다.
            const corruptRow: DbRow = {
                ...dbRow,
                sentiment: 'unknown_value',
                category: 'unknown_category',
                priceImpact: 'unknown_impact',
            };
            const { db } = makeSelectDb([corruptRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBeNull();
            expect(result.category).toBeNull();
            expect(result.priceImpact).toBeNull();
        });

        it('비문자열 enum 값은 null 로 정규화한다', async () => {
            // 타입 시스템 우회 또는 마이그레이션 사고로 비문자열이 들어와도
            // crash 없이 null로 강등시켜야 한다.
            const malformedRow = {
                ...dbRow,
                sentiment: 42,
                category: true,
                priceImpact: { broken: 'shape' },
            } as unknown as DbRow;
            const { db } = makeSelectDb([malformedRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBeNull();
            expect(result.category).toBeNull();
            expect(result.priceImpact).toBeNull();
        });
    });
});
