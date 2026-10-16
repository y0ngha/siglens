'use client';

import { useTranslations } from 'next-intl';
import { useDefaultModelId } from '@/features/symbol-model/hooks/useDefaultModelId';
import { useDefaultReasoning } from '@/features/symbol-model/hooks/useDefaultReasoning';
import { useAnalysisSettingsHydrated } from '@/features/symbol-model/hooks/useAnalysisSettingsHydrated';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { AiAnalysisAwaitingSection } from '@/shared/ui/AiAnalysisAwaitingSection';
import { useInvestorFlowsAnalysis } from './hooks/useInvestorFlowsAnalysis';
import { InvestorFlowsSummaryEmpty } from './InvestorFlowsSummaryEmpty';
import { InvestorFlowsSummaryError } from './InvestorFlowsSummaryError';
import { InvestorFlowsSummarySkeleton } from './InvestorFlowsSummarySkeleton';
import { InvestorFlowsSummaryView } from './InvestorFlowsSummaryView';
import { SUMMARY_RESERVED_HEIGHT } from './utils/summaryReservedHeight';

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

    // 로딩 중(스켈레톤)에는 도착할 결과만큼 높이를 잡아 둔다 — AI 해석이 탭 맨 위라 스켈레톤 → 결과로 높이가
    // 바뀌면 아래 SSR 점수 카드가 통째로 밀린다. 그 밖의 상태는 자기 높이다: "AI 분석 시작" 대기 카드는 사용자가
    // 누르기 전의 작은 카드이고, 결과·오류·빈 결과는 이미 끝난 상태다.
    if (state.status === 'loading')
        return (
            <div className={SUMMARY_RESERVED_HEIGHT}>
                <InvestorFlowsSummarySkeleton />
            </div>
        );

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

    return (
        <InvestorFlowsSummaryView
            result={state.result}
            market={isKrEquitySymbol(symbol) ? 'kr' : 'us'}
        />
    );
}
