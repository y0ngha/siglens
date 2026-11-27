vi.mock('@/shared/api/fmp/httpClient');

import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
    DrizzleCryptoAssetRepository,
    fetchCryptoAssetList,
} from '@/entities/ticker/cryptoAssetApi';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { orderColumnName } from '@/__tests__/utils/orderColumnName';
import { renderSql } from '@/__tests__/utils/renderSql';
import type { CryptoAssetRecord, SiglensDatabase } from '@/shared/db/types';

/** where 조건에 쓰인 컬럼 이름(`"table"."col"`의 col)을 렌더링된 SQL에서 읽는다. */
function collectColumnNames(node: unknown): string[] {
    return [...renderSql(node).sql.matchAll(/(?:"[^"]+"\.)?"([^"]+)"/g)].map(
        match => match[1]
    );
}

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
        describe.each([
            ['_', '\\_'],
            ['%', '\\%'],
            ['\\', '\\\\'],
        ])('검색어 %s 를 글자 그대로 넘긴다', (query, escaped) => {
            it('where의 부분 일치 패턴', async () => {
                const { db, where } = makeCryptoSearchDb([]);
                await new DrizzleCryptoAssetRepository(db).search(query, 10);
                const { params } = new PgDialect().sqlToQuery(
                    where.mock.calls[0][0] as SQL
                );
                expect(params).toEqual(Array(3).fill(`%${escaped}%`));
            });

            it('정렬 CASE의 prefix 패턴', async () => {
                const { db, orderBy } = makeCryptoSearchDb([]);
                await new DrizzleCryptoAssetRepository(db).search(query, 10);
                const { params } = new PgDialect().sqlToQuery(
                    orderBy.mock.calls[0][0] as SQL
                );
                expect(params).toContain(`${escaped}%`);
            });
        });

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
            // 1st arg: relevance CASE — exact match, then prefix match, then the rest.
            const rendered = renderSql(orderByArgs[0]);
            expect(rendered.sql.replace(/\s+/g, ' ').trim()).toBe(
                'CASE WHEN lower("crypto_assets"."korean_name") = lower($1) OR lower("crypto_assets"."symbol") = lower($2) OR lower("crypto_assets"."name") = lower($3) THEN $4 WHEN "crypto_assets"."korean_name" ILIKE $5 OR "crypto_assets"."symbol" ILIKE $6 OR "crypto_assets"."name" ILIKE $7 THEN $8 ELSE $9 END'
            );
            // 순위 값(정확 0 < 접두 1 < 그 외 2)이 곧 정렬 계약이다.
            expect(rendered.params).toEqual([
                'btc',
                'btc',
                'btc',
                0,
                'btc%',
                'btc%',
                'btc%',
                1,
                2,
            ]);
            // 2nd arg: desc(cryptoAssets.circulatingSupply) tie-break.
            expect(orderColumnName(orderByArgs[1])).toBe(
                'circulating_supply desc'
            );
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
            // The or() expression passed to .where() must reference the korean_name column;
            // the rendered SQL fails this assertion if korean_name is removed from the
            // ilike OR-condition.
            const condition = where.mock.calls[0][0];
            expect(collectColumnNames(condition)).toContain('korean_name');
        });
    });
});
