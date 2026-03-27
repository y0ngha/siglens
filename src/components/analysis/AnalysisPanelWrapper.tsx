'use client';

import { useState } from 'react';
import type { AnalysisResponse } from '@/domain/types';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';

interface AnalysisPanelWrapperProps {
    initialAnalysis: AnalysisResponse;
}

export function AnalysisPanelWrapper({
    initialAnalysis,
}: AnalysisPanelWrapperProps) {
    const [analysis, _setAnalysis] =
        useState<AnalysisResponse>(initialAnalysis);

    // TODO: 재분석 시 서버 액션 또는 API 라우트 호출로 대체
    // _setAnalysis(newAnalysis) 로 상태 갱신
    const handleReanalyze = () => {};

    return (
        <AnalysisPanel
            analysis={analysis}
            isAnalyzing={false}
            onReanalyze={handleReanalyze}
        />
    );
}
