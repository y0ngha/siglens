// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ValidatedActionPrices } from '@y0ngha/siglens-core';
import { useActionRecommendationOverlay } from '../../hooks/useActionRecommendationOverlay';

const mockCreatePriceLine = vi.fn(() => ({ id: Math.random() }));
const mockRemovePriceLine = vi.fn();

vi.mock('lightweight-charts', () => ({
    LineStyle: { Dashed: 1, LargeDashed: 2 },
}));

function makeSeries() {
    return {
        createPriceLine: mockCreatePriceLine,
        removePriceLine: mockRemovePriceLine,
    };
}

function makeSeriesRef(series: ReturnType<typeof makeSeries> | null = null) {
    return { current: series } as Parameters<
        typeof useActionRecommendationOverlay
    >[0]['seriesRef'];
}

const BASE_ACTION_PRICES: ValidatedActionPrices = {
    entryPrices: [150],
    stopLoss: 140,
    takeProfitPrices: [160, 170],
};

describe('useActionRecommendationOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does nothing when seriesRef is null', () => {
        renderHook(() =>
            useActionRecommendationOverlay({
                seriesRef: makeSeriesRef(null),
                actionPrices: BASE_ACTION_PRICES,
                isVisible: true,
            })
        );

        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('does nothing when isVisible is false', () => {
        renderHook(() =>
            useActionRecommendationOverlay({
                seriesRef: makeSeriesRef(makeSeries()),
                actionPrices: BASE_ACTION_PRICES,
                isVisible: false,
            })
        );

        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('does nothing when actionPrices is undefined', () => {
        renderHook(() =>
            useActionRecommendationOverlay({
                seriesRef: makeSeriesRef(makeSeries()),
                actionPrices: undefined,
                isVisible: true,
            })
        );

        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('creates price lines for entry, stopLoss, and takeProfit', () => {
        renderHook(() =>
            useActionRecommendationOverlay({
                seriesRef: makeSeriesRef(makeSeries()),
                actionPrices: BASE_ACTION_PRICES,
                isVisible: true,
            })
        );

        // 1 entry + 1 stopLoss + 2 takeProfit = 4
        expect(mockCreatePriceLine).toHaveBeenCalledTimes(4);
    });

    it('skips stopLoss line when stopLoss is undefined', () => {
        const prices: ValidatedActionPrices = {
            entryPrices: [150],
            stopLoss: undefined,
            takeProfitPrices: [160],
        };

        renderHook(() =>
            useActionRecommendationOverlay({
                seriesRef: makeSeriesRef(makeSeries()),
                actionPrices: prices,
                isVisible: true,
            })
        );

        // 1 entry + 0 stopLoss + 1 takeProfit = 2
        expect(mockCreatePriceLine).toHaveBeenCalledTimes(2);
    });

    it('creates reconciled price lines when reconciledPrices provided', () => {
        renderHook(() =>
            useActionRecommendationOverlay({
                seriesRef: makeSeriesRef(makeSeries()),
                actionPrices: BASE_ACTION_PRICES,
                reconciledPrices: {
                    stopLoss: 138,
                    takeProfitPrices: [{ price: 162, index: 0, totalCount: 1 }],
                },
                isVisible: true,
            })
        );

        // 1 entry + 1 stopLoss + 2 takeProfit + 1 reconciledSL + 1 reconciledTP = 6
        expect(mockCreatePriceLine).toHaveBeenCalledTimes(6);
    });

    it('removes existing price lines on re-render', () => {
        const series = makeSeries();
        const { rerender } = renderHook(
            ({ visible }) =>
                useActionRecommendationOverlay({
                    seriesRef: makeSeriesRef(series),
                    actionPrices: BASE_ACTION_PRICES,
                    isVisible: visible,
                }),
            { initialProps: { visible: true } }
        );

        rerender({ visible: false });

        expect(mockRemovePriceLine).toHaveBeenCalled();
    });
});
