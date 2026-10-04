vi.mock('server-only', () => ({}));

const { mockUs, mockKr, mockCrypto } = vi.hoisted(() => ({
    mockUs: vi.fn(),
    mockKr: vi.fn(),
    mockCrypto: vi.fn(),
}));

vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: mockUs,
}));
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({
        getMarketFearGreedKrStatic: mockKr,
    })
);
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache',
    () => ({ getMarketFearGreedCryptoStatic: mockCrypto })
);

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMarketFearGreedReading } from '@/entities/market-fear-greed/api/marketFearGreedReading';

function view(score: number, asOf: string) {
    return {
        snapshot: {
            score,
            label: 'NEUTRAL' as const,
            factors: [],
            confidence: 'normal' as const,
            sampleSize: 500,
            asOf,
        },
        comparisons: [],
    };
}

describe('getMarketFearGreedReading', () => {
    beforeEach(() => {
        mockUs.mockResolvedValue(view(46, '2026-10-02'));
        mockKr.mockResolvedValue(view(52, '2026-10-02'));
        mockCrypto.mockResolvedValue(view(30, '2026-10-04'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['us-equity', { date: '2026-10-02', score: 46 }],
        ['kr-equity', { date: '2026-10-02', score: 52 }],
        ['crypto', { date: '2026-10-04', score: 30 }],
    ] as const)(
        '%s는 그 시장 허브와 같은 정적 캐시의 스냅샷을 날짜·점수로 돌려준다',
        async (profile, expected) => {
            const reading = await getMarketFearGreedReading(profile);

            expect(reading).toEqual({ ...expected, label: 'NEUTRAL' });
        }
    );

    it('스냅샷이 없으면 null이다', async () => {
        mockUs.mockResolvedValue({ snapshot: null, comparisons: [] });

        expect(await getMarketFearGreedReading('us-equity')).toBeNull();
    });

    it('조회가 실패하면 페이지를 죽이지 않고 null을 돌려준다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockKr.mockRejectedValue(new Error('upstream down'));

        expect(await getMarketFearGreedReading('kr-equity')).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[getMarketFearGreedReading]'),
            expect.any(Error)
        );
    });
});
