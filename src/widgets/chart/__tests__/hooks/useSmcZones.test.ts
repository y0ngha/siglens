// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { SMCResult } from '@y0ngha/siglens-core';
import { useSmcZones } from '../../hooks/useSmcZones';
import { buildSmcZoneLines } from '../../utils/smcZoneUtils';

const mockCreatePriceLine = vi.fn(() => ({ id: 'pl' }));
const mockRemovePriceLine = vi.fn();

vi.mock('lightweight-charts', () => ({
    LineStyle: { Dashed: 2 },
}));

function makeSeriesRef(series: unknown = makeSeries()) {
    return { current: series } as Parameters<
        typeof useSmcZones
    >[0]['seriesRef'];
}
function makeSeries() {
    return {
        createPriceLine: mockCreatePriceLine,
        removePriceLine: mockRemovePriceLine,
    };
}

function smc(overrides: Partial<SMCResult>): SMCResult {
    return {
        swingHighs: [],
        swingLows: [],
        orderBlocks: [],
        fairValueGaps: [],
        equalHighs: [],
        equalLows: [],
        premiumZone: null,
        discountZone: null,
        equilibriumZone: null,
        structureBreaks: [],
        ...overrides,
    };
}

const THREE_ZONES = smc({
    premiumZone: { high: 110, low: 105, type: 'premium' },
    discountZone: { high: 95, low: 90, type: 'discount' },
    equilibriumZone: { high: 101, low: 99, type: 'equilibrium' },
});

describe('useSmcZones', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create lines when series is null', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(null),
                smc: THREE_ZONES,
                isVisible: true,
            })
        );
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('creates 5 price lines for three zones when visible', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: THREE_ZONES,
                isVisible: true,
            })
        );
        expect(mockCreatePriceLine).toHaveBeenCalledTimes(5);
    });

    it('does not create lines when not visible', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: THREE_ZONES,
                isVisible: false,
            })
        );
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('does not create lines when there are no zones', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: smc({}),
                isVisible: true,
            })
        );
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('removes existing lines when toggled off', () => {
        const series = makeSeries();
        const { rerender } = renderHook(props => useSmcZones(props), {
            initialProps: {
                seriesRef: makeSeriesRef(series),
                smc: THREE_ZONES,
                isVisible: true,
            },
        });
        rerender({
            seriesRef: makeSeriesRef(series),
            smc: THREE_ZONES,
            isVisible: false,
        });
        expect(mockRemovePriceLine).toHaveBeenCalledTimes(5);
    });

    it('passes the first line spec from buildSmcZoneLines to createPriceLine', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: THREE_ZONES,
                isVisible: true,
            })
        );
        const expected = buildSmcZoneLines(THREE_ZONES)[0];
        expect(mockCreatePriceLine).toHaveBeenCalledWith(
            expect.objectContaining({
                price: expected.price,
                color: expected.color,
                title: expected.title,
            })
        );
    });
});
