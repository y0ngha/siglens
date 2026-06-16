import { describe, expect, it, vi } from 'vitest';
import { DrizzleMarketNewsRepository } from '../api';
import type { MarketNewsDbRow } from '../api';
import type { MarketNewsItem } from '../lib/marketNewsClientPort';
import type { NewsCardAnalysis } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';

vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));

const ITEM: MarketNewsItem = {
    id: 'm1',
    symbol: '__NEWS_CRYPTO__',
    source: 'CoinWire',
    url: 'https://x.com/btc',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC up',
    bodyEn: 'body',
    tickers: ['BTCUSD'],
};

function makeUpsertDb(returned: { id: string }[]) {
    const chain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returned),
    };
    return {
        insert: vi.fn(() => chain),
    } as unknown as SiglensDatabase;
}

/** Build a mock `db` that handles update→set→where chains. */
function makeUpdateDb(): {
    db: SiglensDatabase;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    return {
        db: { update } as unknown as SiglensDatabase,
        update,
        set,
        where,
    };
}

/** Build a mock `db` for a select…from…where…orderBy chain returning `rows`. */
function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
} {
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        orderBy,
    };
}

describe('DrizzleMarketNewsRepository.upsertMarketNewsItem은', () => {
    it('row가 삽입/변경되면 true를 반환한다', async () => {
        const repo = new DrizzleMarketNewsRepository(
            makeUpsertDb([{ id: 'm1' }])
        );
        expect(await repo.upsertMarketNewsItem(ITEM)).toBe(true);
    });

    it('변경이 없으면 false를 반환한다(revalidate skip)', async () => {
        const repo = new DrizzleMarketNewsRepository(makeUpsertDb([]));
        expect(await repo.upsertMarketNewsItem(ITEM)).toBe(false);
    });
});

describe('DrizzleMarketNewsRepository.attachAnalysis는', () => {
    const analysis: NewsCardAnalysis = {
        titleKo: 'BTC 급등',
        bodyKo: '비트코인 본문',
        summaryKo: 'BTC 요약',
        sentiment: 'bullish',
        category: 'macro',
        priceImpact: 'high',
    };

    it('update → set → where 체인을 호출하고 분석 필드를 전달한다', async () => {
        const { db, update, set, where } = makeUpdateDb();
        const repo = new DrizzleMarketNewsRepository(db);
        const analyzedAt = new Date('2026-06-15T12:00:00.000Z');
        await repo.attachAnalysis('m1', analysis, analyzedAt);

        expect(update).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledTimes(1);
        expect(where).toHaveBeenCalledTimes(1);

        const setArg = set.mock.calls[0][0] as Record<string, unknown>;
        expect(setArg['titleKo']).toBe('BTC 급등');
        expect(setArg['sentiment']).toBe('bullish');
        expect(setArg['category']).toBe('macro');
        expect(setArg['priceImpact']).toBe('high');
        expect(setArg['analyzedAt']).toBe(analyzedAt);
    });
});

describe('DrizzleMarketNewsRepository.listByCategory는', () => {
    const baseDbRow: MarketNewsDbRow = {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x.com/btc',
        publishedAt: new Date('2026-06-15T10:00:00.000Z'),
        titleEn: 'BTC up',
        bodyEn: 'body text',
        titleKo: null,
        bodyKo: null,
        summaryKo: null,
        sentiment: null,
        category: null,
        priceImpact: null,
        tickers: ['BTCUSD'],
        analyzedAt: null,
    };

    it('유효한 DB row를 MarketNewsRow로 매핑하고 tickers를 그대로 전달한다', async () => {
        const analyzedRow: MarketNewsDbRow = {
            ...baseDbRow,
            titleKo: 'BTC 급등',
            summaryKo: 'BTC 요약',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
            analyzedAt: new Date('2026-06-15T12:00:00.000Z'),
        };
        const { db } = makeSelectDb([analyzedRow]);
        const repo = new DrizzleMarketNewsRepository(db);
        const results = await repo.listByCategory(
            '__NEWS_CRYPTO__',
            86_400_000
        );

        expect(results).toHaveLength(1);
        const row = results[0]!;
        expect(row.id).toBe('m1');
        expect(row.publishedAt).toBe('2026-06-15T10:00:00.000Z');
        expect(row.sentiment).toBe('bullish');
        expect(row.category).toBe('macro');
        expect(row.priceImpact).toBe('high');
        // tickers는 그대로 전달돼야 한다
        expect(row.tickers).toEqual(['BTCUSD']);
        expect(row.symbol).toBe('__NEWS_CRYPTO__');
    });

    it('알 수 없는 enum 문자열(sentiment/category/priceImpact)은 null로 정규화한다', async () => {
        const corruptRow: MarketNewsDbRow = {
            ...baseDbRow,
            sentiment: 'garbage',
            category: 'bogus',
            priceImpact: 'nope',
        };
        const { db } = makeSelectDb([corruptRow]);
        const repo = new DrizzleMarketNewsRepository(db);
        const results = await repo.listByCategory(
            '__NEWS_CRYPTO__',
            86_400_000
        );

        expect(results).toHaveLength(1);
        const row = results[0]!;
        expect(row.sentiment).toBeNull();
        expect(row.category).toBeNull();
        expect(row.priceImpact).toBeNull();
    });

    it('결과가 없으면 빈 배열을 반환한다', async () => {
        const { db } = makeSelectDb([]);
        const repo = new DrizzleMarketNewsRepository(db);
        const results = await repo.listByCategory(
            '__NEWS_CRYPTO__',
            86_400_000
        );
        expect(results).toEqual([]);
    });
});
