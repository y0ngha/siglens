import { renderHook } from '@testing-library/react';
import { useAnalysisDerivedData } from '@/views/symbol/hooks/useAnalysisDerivedData';
import type {
    AnalysisResponse,
    Bar,
    ClusteredKeyLevels,
    ReconciledActionLineData,
    ValidatedActionPrices,
} from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', () => ({
    validateKeyLevels: vi.fn((kl: unknown) => kl ?? []),
    clusterKeyLevels: vi.fn(
        (_validated: unknown, _close: unknown) =>
            ({
                support: [{ price: 100, strength: 2 }],
                resistance: [{ price: 200, strength: 3 }],
                poc: undefined,
            }) as unknown as ClusteredKeyLevels
    ),
    validateActionPrices: vi.fn(
        (ar: unknown) =>
            (ar ? { entry: 150 } : undefined) as unknown as
                | ValidatedActionPrices
                | undefined
    ),
    extractReconciledActionLines: vi.fn(
        (ar: unknown) =>
            (ar ? { lines: [] } : undefined) as unknown as
                | ReconciledActionLineData
                | undefined
    ),
}));

const makeBars = (count: number): Bar[] =>
    Array.from({ length: count }, (_, i) => ({
        time: 1000 + i,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000,
    })) as unknown as Bar[];

const ANALYSIS = {
    keyLevels: [{ price: 100 }],
    actionRecommendation: { entry: 150 },
} as unknown as AnalysisResponse;

describe('useAnalysisDerivedData', () => {
    it('returns clustered key levels from bars', () => {
        const bars = makeBars(3);
        const { result } = renderHook(() =>
            useAnalysisDerivedData(ANALYSIS, bars)
        );

        expect(result.current.clusteredKeyLevels.support).toHaveLength(1);
        expect(result.current.clusteredKeyLevels.resistance).toHaveLength(1);
    });

    it('returns empty key levels when bars are empty', () => {
        const { result } = renderHook(() =>
            useAnalysisDerivedData(ANALYSIS, [])
        );

        expect(result.current.clusteredKeyLevels.support).toEqual([]);
        expect(result.current.clusteredKeyLevels.resistance).toEqual([]);
        expect(result.current.clusteredKeyLevels.poc).toBeUndefined();
    });

    it('returns validated action prices', () => {
        const bars = makeBars(1);
        const { result } = renderHook(() =>
            useAnalysisDerivedData(ANALYSIS, bars)
        );

        expect(result.current.validatedActionPrices).toEqual({ entry: 150 });
    });

    it('returns undefined action prices when actionRecommendation is null', () => {
        const noAction = {
            ...ANALYSIS,
            actionRecommendation: null,
        } as unknown as AnalysisResponse;
        const bars = makeBars(1);
        const { result } = renderHook(() =>
            useAnalysisDerivedData(noAction, bars)
        );

        expect(result.current.validatedActionPrices).toBeUndefined();
    });

    it('returns reconciled action lines', () => {
        const bars = makeBars(1);
        const { result } = renderHook(() =>
            useAnalysisDerivedData(ANALYSIS, bars)
        );

        expect(result.current.reconciledActionLines).toBeDefined();
    });
});
