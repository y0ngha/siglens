'use client';

import { useCallback, useState } from 'react';

interface UseAnalysisDisplayReturn {
    displayAnalyzing: boolean;
    handleProgressFinished: () => void;
}

// 분석 진입 시 즉시 `displayAnalyzing`을 true로 올리고, 마무리 애니메이션이
// 모두 끝난 시점(=onProgressFinished 콜백)에만 false로 내린다. React 19 concurrent mode에서
// 렌더 중 setState 충돌을 피하기 위해 prev 상태 비교 기반 패턴을 사용한다.
//
// `skipFinishing`(서버가 생성 없이 즉시 돌려준 응답 — `useAnalysis.isInstantResponse`)이면
// 마무리 애니메이션을 기다리지 않고 응답이 온 그 렌더에서 내린다. `useAnalysisProgress`도
// 같은 값으로 마무리 시퀀스를 건너뛰므로 `onProgressFinished`는 오지 않는다.
export function useAnalysisDisplay(
    isAnalyzing: boolean,
    skipFinishing = false
): UseAnalysisDisplayReturn {
    const [displayAnalyzing, setDisplayAnalyzing] = useState(isAnalyzing);
    const [prevIsAnalyzing, setPrevIsAnalyzing] = useState(isAnalyzing);

    if (prevIsAnalyzing !== isAnalyzing) {
        setPrevIsAnalyzing(isAnalyzing);
        if (isAnalyzing) setDisplayAnalyzing(true);
        else if (skipFinishing) setDisplayAnalyzing(false);
    }

    const handleProgressFinished = useCallback(() => {
        setDisplayAnalyzing(false);
    }, []);

    return { displayAnalyzing, handleProgressFinished };
}
