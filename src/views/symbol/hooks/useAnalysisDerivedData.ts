'use client';

import { useMemo } from 'react';
import {
    type AnalysisResponse,
    type Bar,
    type ClusteredKeyLevel,
    type ClusteredKeyLevels,
    type ReconciledActionLineData,
    type ValidatedActionPrices,
    clusterKeyLevels,
    validateKeyLevels,
    extractReconciledActionLines,
    validateActionPrices,
} from '@y0ngha/siglens-core';

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

/**
 * 분석·봉에서 키 레벨 클러스터와 검증된 행동 가격·행동선을 한 번씩 메모한다. 차트와 AI 패널이
 * 함께 쓰는 값이라, 여러 훅/컴포넌트가 동일 deps로 반복 메모하지 않도록 한 곳에 모은다.
 */
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
