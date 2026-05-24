'use client';

import { useCallback, useState } from 'react';

interface UseAnalysisDisplayReturn {
    displayAnalyzing: boolean;
    handleProgressFinished: () => void;
}

// 분석 진입 시 즉시 `displayAnalyzing`을 true로 올리고, 마무리 애니메이션이
// 모두 끝난 시점(=onProgressFinished 콜백)에만 false로 내린다. React 19 concurrent mode에서
// 렌더 중 setState 충돌을 피하기 위해 prev 상태 비교 기반 패턴을 사용한다.
export function useAnalysisDisplay(
    isAnalyzing: boolean
): UseAnalysisDisplayReturn {
    const [displayAnalyzing, setDisplayAnalyzing] = useState(isAnalyzing);
    const [prevIsAnalyzing, setPrevIsAnalyzing] = useState(isAnalyzing);

    if (prevIsAnalyzing !== isAnalyzing) {
        setPrevIsAnalyzing(isAnalyzing);
        if (isAnalyzing) setDisplayAnalyzing(true);
    }

    const handleProgressFinished = useCallback(() => {
        setDisplayAnalyzing(false);
    }, []);

    return { displayAnalyzing, handleProgressFinished };
}
