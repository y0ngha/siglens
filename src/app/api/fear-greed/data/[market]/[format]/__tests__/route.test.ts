const mocks = vi.hoisted(() => ({
    getMarketFearGreedStatic: vi.fn(),
    getMarketFearGreedKrStatic: vi.fn(),
    getMarketFearGreedCryptoStatic: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: mocks.getMarketFearGreedStatic,
}));
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({ getMarketFearGreedKrStatic: mocks.getMarketFearGreedKrStatic })
);
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache',
    () => ({
        getMarketFearGreedCryptoStatic: mocks.getMarketFearGreedCryptoStatic,
    })
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    hubView,
    scoredHistory,
} from '@/__tests__/utils/marketFearGreedHubView';
import { GET } from '../route';

const SNAPSHOT = {
    score: 50,
    label: 'NEUTRAL',
    factors: [{ key: 'momentum', rawValue: 1.5, percentile: 60 }],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-11-05',
} as const;

const READY = hubView({
    snapshot: SNAPSHOT,
    history: scoredHistory(25, '2026-11-05'),
});

function call(market: string, format: string, host = 'siglens.io') {
    return GET(
        new Request(`https://${host}/api/fear-greed/data/${market}/${format}`, {
            headers: { host },
        }),
        { params: Promise.resolve({ market, format }) }
    );
}

describe('GET /api/fear-greed/data/[market]/[format]', () => {
    beforeEach(() => {
        mocks.getMarketFearGreedStatic.mockResolvedValue(READY);
        mocks.getMarketFearGreedKrStatic.mockResolvedValue(READY);
        mocks.getMarketFearGreedCryptoStatic.mockResolvedValue(READY);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('us csv는 200과 네 헤더, 정확한 첫 두 줄을 돌려준다', async () => {
        const res = await call('us', 'csv');
        const lines = (await res.text()).split('\n');

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
        expect(res.headers.get('Cache-Control')).toBe(
            'public, max-age=3600, stale-while-revalidate=3600'
        );
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
        expect(res.headers.get('Content-Disposition')).toBe(
            'inline; filename="siglens-fear-greed-us.csv"'
        );
        expect(lines[0]).toBe('date,score,label');
        expect(lines[1]).toBe(
            `${READY.history[0].date},${READY.history[0].score},${READY.history[0].label}`
        );
        // 헤더 + 25점 + 끝 줄바꿈 뒤 빈 문자열
        expect(lines).toHaveLength(27);
    });

    it('json은 정해진 키만 싣고 가격·요인 값이 없다', async () => {
        const res = await call('us', 'json');
        const text = await res.text();
        const body = JSON.parse(text) as {
            points: unknown[];
        };

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(
            'application/json; charset=utf-8'
        );
        expect(res.headers.get('Content-Disposition')).toBe(
            'inline; filename="siglens-fear-greed-us.json"'
        );
        expect(Object.keys(body)).toEqual([
            'schemaVersion',
            'market',
            'asOf',
            'dateTimeZone',
            'scoreRange',
            'source',
            'methodology',
            'license',
            'points',
        ]);
        expect(body.points).toHaveLength(25);
        expect(text).not.toContain('close');
        expect(text).not.toContain('rawValue');
    });

    it.each([
        ['us', 'getMarketFearGreedStatic'],
        ['kr', 'getMarketFearGreedKrStatic'],
        ['crypto', 'getMarketFearGreedCryptoStatic'],
    ] as const)('%s는 자기 로더만 부른다', async (market, loaderName) => {
        await call(market, 'csv');

        expect(mocks[loaderName]).toHaveBeenCalledTimes(1);
        Object.entries(mocks)
            .filter(([name]) => name !== loaderName)
            .forEach(([, other]) => {
                expect(other).not.toHaveBeenCalled();
            });
    });

    it('알 수 없는 파라미터는 로더를 부르지 않고 noindex 404다', async () => {
        const res = await call('jp', 'csv');

        expect(res.status).toBe(404);
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
        expect(await res.text()).toBe('');
        expect(mocks.getMarketFearGreedStatic).not.toHaveBeenCalled();
    });

    it('로더가 reject하면 503, Retry-After, no-store이고 한 번 로그한다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getMarketFearGreedStatic.mockRejectedValue(new Error('FMP down'));

        const res = await call('us', 'csv');

        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('300');
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
        expect(await res.text()).toBe(
            'Fear and greed data temporarily unavailable'
        );
        expect(error).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledWith(
            '[fear-greed-data] load failed:',
            'us',
            expect.anything()
        );
    });

    it('스냅샷이 없으면 503이다', async () => {
        mocks.getMarketFearGreedKrStatic.mockResolvedValue(hubView());

        const res = await call('kr', 'json');

        expect(res.status).toBe(503);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('점이 19개면 503이다', async () => {
        mocks.getMarketFearGreedCryptoStatic.mockResolvedValue(
            hubView({
                snapshot: SNAPSHOT,
                history: scoredHistory(19, '2026-11-05'),
            })
        );

        const res = await call('crypto', 'csv');

        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('300');
    });

    it('ai 호스트는 404이고 로더를 부르지 않는다', async () => {
        const res = await call('us', 'csv', 'ai.siglens.io');

        expect(res.status).toBe(404);
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
        expect(mocks.getMarketFearGreedStatic).not.toHaveBeenCalled();
    });
});
