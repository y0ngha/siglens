// vi.mock calls are hoisted by vitest above all imports — must appear before any import statements.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/api/fmp/httpClient');
// `cryptoAssetStore` is still mocked because `isCryptoSymbolStatic` imports `isCryptoSymbol`
// from it — vitest needs a mock so the import resolves without touching the DB.
vi.mock('@/entities/ticker/lib/cryptoAssetStore', () => ({
    isCryptoSymbol: vi.fn(),
}));
// `isTabAllowedForSymbol` delegates to `isCryptoSymbolStatic` (unstable_cache-wrapped)
// instead of raw `isCryptoSymbol`. The `isTabAllowedForSymbol` describe block controls
// behaviour via `mockIsCryptoSymbolStatic`.
vi.mock('@/entities/ticker/lib/isCryptoSymbolStatic', () => ({
    isCryptoSymbolStatic: vi.fn(),
}));

import type { Mock } from 'vitest';
import { vi } from 'vitest';

import {
    fetchCryptoAssetList,
    DrizzleCryptoAssetRepository,
    isTabAllowedForSymbol,
} from '@/entities/ticker/api';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { isCryptoSymbolStatic } from '@/entities/ticker/lib/isCryptoSymbolStatic';
import {
    DrizzleAssetTranslationRepository,
    DrizzleKoreanTickerRepository,
    DrizzleProfileDescriptionTranslationRepository,
} from '@/entities/ticker/api';
import type {
    AssetTranslationRecord,
    CryptoAssetRecord,
    ProfileDescriptionTranslationRecord,
    SiglensDatabase,
} from '@/shared/db/types';
import type { KoreanTickerEntry } from '@/shared/lib/types';

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
    select: Mock;
    from: Mock;
} {
    const fromResult = Promise.resolve(rows);
    const from = vi.fn(() => fromResult);
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, select, from };
}

function makeFindBySymbolDb(rows: unknown[]): {
    db: SiglensDatabase;
    limit: Mock;
} {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, limit };
}

function makeFindBySymbolsDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: Mock;
    select: Mock;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, where, select };
}

function makeUpsertDb(): {
    db: SiglensDatabase;
    insert: Mock;
    values: Mock;
    onConflictDoUpdate: Mock;
} {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
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
        const onConflictDoUpdate = vi
            .fn()
            .mockRejectedValueOnce(neonTransient)
            .mockResolvedValueOnce(undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
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
        const onConflictDoUpdate = vi
            .fn()
            .mockRejectedValueOnce(constraintError);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzleKoreanTickerRepository(db);

        await expect(repo.upsertMany([apple])).rejects.toBe(constraintError);
        expect(insert).toHaveBeenCalledTimes(1);
    });
});

describe('fetchCryptoAssetList', () => {
    it('returns mapped rows, filtering out entries without a symbol', async () => {
        vi.mocked(fmpGet).mockResolvedValue([
            {
                symbol: 'BTCUSD',
                name: 'Bitcoin USD',
                circulatingSupply: 19_700_000,
            },
            { name: 'no symbol' },
        ]);
        const result = await fetchCryptoAssetList();
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            circulatingSupply: 19_700_000,
        });
    });

    it('returns an empty array when FMP returns no items', async () => {
        vi.mocked(fmpGet).mockResolvedValue([]);
        const result = await fetchCryptoAssetList();
        expect(result).toEqual([]);
    });

    it('logs and re-throws when fmpGet fails', async () => {
        const error = new Error('FMP API error');
        vi.mocked(fmpGet).mockRejectedValue(error);
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        await expect(fetchCryptoAssetList()).rejects.toThrow('FMP API error');
        expect(consoleSpy).toHaveBeenCalledWith(
            '[fetchCryptoAssetList] FMP cryptocurrency-list fetch failed:',
            error
        );
        consoleSpy.mockRestore();
    });
});

interface CryptoFindBySymbolDbResult {
    db: SiglensDatabase;
    limit: Mock;
}

interface CryptoSearchDbResult {
    db: SiglensDatabase;
    where: Mock;
    orderBy: Mock;
    limit: Mock;
}

/**
 * Build a mock db for DrizzleCryptoAssetRepository.findBySymbol.
 * Chain: select → from → where → limit (returns rows).
 */
function makeCryptoFindBySymbolDb(rows: unknown[]): CryptoFindBySymbolDbResult {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, limit };
}

/**
 * Build a mock db for DrizzleCryptoAssetRepository.search.
 * Chain: select → from → where → orderBy → limit (returns rows).
 */
function makeCryptoSearchDb(rows: unknown[]): CryptoSearchDbResult {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        where,
        orderBy,
        limit,
    };
}

describe('DrizzleCryptoAssetRepository', () => {
    const btcRecord: CryptoAssetRecord = {
        symbol: 'BTCUSD',
        name: 'Bitcoin USD',
        koreanName: null,
        circulatingSupply: 19_700_000,
    };

    describe('findBySymbol', () => {
        it('row 가 있으면 해당 record 를 반환한다', async () => {
            const { db } = makeCryptoFindBySymbolDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await expect(repo.findBySymbol('BTCUSD')).resolves.toEqual(
                btcRecord
            );
        });

        it('row 가 없으면 null 을 반환한다', async () => {
            const { db } = makeCryptoFindBySymbolDb([]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await expect(repo.findBySymbol('BTCUSD')).resolves.toBeNull();
        });

        it('limit(1) 을 호출한다', async () => {
            const { db, limit } = makeCryptoFindBySymbolDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await repo.findBySymbol('BTCUSD');
            expect(limit).toHaveBeenCalledWith(1);
        });
    });

    describe('search', () => {
        it('매칭되는 row 배열을 반환한다', async () => {
            const { db } = makeCryptoSearchDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await expect(repo.search('btc', 10)).resolves.toEqual([btcRecord]);
        });

        it('where 절을 호출한다 (ilike OR 조건)', async () => {
            const { db, where } = makeCryptoSearchDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await repo.search('btc', 10);
            // where is called once with the or(ilike, ilike) expression
            expect(where).toHaveBeenCalledTimes(1);
        });

        it('orderBy 를 호출한다 (circulatingSupply desc)', async () => {
            const { db, orderBy } = makeCryptoSearchDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await repo.search('btc', 10);
            expect(orderBy).toHaveBeenCalledTimes(1);
        });

        it('limit 인자를 그대로 전달한다', async () => {
            const { db, limit } = makeCryptoSearchDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await repo.search('btc', 5);
            expect(limit).toHaveBeenCalledWith(5);
        });

        it('결과가 없으면 빈 배열을 반환한다', async () => {
            const { db } = makeCryptoSearchDb([]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await expect(repo.search('xyz', 10)).resolves.toEqual([]);
        });
    });
});

describe('isTabAllowedForSymbol', () => {
    // `isTabAllowedForSymbol` now delegates to `isCryptoSymbolStatic`
    // (unstable_cache-wrapped, ISR cold-gen-safe) rather than raw `isCryptoSymbol`.
    // This mock controls behaviour for the tests below; `mockIsCryptoSymbol` is
    // kept for other tests in this file that test the store functions directly.
    const mockIsCryptoSymbolStatic = isCryptoSymbolStatic as unknown as Mock;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('equity symbol (isCryptoSymbolStatic → false)', () => {
        beforeEach(() => {
            mockIsCryptoSymbolStatic.mockResolvedValue(false);
        });

        it('equity 심볼은 "fundamental" 탭을 허용한다', async () => {
            await expect(
                isTabAllowedForSymbol('AAPL', 'fundamental')
            ).resolves.toBe(true);
        });

        it('equity 심볼은 "financials" 탭을 허용한다', async () => {
            await expect(
                isTabAllowedForSymbol('AAPL', 'financials')
            ).resolves.toBe(true);
        });

        it('equity 심볼은 "congress" 탭을 허용한다', async () => {
            await expect(
                isTabAllowedForSymbol('AAPL', 'congress')
            ).resolves.toBe(true);
        });

        it('equity 심볼은 "options" 탭을 허용한다', async () => {
            await expect(
                isTabAllowedForSymbol('AAPL', 'options')
            ).resolves.toBe(true);
        });
    });

    describe('crypto symbol (isCryptoSymbolStatic → true)', () => {
        beforeEach(() => {
            mockIsCryptoSymbolStatic.mockResolvedValue(true);
        });

        it('crypto 심볼의 equity-only 탭 "fundamental"은 허용하지 않는다', async () => {
            await expect(
                isTabAllowedForSymbol('BTCUSD', 'fundamental')
            ).resolves.toBe(false);
        });

        it('crypto 심볼의 equity-only 탭 "financials"은 허용하지 않는다', async () => {
            await expect(
                isTabAllowedForSymbol('BTCUSD', 'financials')
            ).resolves.toBe(false);
        });

        it('crypto 심볼의 equity-only 탭 "congress"은 허용하지 않는다', async () => {
            await expect(
                isTabAllowedForSymbol('BTCUSD', 'congress')
            ).resolves.toBe(false);
        });

        it('crypto 심볼의 equity-only 탭 "options"은 허용하지 않는다', async () => {
            await expect(
                isTabAllowedForSymbol('BTCUSD', 'options')
            ).resolves.toBe(false);
        });
    });
});
