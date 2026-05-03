import {
    DrizzleAssetTranslationRepository,
    DrizzleKoreanTickerRepository,
} from '@/infrastructure/db/tickerRepository';
import type {
    AssetTranslationRecord,
    SiglensDatabase,
} from '@/infrastructure/db/types';
import type { KoreanTickerEntry } from '@/domain/types';

const apple: KoreanTickerEntry = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    koreanName: '애플',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const microsoft: KoreanTickerEntry = {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    koreanName: '마이크로소프트',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

function makeSelectFromDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: jest.Mock;
    from: jest.Mock;
} {
    const fromResult = Promise.resolve(rows);
    const from = jest.fn(() => fromResult);
    const select = jest.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, select, from };
}

function makeFindBySymbolDb(rows: unknown[]): {
    db: SiglensDatabase;
    limit: jest.Mock;
} {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, limit };
}

function makeFindBySymbolsDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: jest.Mock;
    select: jest.Mock;
} {
    const where = jest.fn().mockResolvedValue(rows);
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, where, select };
}

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

describe('DrizzleKoreanTickerRepository', () => {
    it('findAll 은 모든 row 를 반환한다', async () => {
        const { db } = makeSelectFromDb([apple, microsoft]);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findAll()).resolves.toEqual([apple, microsoft]);
    });

    it('findAll 은 빈 결과도 그대로 반환한다', async () => {
        const { db } = makeSelectFromDb([]);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findAll()).resolves.toEqual([]);
    });

    it('findBySymbols 는 빈 입력에서 select 를 호출하지 않는다', async () => {
        const { db, select } = makeFindBySymbolsDb([apple]);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findBySymbols([])).resolves.toEqual([]);
        expect(select).not.toHaveBeenCalled();
    });

    it('findBySymbols 는 요청한 symbol 조건으로 row 를 조회한다', async () => {
        const { db, where } = makeFindBySymbolsDb([apple]);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findBySymbols(['AAPL'])).resolves.toEqual([apple]);
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('upsertMany 는 빈 입력에서 insert 를 호출하지 않는다', async () => {
        const { db, insert } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.upsertMany([]);
        expect(insert).not.toHaveBeenCalled();
    });

    it('upsertMany 는 insert + onConflictDoUpdate 를 호출한다', async () => {
        const { db, insert, values, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.upsertMany([apple, microsoft]);
        expect(insert).toHaveBeenCalledTimes(1);
        const passed = values.mock.calls[0][0] as KoreanTickerEntry[];
        expect(passed).toHaveLength(2);
        expect(passed[0]).toMatchObject({ symbol: 'AAPL', koreanName: '애플' });
        expect(onConflictDoUpdate).toHaveBeenCalledWith({
            target: expect.anything(),
            set: {
                name: expect.anything(),
                koreanName: expect.anything(),
                exchange: expect.anything(),
                exchangeFullName: expect.anything(),
                updatedAt: expect.anything(),
            },
        });
    });

    it('upsertMany 는 onConflictDoUpdate 의 set 에 updatedAt 을 명시적으로 포함한다', async () => {
        const { db, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.upsertMany([apple]);
        const passedSet = onConflictDoUpdate.mock.calls[0][0].set as Record<
            string,
            unknown
        >;
        expect(passedSet).toHaveProperty('updatedAt');
        // sql`now()` produces an SQL chunk object — must not be undefined/null.
        expect(passedSet.updatedAt).toBeDefined();
    });
});

describe('DrizzleAssetTranslationRepository', () => {
    const record: AssetTranslationRecord = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    };

    it('findBySymbol 은 row 를 반환한다', async () => {
        const { db } = makeFindBySymbolDb([record]);
        const repo = new DrizzleAssetTranslationRepository(db);
        await expect(repo.findBySymbol('AAPL')).resolves.toEqual(record);
    });

    it('findBySymbol 은 row 가 없으면 null 을 반환한다', async () => {
        const { db } = makeFindBySymbolDb([]);
        const repo = new DrizzleAssetTranslationRepository(db);
        await expect(repo.findBySymbol('AAPL')).resolves.toBeNull();
    });

    it('upsert 는 insert + onConflictDoUpdate 를 호출한다', async () => {
        const { db, insert, values, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleAssetTranslationRepository(db);
        await repo.upsert(record);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenCalledWith(record);
        expect(onConflictDoUpdate).toHaveBeenCalledWith({
            target: expect.anything(),
            set: {
                name: expect.anything(),
                koreanName: expect.anything(),
                fmpSymbol: expect.anything(),
                updatedAt: expect.anything(),
            },
        });
    });

    it('upsert 는 onConflictDoUpdate 의 set 에 updatedAt 을 명시적으로 포함한다', async () => {
        const { db, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleAssetTranslationRepository(db);
        await repo.upsert(record);
        const passedSet = onConflictDoUpdate.mock.calls[0][0].set as Record<
            string,
            unknown
        >;
        expect(passedSet).toHaveProperty('updatedAt');
        expect(passedSet.updatedAt).toBeDefined();
    });
});
