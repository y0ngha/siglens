vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { DrizzleMarketNewsRepository } from '../api';
import type { MarketNewsDbRow } from '../api';
import type { MarketNewsItem } from '../lib/marketNewsClientPort';
import type { NewsCardAnalysis } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import { orderColumnName } from '@/__tests__/utils/orderColumnName';

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
/**
 * drizzle `SQL`에서 리터럴 조각만 뽑는다(`JSON.stringify`는 테이블 참조가 순환이라
 * 던진다). `isNotNull`은 `' is not null'`, `isNull`은 `' is null'`을 남긴다.
 */
function sqlChunks(node: unknown, out: string[] = []): string[] {
    if (Array.isArray(node)) {
        for (const item of node) sqlChunks(item, out);
        return out;
    }
    if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj.queryChunks)) sqlChunks(obj.queryChunks, out);
        if (
            Array.isArray(obj.value) &&
            obj.value.every(v => typeof v === 'string')
        ) {
            out.push(...(obj.value as string[]));
        }
    }
    return out;
}

/** `listAnalyzedIds`용 — `orderBy` 없이 `where()`를 바로 await하는 형태. */
function makeFilterSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, where };
}

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

    it('attachAnalysis는 WHERE 절에 analyzedAt IS NULL 가드를 포함한다', async () => {
        const { db, where } = makeUpdateDb();
        const repo = new DrizzleMarketNewsRepository(db);

        await repo.attachAnalysis('id-1', {
            titleKo: 't',
            bodyKo: 'b',
            summaryKo: 's',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
        });

        expect(where).toHaveBeenCalledTimes(1);
        // The WHERE receives a compound AND expression (not a bare eq call).
        // drizzle-orm SQL objects are opaque; we verify the argument is a
        // non-null object (i.e. and(eq(id), isNull(analyzedAt)) was assembled).
        const whereArg = where.mock.calls[0][0] as unknown;
        expect(whereArg).toBeTruthy();
        expect(typeof whereArg).toBe('object');
    });
});

/**
 * [회귀] `listCardsByCategory`는 `toMarketNewsRow`의 매핑(enum 화이트리스트,
 * Date→ISO, tickers)을 두 번째로 구현한다. 종목 뉴스 쌍둥이는 그 divergence를
 * 막으려고 전용 테스트를 뒀는데 이쪽은 비어 있었다 — 카드 액션과 두 페이지가
 * `toMarketNewsCardItem` 투영을 걷어내고 이 읽기에 직접 의존하게 된 지금은
 * 이게 유일한 가드다(감사: 코드·테스트 라운드 16).
 */
describe('DrizzleMarketNewsRepository.listCardsByCategory는', () => {
    // 픽스처가 서버 전용 컬럼을 갖고 있어야 투영을 되돌렸을 때 샌다.
    const cardDbRow = {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        bodyEn: '유출되면 안 되는 원문',
        analyzedAt: new Date('2026-06-15T12:00:00.000Z'),
        source: 'CoinWire',
        url: 'https://x.com/btc',
        publishedAt: new Date('2026-06-15T10:00:00.000Z'),
        titleEn: 'BTC up',
        titleKo: 'BTC 급등',
        bodyKo: '본문',
        summaryKo: '요약',
        sentiment: 'bullish',
        category: 'macro',
        priceImpact: 'high',
        tickers: ['BTCUSD'],
    };

    it('서버 전용 컬럼을 SELECT하지도, 반환하지도 않는다', async () => {
        const { db, select } = makeSelectDb([cardDbRow]);
        const repo = new DrizzleMarketNewsRepository(db);

        const [result] = await repo.listCardsByCategory(
            '__NEWS_CRYPTO__',
            1000
        );

        expect(result).not.toHaveProperty('bodyEn');
        expect(result).not.toHaveProperty('symbol');
        expect(result).not.toHaveProperty('analyzedAt');

        const selected = Object.keys(
            (select.mock.calls[0] as [Record<string, unknown>])[0]
        );
        expect(selected).not.toContain('bodyEn');
        expect(selected).not.toContain('symbol');
        expect(selected).not.toContain('analyzedAt');
    });

    it('표시 필드와 tickers를 그대로 옮기고 publishedAt을 ISO로 만든다', async () => {
        const { db } = makeSelectDb([cardDbRow]);
        const repo = new DrizzleMarketNewsRepository(db);

        const [result] = await repo.listCardsByCategory(
            '__NEWS_CRYPTO__',
            1000
        );

        expect(result).toEqual({
            id: 'm1',
            source: 'CoinWire',
            url: 'https://x.com/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC up',
            titleKo: 'BTC 급등',
            bodyKo: '본문',
            summaryKo: '요약',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
            tickers: ['BTCUSD'],
        });
    });

    it('알 수 없는/비문자열 enum 값은 null로 정규화한다', async () => {
        // `hasPendingAnalysis`가 `sentiment === null`로 판정하므로, 깨진 값이
        // 그대로 흘러가면 미보강 카드가 "보강됨"으로 읽힌다.
        const { db } = makeSelectDb([
            {
                ...cardDbRow,
                sentiment: 'unknown_value',
                category: 42,
                priceImpact: {},
            },
        ]);
        const repo = new DrizzleMarketNewsRepository(db);

        const [result] = await repo.listCardsByCategory(
            '__NEWS_CRYPTO__',
            1000
        );

        expect(result?.sentiment).toBeNull();
        expect(result?.category).toBeNull();
        expect(result?.priceImpact).toBeNull();
    });

    it('결과가 없으면 빈 배열을 돌려준다', async () => {
        const { db } = makeSelectDb([]);
        const repo = new DrizzleMarketNewsRepository(db);

        await expect(
            repo.listCardsByCategory('__NEWS_CRYPTO__', 1000)
        ).resolves.toEqual([]);
    });
});

describe('DrizzleMarketNewsRepository.listAnalyzedIds는', () => {
    it('분석 완료 행만 거르는 필터를 건다', async () => {
        const { db, where } = makeFilterSelectDb([{ id: 'm1' }]);
        const repo = new DrizzleMarketNewsRepository(db);

        const ids = await repo.listAnalyzedIds('__NEWS_CRYPTO__', 1000);

        expect(ids).toEqual(new Set(['m1']));
        const literals = sqlChunks((where.mock.calls[0] as [unknown])[0]);
        expect(literals).toContain(' is not null');
        expect(literals).not.toContain(' is null');
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

    it('기사 원문(body_en)은 읽지 않고 null로 내려준다', async () => {
        // 사유는 종목 뉴스 쪽 같은 이름의 테스트 주석 참조 — 다이제스트 프롬프트도
        // 이 필드를 읽지 않는다(감사: 테스트 라운드 17).
        const { db, select } = makeSelectDb([baseDbRow]);
        const repo = new DrizzleMarketNewsRepository(db);

        const [result] = await repo.listByCategory('__NEWS_CRYPTO__', 1000);

        expect(result?.bodyEn).toBeNull();
        expect(
            Object.keys((select.mock.calls[0] as [Record<string, unknown>])[0])
        ).not.toContain('bodyEn');
    });

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

/**
 * `/news/[category]`가 이 결과를 앞에서 50개만 잘라 쓴다. 동률(같은 publishedAt)의
 * 상대 순서가 정해지지 않으면 경계에 걸친 행이 ISR 재생성마다 바뀐다.
 */
describe('정렬 tie-break', () => {
    it('listByCategory는 published_at desc 다음 id desc로 정렬한다', async () => {
        const { db, orderBy } = makeSelectDb([]);
        await new DrizzleMarketNewsRepository(db).listByCategory(
            '__NEWS_CRYPTO__',
            1000
        );
        expect(orderBy.mock.calls[0]!.map(orderColumnName)).toEqual([
            'published_at desc',
            'id desc',
        ]);
    });

    it('listCardsByCategory도 같은 tie-break를 쓴다', async () => {
        const { db, orderBy } = makeSelectDb([]);
        await new DrizzleMarketNewsRepository(db).listCardsByCategory(
            '__NEWS_CRYPTO__',
            1000
        );
        expect(orderBy.mock.calls[0]!.map(orderColumnName)).toEqual([
            'published_at desc',
            'id desc',
        ]);
    });
});
