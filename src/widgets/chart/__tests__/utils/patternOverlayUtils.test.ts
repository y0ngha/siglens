import type { PatternResult } from '@y0ngha/siglens-core';
import {
    isDetectedAndVisible,
    removeHidden,
    removeSeries,
} from '@/widgets/chart/utils/patternOverlayUtils';

function makePatternResult(
    overrides: Partial<PatternResult> = {}
): PatternResult {
    return {
        id: 'test-id',
        patternName: 'head_and_shoulders',
        skillName: 'test-skill',
        detected: false,
        trend: 'bullish',
        summary: 'Test pattern summary',
        confidenceWeight: 1,
        ...overrides,
    };
}

describe('isDetectedAndVisible', () => {
    it('returns true when detected is true and renderConfig.show is true', () => {
        const pattern = makePatternResult({
            detected: true,
            renderConfig: {
                show: true,
                type: 'line',
                color: '#ff0000',
                label: 'Test',
            },
        });

        expect(isDetectedAndVisible(pattern)).toBe(true);
    });

    it('returns false when detected is false', () => {
        const pattern = makePatternResult({
            detected: false,
            renderConfig: {
                show: true,
                type: 'line',
                color: '#ff0000',
                label: 'Test',
            },
        });

        expect(isDetectedAndVisible(pattern)).toBe(false);
    });

    it('returns false when renderConfig.show is false', () => {
        const pattern = makePatternResult({
            detected: true,
            renderConfig: {
                show: false,
                type: 'line',
                color: '#ff0000',
                label: 'Test',
            },
        });

        expect(isDetectedAndVisible(pattern)).toBe(false);
    });

    it('returns false when renderConfig is undefined', () => {
        const pattern = makePatternResult({
            detected: true,
            renderConfig: undefined,
        });

        expect(isDetectedAndVisible(pattern)).toBe(false);
    });
});

describe('removeHidden', () => {
    it('removes entries not in visiblePatterns set', () => {
        const cleanup = vi.fn();
        const map = new Map([
            ['patternA', 'valueA'],
            ['patternB', 'valueB'],
            ['patternC', 'valueC'],
        ]);
        const visiblePatterns = new Set(['patternA', 'patternC']);

        removeHidden(map, visiblePatterns, cleanup);

        expect(map.size).toBe(2);
        expect(map.has('patternB')).toBe(false);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledWith('valueB');
    });

    it('does nothing when all entries are visible', () => {
        const cleanup = vi.fn();
        const map = new Map([
            ['patternA', 'valueA'],
            ['patternB', 'valueB'],
        ]);
        const visiblePatterns = new Set(['patternA', 'patternB']);

        removeHidden(map, visiblePatterns, cleanup);

        expect(map.size).toBe(2);
        expect(cleanup).not.toHaveBeenCalled();
    });

    it('removes all entries when visiblePatterns is empty', () => {
        const cleanup = vi.fn();
        const map = new Map([
            ['patternA', 'valueA'],
            ['patternB', 'valueB'],
        ]);

        removeHidden(map, new Set(), cleanup);

        expect(map.size).toBe(0);
        expect(cleanup).toHaveBeenCalledTimes(2);
    });

    it('handles empty map', () => {
        const cleanup = vi.fn();
        const map = new Map<string, string>();

        removeHidden(map, new Set(['x']), cleanup);

        expect(map.size).toBe(0);
        expect(cleanup).not.toHaveBeenCalled();
    });
});

describe('removeSeries', () => {
    it('calls chart.removeSeries for each series in the list', () => {
        const mockChart = { removeSeries: vi.fn() };
        const series1 = { id: 1 };
        const series2 = { id: 2 };

        removeSeries(mockChart as never, [series1, series2] as never);

        expect(mockChart.removeSeries).toHaveBeenCalledTimes(2);
        expect(mockChart.removeSeries).toHaveBeenCalledWith(series1);
        expect(mockChart.removeSeries).toHaveBeenCalledWith(series2);
    });

    it('does nothing for empty series list', () => {
        const mockChart = { removeSeries: vi.fn() };

        removeSeries(mockChart as never, []);

        expect(mockChart.removeSeries).not.toHaveBeenCalled();
    });
});
