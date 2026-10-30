'use client';

import { useRef, useState } from 'react';
import type { OverallRequestIntent } from '../utils/fetchOverallAnalysis';

export interface OverallRequestIntentControls {
    /** 사용자가 분석 생성을 한 번이라도 요청했는지. 렌더·`enabled` 판단에 쓴다. */
    isGenerationAuthorized: boolean;
    /** 생성 요청을 허락 상태로 둔다. 이후 요청은 캐시 미스에서 생성까지 간다. */
    authorizeGeneration: () => void;
    /** 다음 요청 하나를 재분석 의도로 표시한다. 생성도 함께 허락한다. */
    markReanalyze: () => void;
    /** 표시한 재분석 의도를 거둔다. 요청이 실제로 나가지 못했을 때 남지 않게 한다. */
    clearReanalyze: () => void;
    /** 쿼리 함수가 요청 직전에 호출해 이번 요청의 의도를 읽는다. 재분석 표시는 한 번만 쓰인다. */
    consumeIntent: () => OverallRequestIntent;
}

/**
 * 종합 분석 요청이 서버에 무엇을 요구할지(캐시만 / 생성 / 재분석)를 정한다.
 *
 * 허락은 state(렌더가 달라진다)와 ref(방금 누른 클릭을 곧바로 도는 refetch가 읽는다)에
 * 함께 둔다. 재분석 표시는 렌더와 무관해 ref뿐이다.
 */
export function useOverallRequestIntent(): OverallRequestIntentControls {
    const [isGenerationAuthorized, setIsGenerationAuthorized] = useState(false);
    const authorizedRef = useRef(false);
    const reanalyzeRef = useRef(false);

    const authorizeGeneration = () => {
        authorizedRef.current = true;
        setIsGenerationAuthorized(true);
    };

    const markReanalyze = () => {
        authorizeGeneration();
        reanalyzeRef.current = true;
    };

    const clearReanalyze = () => {
        reanalyzeRef.current = false;
    };

    const consumeIntent = (): OverallRequestIntent => {
        const reanalyze = reanalyzeRef.current;
        reanalyzeRef.current = false;
        if (reanalyze) return 'reanalyze';
        return authorizedRef.current ? 'generate' : 'cache';
    };

    return {
        isGenerationAuthorized,
        authorizeGeneration,
        markReanalyze,
        clearReanalyze,
        consumeIntent,
    };
}
