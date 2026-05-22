// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `jest.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
jest.mock('@/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

import {
    DrizzleAssetTranslationRepository,
    DrizzleKoreanTickerRepository,
    DrizzleProfileDescriptionTranslationRepository,
} from '@/infrastructure/db/tickerRepository';
import type {
    AssetTranslationRecord,
    ProfileDescriptionTranslationRecord,
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

describe('DrizzleProfileDescriptionTranslationRepository', () => {
    const record: ProfileDescriptionTranslationRecord = {
        symbol: 'AAPL',
        descriptionKo: '애플은 소비자 가전 제품을 설계합니다.',
    };

    it('findBySymbol 은 row 를 반환한다', async () => {
        const { db } = makeFindBySymbolDb([record]);
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);
        await expect(repo.findBySymbol('AAPL')).resolves.toEqual(record);
    });

    it('findBySymbol 은 row 가 없으면 null 을 반환한다', async () => {
        const { db } = makeFindBySymbolDb([]);
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);
        await expect(repo.findBySymbol('AAPL')).resolves.toBeNull();
    });

    it('upsert 는 insert + onConflictDoUpdate 를 호출한다', async () => {
        const { db, insert, values, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);
        await repo.upsert(record);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(values).toHaveBeenCalledWith(record);
        expect(onConflictDoUpdate).toHaveBeenCalledWith({
            target: expect.anything(),
            set: {
                descriptionKo: expect.anything(),
                updatedAt: expect.anything(),
            },
        });
    });

    it('upsert 는 onConflictDoUpdate 의 set 에 updatedAt 을 명시적으로 포함한다', async () => {
        const { db, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);
        await repo.upsert(record);
        const passedSet = onConflictDoUpdate.mock.calls[0][0].set as Record<
            string,
            unknown
        >;
        expect(passedSet).toHaveProperty('updatedAt');
        expect(passedSet.updatedAt).toBeDefined();
    });
});

// DrizzleKoreanTickerRepository.upsertMany 를 대표 site 로 골라
// NEON_TRANSIENT_RETRY 정책이 wire-up 됐는지 확인하는 smoke 테스트. 이 파일의
// 다른 두 클래스(Asset/ProfileDescription)도 동일한 withRetry + NEON_TRANSIENT_RETRY
// 패턴을 쓰므로 대표 1개만 검증해도 회귀 방지에 충분하다.
describe('Neon transient retry wire-up', () => {
    it('transient NeonDbError 가 발생하면 재시도해 결국 성공한다', async () => {
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
        const repo = new DrizzleKoreanTickerRepository(db);

        await expect(repo.upsertMany([apple])).resolves.toBeUndefined();
        expect(insert).toHaveBeenCalledTimes(2);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    });

    it('non-transient 에러는 재시도 없이 즉시 전파한다', async () => {
        const constraintError = Object.assign(
            new Error(
                'duplicate key value violates unique constraint "korean_tickers_pkey"'
            ),
            { name: 'NeonDbError' }
        );
        const onConflictDoUpdate = jest
            .fn()
            .mockRejectedValueOnce(constraintError);
        const values = jest.fn(() => ({ onConflictDoUpdate }));
        const insert = jest.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzleKoreanTickerRepository(db);

        await expect(repo.upsertMany([apple])).rejects.toBe(constraintError);
        expect(insert).toHaveBeenCalledTimes(1);
    });
});
