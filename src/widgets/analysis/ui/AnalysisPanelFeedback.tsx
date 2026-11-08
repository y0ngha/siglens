'use client';

import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { AnalysisFeedbackContext } from '@/entities/feedback/types';
import { AnalysisFeedback } from '@/features/ai-feedback/ui/AnalysisFeedback';

interface AnalysisPanelFeedbackProps {
    readonly symbol: string;
    readonly timeframe: Timeframe;
    readonly analysis: AnalysisResponse;
    readonly plain?: string | null;
    /**
     * 평가에 실을 모델·추론 설정. 받는 쪽(`ChartContent`)만 안다. 없으면(공유 스냅샷처럼 읽기 전용
     * 화면) 아무것도 그리지 않는다.
     */
    readonly settings?: Pick<AnalysisFeedbackContext, 'modelId' | 'reasoning'>;
    /** 분석 중이거나 진행 연출 중. 곧 바뀔 결과라 평가를 받지 않는다. */
    readonly isBusy: boolean;
    /** 내용 없는 폴백 응답. 평가할 응답이 없다. */
    readonly isFallback: boolean;
}

/** 기술적 분석 결과 아래의 👍/👎. 끝난 실제 분석에만 그린다. */
export function AnalysisPanelFeedback({
    symbol,
    timeframe,
    analysis,
    plain,
    settings,
    isBusy,
    isFallback,
}: AnalysisPanelFeedbackProps) {
    if (settings === undefined || isBusy || isFallback) return null;
    return (
        <AnalysisFeedback
            context={{
                analysisType: 'technical',
                symbol,
                timeframe,
                analyzedAt: analysis.analyzedAt,
                ...settings,
            }}
            snapshot={analysis}
            plain={plain}
        />
    );
}
