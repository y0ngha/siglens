'use client';

import { useMemo } from 'react';
import type {
    AnalysisResponse,
    Bar,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    ReconciledActionLineData,
    ValidatedActionPrices,
} from '@/domain/types';
import {
    clusterKeyLevels,
    validateKeyLevels,
} from '@/domain/analysis/keyLevels';
import {
    extractReconciledActionLines,
    validateActionPrices,
} from '@/domain/analysis/actionRecommendation';

const EMPTY_CLUSTERED_KEY_LEVELS = {
    support: [] as ClusteredKeyLevel[],
    resistance: [] as ClusteredKeyLevel[],
    poc: undefined,
} as const satisfies ClusteredKeyLevels;

interface UseAnalysisDerivedDataReturn {
    clusteredKeyLevels: ClusteredKeyLevels;
    validatedActionPrices: ValidatedActionPrices | undefined;
    reconciledActionLines: ReconciledActionLineData | undefined;
}

// 여러 훅/컴포넌트가 동일 deps로 반복 메모하지 않도록 파생 데이터를 한 곳에 집중한다.
export function useAnalysisDerivedData(
    analysis: AnalysisResponse,
    bars: Bar[]
): UseAnalysisDerivedDataReturn {
    const validatedKeyLevels = useMemo(
        () => validateKeyLevels(analysis.keyLevels),
        [analysis.keyLevels]
    );

    const clusteredKeyLevels = useMemo(() => {
        const lastBar = bars[bars.length - 1];
        if (!lastBar) return EMPTY_CLUSTERED_KEY_LEVELS;
        return clusterKeyLevels(validatedKeyLevels, lastBar.close);
    }, [validatedKeyLevels, bars]);

    const validatedActionPrices = useMemo(
        () => validateActionPrices(analysis.actionRecommendation),
        [analysis.actionRecommendation]
    );

    const reconciledActionLines = useMemo(
        () => extractReconciledActionLines(analysis.actionRecommendation),
        [analysis.actionRecommendation]
    );

    return {
        clusteredKeyLevels,
        validatedActionPrices,
        reconciledActionLines,
    };
}
