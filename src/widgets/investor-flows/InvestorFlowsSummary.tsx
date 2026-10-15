'use client';

import { useTranslations } from 'next-intl';
import { useDefaultModelId } from '@/features/symbol-model/hooks/useDefaultModelId';
import { useDefaultReasoning } from '@/features/symbol-model/hooks/useDefaultReasoning';
import { useAnalysisSettingsHydrated } from '@/features/symbol-model/hooks/useAnalysisSettingsHydrated';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { AiAnalysisAwaitingSection } from '@/shared/ui/AiAnalysisAwaitingSection';
import { useInvestorFlowsAnalysis } from './hooks/useInvestorFlowsAnalysis';
import { InvestorFlowsSummaryEmpty } from './InvestorFlowsSummaryEmpty';
import { InvestorFlowsSummaryError } from './InvestorFlowsSummaryError';
import { InvestorFlowsSummarySkeleton } from './InvestorFlowsSummarySkeleton';
import { InvestorFlowsSummaryView } from './InvestorFlowsSummaryView';

interface InvestorFlowsSummaryProps {
    readonly symbol: string;
}

/**
 * AI 수급 해석 위젯 — 점수표는 코드가 계산한 값이고 AI는 그것을 해석만 한다. 분석은 클라이언트가 SSE로
 * 요청한다(`useInvestorFlowsAnalysis`). 큐레이션 밖 종목은 첫 입력 전까지 캐시만 조회하고 "AI 분석 시작"
 * 버튼으로 기다린다(`useAiAutoRunAllowed`).
 */
export function InvestorFlowsSummary({ symbol }: InvestorFlowsSummaryProps) {
    const t = useTranslations('widgets.investor-flows');
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    const { allowed: autoRunAllowed, grant } = useAiAutoRunAllowed(symbol);
    const state = useInvestorFlowsAnalysis(
        symbol,
        modelId,
        reasoning,
        isSettingsHydrated,
        autoRunAllowed
    );

    if (state.status === 'loading') return <InvestorFlowsSummarySkeleton />;

    if (state.status === 'no_data') return <InvestorFlowsSummaryEmpty />;

    if (state.status === 'awaiting_interaction') {
        return (
            <AiAnalysisAwaitingSection
                heading={t('ai.title')}
                idPrefix="investor-flows-summary"
                onStart={grant}
            />
        );
    }

    if (state.status === 'error') {
        return (
            <InvestorFlowsSummaryError
                error={state.error}
                resetErrorBoundary={state.retry}
            />
        );
    }

    return <InvestorFlowsSummaryView result={state.result} />;
}
