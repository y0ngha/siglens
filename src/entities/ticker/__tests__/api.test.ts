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

type SqlLike = {
    queryChunks?: Array<SqlLike | { name?: string }>;
    name?: string;
};

function collectColumnNames(node: SqlLike): string[] {
    if (node.name) return [node.name];
    if (!node.queryChunks) return [];
    return node.queryChunks.flatMap(chunk =>
        collectColumnNames(chunk as SqlLike)
    );
}

/** 순환 참조 방어 + 무한 재귀 방어용 깊이 상한. Drizzle 조건식은 이보다 훨씬 얕다. */
const SQL_WALK_MAX_DEPTH = 8;

/**
 * 조건식 객체 그래프에 들어 있는 **모든 문자열**을 모은다.
 *
 * 컬럼 이름만 보면 조건이 어떤 컬럼을 쓰는지는 알아도 *무엇과* 비교하는지는 모른다 —
 * 접미사 필터처럼 값 자체가 계약인 경우엔 그것만으로 부족하다. Drizzle이 바인딩 값을
 * 어느 노드 타입에 담는지는 버전마다 다르므로(`Param`/`StringChunk`/중첩 `SQL`),
 * 특정 형태를 가정하지 않고 그래프 전체를 훑는다.
 */
function collectSqlStrings(
    node: unknown,
    depth = 0,
    seen = new Set<unknown>()
): string[] {
    if (depth > SQL_WALK_MAX_DEPTH || node === null) return [];
    if (typeof node === 'string') return [node];
    if (typeof node !== 'object') return [];
    if (seen.has(node)) return [];
    seen.add(node);
    return Object.values(node as Record<string, unknown>).flatMap(value =>
        collectSqlStrings(value, depth + 1, seen)
    );
}

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
    where: Mock;
} {
    const where = vi.fn().mockResolvedValue(rows);
    // `findAll`은 `.where(isNull(delistedAt))`로 상폐 행을 거르고
    // `findAllListingStatuses`도 `.from().where(or(like(...), like(...)))`로 국내
    // 종목만 거른다 — 둘 다 태우려면 from의 결과가 thenable이면서 where도 갖고 있어야 한다.
    const fromResult = Object.assign(Promise.resolve(rows), { where });
    const from = vi.fn(() => fromResult);
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        from,
        where,
    };
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

function makeUpdateDb(): {
    db: SiglensDatabase;
    update: Mock;
    set: Mock;
    where: Mock;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    return { db: { update } as unknown as SiglensDatabase, update, set, where };
}

describe('DrizzleKoreanTickerRepository', () => {
    it('findAll 은 상장 중인 row 를 반환한다', async () => {
        const { db, where } = makeSelectFromDb([apple, microsoft]);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findAll()).resolves.toEqual([apple, microsoft]);
        // findAll 결과가 곧 한글 검색 후보 전체다 — 필터 없이 전량을 읽으면 상폐 종목이
        // 자동완성에 뜨고 클릭하면 시세 없는 페이지로 간다.
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('findAll 은 빈 결과도 그대로 반환한다', async () => {
        const { db } = makeSelectFromDb([]);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findAll()).resolves.toEqual([]);
    });

    it('findAllListingStatuses 는 상폐 행까지 포함하되 국내 종목만 읽는다', async () => {
        // reconcile 플래너는 "이미 상폐로 표시된 종목"을 알아야 relist를 판단하고,
        // 같은 행을 매일 다시 상폐 표시해 시각을 미는 것도 막는다 — 그래서 상폐 행도 읽는다.
        //
        // 반면 **미국 종목은 읽으면 안 된다.** `korean_tickers`는 이름과 달리 미국 종목도
        // 담는데(2026-08 프로덕션 실측: 32,951행 중 국내 2,595행), 대조 대상인
        // 공공데이터포털 응답은 KRX만 담는다. 전량을 읽으면 미국 종목 3만여 건이
        // "사라진 종목"으로 잡혀 소실 상한 가드가 매일 걸리고 상폐 처리가 영영 일어나지 않는다.
        const rows = [
            { symbol: '005930.KS', delistedAt: null },
            { symbol: '000000.KQ', delistedAt: new Date('2026-01-01') },
        ];
        const { db, where } = makeSelectFromDb(rows);
        const repo = new DrizzleKoreanTickerRepository(db);
        await expect(repo.findAllListingStatuses()).resolves.toEqual(rows);

        // `.where()`가 불렸다는 것만 보면 **아무 조건이나** 통과한다 — 오타 난 접미사도,
        // 엉뚱한 컬럼도. 실제 조건식을 열어 컬럼과 바인딩 값을 둘 다 확인한다.
        expect(where).toHaveBeenCalledTimes(1);
        const condition = where.mock.calls[0][0] as SqlLike;
        expect(collectColumnNames(condition)).toContain('symbol');
        expect(collectSqlStrings(condition)).toEqual(
            expect.arrayContaining(['%.KS', '%.KQ'])
        );
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

    it('upsertMany 는 옵션 없이 호출하면(번역 경로) conflict-update set 에 name 을 포함한다', async () => {
        // koreanNameStore.setKoreanTickers(방문 시 getAssetInfo가 채운 진짜 영문명)가
        // 이 경로를 옵션 없이 쓴다 — name이 빠지면 번역이 절대 반영되지 않는다.
        const { db, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.upsertMany([apple]);
        const passedSet = onConflictDoUpdate.mock.calls[0]![0].set as Record<
            string,
            unknown
        >;
        expect(passedSet).toHaveProperty('name');
    });

    it('upsertMany 는 preserveExistingName 옵션이 있으면(크론 경로) conflict-update set 에서 name 을 뺀다', async () => {
        // syncKrListedTickers가 넘기는 name은 공공데이터포털에 영문명이 없어 채운
        // 한글명 placeholder다. 이 옵션 없이 upsert하면 방문 시 getAssetInfo가 이미
        // 써 둔 진짜 영문명을 크론이 매일 밤 placeholder로 되돌린다 — 이 테스트는
        // 그 회귀를 pin한다. 카운트만 세면 name이 여전히 set에 남아 있어도(=버그가
        // 있어도) 통과하므로, set 객체 자체를 열어 키 존재 여부를 직접 확인한다.
        const { db, onConflictDoUpdate } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.upsertMany([apple], { preserveExistingName: true });
        const passedSet = onConflictDoUpdate.mock.calls[0]![0].set as Record<
            string,
            unknown
        >;
        expect(passedSet).not.toHaveProperty('name');
        expect(passedSet).toMatchObject({
            koreanName: expect.anything(),
            exchange: expect.anything(),
            exchangeFullName: expect.anything(),
            updatedAt: expect.anything(),
        });
    });

    it('upsertMany 는 preserveExistingName 옵션이 있어도 신규 INSERT 행에는 name(placeholder)을 그대로 담는다', async () => {
        // 옵션은 conflict-update만 바꾼다 — INSERT되는 값 자체에서 name을 빼면 신규
        // 행이 NOT NULL 제약을 위반하거나 빈 문자열로 남는다. placeholder라도 null보다
        // 낫다는 게 이 리포지토리의 원래 계약(toKoreanTickerRows 참조)이다.
        const { db, values } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.upsertMany([apple], { preserveExistingName: true });
        const passedValues = values.mock.calls[0]![0] as KoreanTickerEntry[];
        expect(passedValues[0]).toMatchObject({ name: apple.name });
    });

    it('upsertMany 는 전 종목 동기화를 배치로 쪼갠다', async () => {
        // 2,500행대를 한 INSERT로 보내면 Neon HTTP 페이로드 한도에 걸린다.
        const { db, insert } = makeUpsertDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        const many = Array.from({ length: 1_100 }, (_, i) => ({
            ...apple,
            symbol: `SYM${i}`,
        }));
        await repo.upsertMany(many);
        expect(insert).toHaveBeenCalledTimes(3); // 500 + 500 + 100
    });

    it('markDelisted 는 빈 입력에서 update 를 호출하지 않는다', async () => {
        const { db, update } = makeUpdateDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.markDelisted([]);
        expect(update).not.toHaveBeenCalled();
    });

    it('markDelisted 는 delisted_at 을 채우고 이미 표시된 행은 건드리지 않는다', async () => {
        const { db, set, where } = makeUpdateDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.markDelisted(['000000.KQ']);
        // sql`now()` — DB 서버 시계로 스탬프한다.
        expect(set.mock.calls[0][0].delistedAt).toBeDefined();
        // `where`가 불렸다는 것만 보면 **아무 조건이나** 통과한다 — isNull 가드가
        // and(...)에서 빠져도 초록으로 남는다. 조건식을 열어 컬럼을 직접 확인한다.
        expect(where).toHaveBeenCalledTimes(1);
        const condition = where.mock.calls[0][0] as SqlLike;
        expect(collectColumnNames(condition)).toEqual(
            expect.arrayContaining(['symbol', 'delisted_at'])
        );
    });

    it('markRelisted 는 delisted_at 을 null 로 되돌린다', async () => {
        const { db, set } = makeUpdateDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.markRelisted(['000000.KQ']);
        expect(set).toHaveBeenCalledWith({ delistedAt: null });
    });

    it('markRelisted 는 빈 입력에서 update 를 호출하지 않는다', async () => {
        const { db, update } = makeUpdateDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        await repo.markRelisted([]);
        expect(update).not.toHaveBeenCalled();
    });

    it('markRelisted 는 대량 재상장을 배치로 쪼갠다', async () => {
        // 피드 장애 복구 직후처럼 재상장 심볼이 한 번에 몰리면 IN (...) 하나가
        // upsertMany와 같은 Neon HTTP 페이로드 한도에 걸린다.
        const { db, update } = makeUpdateDb();
        const repo = new DrizzleKoreanTickerRepository(db);
        const many = Array.from({ length: 1_100 }, (_, i) => `SYM${i}.KS`);
        await repo.markRelisted(many);
        expect(update).toHaveBeenCalledTimes(3); // 500 + 500 + 100
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

        it('orderBy is called with exactly 2 ordering args: relevance CASE + circulatingSupply desc', async () => {
            const { db, orderBy } = makeCryptoSearchDb([btcRecord]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await repo.search('btc', 10);
            expect(orderBy).toHaveBeenCalledTimes(1);
            const orderByArgs = orderBy.mock.calls[0];
            expect(orderByArgs).toHaveLength(2);
            // 1st arg: sql CASE object — Drizzle's sql`` template result carries a
            // queryChunks array (the SQL fragment tree). Asserting the property is more
            // precise than a bare typeof-object check and distinguishes it from a column ref.
            const caseArg = orderByArgs[0] as SqlLike;
            expect(caseArg).toHaveProperty('queryChunks');
            // 2nd arg: desc(cryptoAssets.circulatingSupply) — Drizzle wraps the column
            // in a SQL chunk tree; collectColumnNames recurses into queryChunks to find
            // the column name node, confirming the tiebreak sorts by circulating_supply.
            const descArg = orderByArgs[1] as SqlLike;
            expect(collectColumnNames(descArg)).toContain('circulating_supply');
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

        it('korean_name 컬럼도 ilike 조건에 포함한다', async () => {
            const { db, where } = makeCryptoSearchDb([]);
            const repo = new DrizzleCryptoAssetRepository(db);
            await repo.search('비트코', 10);
            expect(where).toHaveBeenCalledTimes(1);
            // The or() expression passed to .where() must reference the korean_name column.
            // Drizzle nests SQL objects (or → [ilike, ilike, ilike]); we recurse into
            // queryChunks to collect all column `.name` values. This assertion fails if
            // korean_name is removed from the ilike OR-condition.
            const condition = where.mock.calls[0][0] as SqlLike;
            expect(collectColumnNames(condition)).toContain('korean_name');
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
