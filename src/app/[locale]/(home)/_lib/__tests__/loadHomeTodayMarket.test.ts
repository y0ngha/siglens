import type {
    FearGreedReading,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';

vi.mock('server-only', () => ({}));

const fearGreed = vi.hoisted(() => vi.fn());
vi.mock('@/entities/market-fear-greed/api/marketFearGreedReading', () => ({
    getMarketFearGreedReading: fearGreed,
}));

const sectorSignals = vi.hoisted(() => vi.fn());
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: sectorSignals,
}));

const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/shared/api/offlineBuild', () => ({
    isOfflineBuild: () => offline.value,
}));

const pins = vi.hoisted(() => ({
    build: vi.fn(async () => {}),
    runtime: vi.fn(async () => {}),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: pins.build,
    shortenRevalidateForRuntimeDegrade: pins.runtime,
}));

import { loadHomeTodayMarket } from '../loadHomeTodayMarket';

const READING: FearGreedReading = {
    date: '2026-11-13',
    score: 46,
    label: 'NEUTRAL',
};

function scan(
    symbol: string,
    computedAt = '2026-11-14T21:00:00.000Z'
): SectorSignalsResult {
    return {
        computedAt,
        stocks: [
            {
                symbol,
                koreanName: `${symbol}이름`,
                sectorSymbol: 'XLK',
                price: 100,
                changePercent: 1,
                trend: 'uptrend',
                signals: [
                    {
                        type: 'golden_cross',
                        phase: 'confirmed',
                        direction: 'bullish',
                        detectedAt: 0,
                    },
                ],
            },
        ],
    };
}

beforeEach(() => {
    offline.value = false;
    fearGreed.mockReset().mockResolvedValue(READING);
    sectorSignals
        .mockReset()
        .mockImplementation(async (scope: { id: string }) =>
            scan(scope.id === 'kr' ? '005930.KS' : 'NVDA')
        );
    pins.build.mockClear();
    pins.runtime.mockClear();
});

describe('loadHomeTodayMarket', () => {
    it('세 시장 공포탐욕과 미국·한국 신호를 모은다', async () => {
        const data = await loadHomeTodayMarket();

        expect(
            fearGreed.mock.calls.map(([market]) => market).toSorted()
        ).toEqual(['crypto', 'kr-equity', 'us-equity']);
        expect(data.fearGreed).toEqual({
            us: READING,
            kr: READING,
            crypto: READING,
        });
        expect(data.signals.us.rows.map(row => row.symbol)).toEqual(['NVDA']);
        expect(data.signals.kr.rows.map(row => row.symbol)).toEqual([
            '005930.KS',
        ]);
        expect(data.signals.us.computedAt).toBe('2026-11-14T21:00:00.000Z');
    });

    it('모두 성공하면 런타임 저하 핀을 걸지 않는다(빌드 핀 확인은 항상 한다)', async () => {
        await loadHomeTodayMarket();

        expect(pins.build).toHaveBeenCalledTimes(1);
        expect(pins.runtime).not.toHaveBeenCalled();
    });

    it('한 시장 스캔이 던져도 다른 시장은 살리고, 재생성 주기를 짧게 건다', async () => {
        sectorSignals.mockImplementation(async (scope: { id: string }) => {
            if (scope.id === 'kr') throw new Error('yahoo down');
            return scan('NVDA');
        });

        const data = await loadHomeTodayMarket();

        expect(data.signals.us.rows.map(row => row.symbol)).toEqual(['NVDA']);
        expect(data.signals.kr).toEqual({ rows: [], computedAt: null });
        expect(pins.runtime).toHaveBeenCalledTimes(1);
    });

    it('공포탐욕이 null(로더가 실패를 삼킨 경우)이면 재생성 주기를 짧게 건다', async () => {
        fearGreed.mockImplementation(async (market: string) =>
            market === 'crypto' ? null : READING
        );

        const data = await loadHomeTodayMarket();

        expect(data.fearGreed.crypto).toBeNull();
        expect(pins.runtime).toHaveBeenCalledTimes(1);
    });

    it('스캔 시각이 빈 문자열이면 null로 둔다', async () => {
        sectorSignals.mockImplementation(async () => scan('NVDA', ''));

        const data = await loadHomeTodayMarket();

        expect(data.signals.us.computedAt).toBeNull();
    });

    it('오프라인 빌드는 아무것도 부르지 않고 빈 값을 돌려준다', async () => {
        offline.value = true;

        expect(await loadHomeTodayMarket()).toEqual({
            fearGreed: { us: null, kr: null, crypto: null },
            signals: {
                us: { rows: [], computedAt: null },
                kr: { rows: [], computedAt: null },
            },
        });
        expect(fearGreed).not.toHaveBeenCalled();
        expect(sectorSignals).not.toHaveBeenCalled();
    });
});
