vi.mock('@/entities/bars/server/barsStaticCache', () => ({
    getSeedBarsStatic: vi.fn(),
}));

import { QueryClient } from '@tanstack/react-query';
import type { BarsData } from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    hasTechnicalFacts,
    seedChartBars,
} from '@/app/[locale]/[symbol]/_lib/chartBarsSeed';
import { getSeedBarsStatic } from '@/entities/bars/server/barsStaticCache';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/** 봉 2개 + 직전 종가가 0이 아니어야 사실 요약을 만들 수 있다. */
function barsWith(count: number): BarsData {
    return {
        bars: Array.from({ length: count }, (_, i) => ({
            time: 1_780_000_000 + i * 86_400,
            open: 100 + i,
            high: 105 + i,
            low: 95 + i,
            close: 101 + i,
            volume: 1_000,
        })),
        indicators: {
            rsi: Array.from({ length: count }, () => null),
            macd: [],
        },
    } as unknown as BarsData;
}

const SEED_BARS = { bars: [], indicators: {} } as unknown as BarsData;

describe('hasTechnicalFacts', () => {
    it('봉이 2개 이상이면 사실 요약을 그릴 수 있다', () => {
        expect(hasTechnicalFacts(barsWith(2))).toBe(true);
    });

    it('봉이 1개면(상장폐지 등) 그릴 수 없다', () => {
        expect(hasTechnicalFacts(barsWith(1))).toBe(false);
    });
});

describe('seedChartBars', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('봉 조회가 실패했으면(null) 시드하지 않고 false다', async () => {
        const queryClient = new QueryClient();

        await expect(
            seedChartBars(queryClient, {
                ticker: 'AAPL',
                segment: 'AAPL',
                marketProfile: 'us-equity',
                fmpSymbol: 'AAPL',
                quantizedBars: null,
            })
        ).resolves.toBe(false);
        expect(getSeedBarsStatic).not.toHaveBeenCalled();
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });

    it('축소판을 기본 타임프레임 키에 마지막 봉 시각(밀리초)으로 시드한다', async () => {
        vi.mocked(getSeedBarsStatic).mockResolvedValue(SEED_BARS);
        const queryClient = new QueryClient();
        const quantizedBars = barsWith(3);

        await expect(
            seedChartBars(queryClient, {
                ticker: 'AAPL',
                segment: 'AAPL',
                marketProfile: 'us-equity',
                fmpSymbol: 'AAPL',
                quantizedBars,
            })
        ).resolves.toBe(true);

        expect(getSeedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            DEFAULT_TIMEFRAME,
            'us-equity',
            'AAPL'
        );
        const state = queryClient.getQueryState(
            QUERY_KEYS.bars('AAPL', DEFAULT_TIMEFRAME, 'AAPL')
        );
        expect(state?.data).toBe(SEED_BARS);
        expect(state?.dataUpdatedAt).toBe((1_780_000_000 + 2 * 86_400) * 1000);
    });

    it('축소 단계가 throw하면 로그를 남기고 시드 없이 false다', async () => {
        const error = new Error('shape drift');
        vi.mocked(getSeedBarsStatic).mockRejectedValue(error);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const queryClient = new QueryClient();

        await expect(
            seedChartBars(queryClient, {
                ticker: 'AAPL',
                segment: 'AAPL',
                marketProfile: 'us-equity',
                fmpSymbol: 'AAPL',
                quantizedBars: barsWith(2),
            })
        ).resolves.toBe(false);
        expect(logSpy).toHaveBeenCalledWith(
            '[SymbolPage] getSeedBarsStatic failed:',
            error
        );
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
        logSpy.mockRestore();
    });
});
