'use client';

import { usePublishSymbolChat } from '@/features/symbol-chat';
import { DependencyProgress } from './DependencyProgress';
import { useOverallAnalysis } from './hooks/useOverallAnalysis';
import { OverallTriggerCta } from './OverallTriggerCta';
import { ReanalyzeButton } from './ReanalyzeButton';
import { FundamentalSummary } from './sections/FundamentalSummary';
import { IntegratedConclusion } from './sections/IntegratedConclusion';
import { NewsSummary } from './sections/NewsSummary';
import { OptionsSummary } from './sections/OptionsSummary';
import { OverallSummary } from './sections/OverallSummary';
import { RiskFactors } from './sections/RiskFactors';
import { ScenarioAnalysis } from './sections/ScenarioAnalysis';
import { TechnicalSummary } from './sections/TechnicalSummary';
import { buildChatState } from './utils/buildChatState';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { useDefaultModelId } from '@/widgets/symbol-page/hooks/useDefaultModelId';
import { cn } from '@/shared/lib/cn';
import { type OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { type CSSProperties, useMemo } from 'react';
import { useTimeframeFromUrl } from './hooks/useTimeframeFromUrl';

const SKELETON_LINE_COUNT = 3;
const SKELETON_WIDTH_START_PCT = 85;
const SKELETON_WIDTH_STEP_PCT = 12;

interface OverallContentProps {
    symbol: string;
    companyName: string;
    /**
     * 서버에서 peek로 미리 읽은 캐시 종합 분석 서사(SSR seed). 주어지면
     * useOverallAnalysis가 마운트 즉시 done 상태로 렌더한다(LLM 비용 0).
     */
    initialAnalysis?: OverallAnalysisResponse;
}

export function OverallContent({
    symbol,
    companyName,
    initialAnalysis,
}: OverallContentProps) {
    // tf는 서버가 아니라 client가 URL에서 읽어 [symbol] ISR(정적 렌더)을 유지한다.
    const timeframe = useTimeframeFromUrl();
    const modelId = useDefaultModelId();
    const { state, trigger } = useOverallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId,
        initialAnalysis
    );

    // usePublishSymbolChat은 chatState(useMemo 반환값)를 인자로 받으므로 useMemo 뒤에 둔다(§17 의존 순서).
    const chatState = useMemo(
        () => buildChatState(state, timeframe),
        [state, timeframe]
    );
    usePublishSymbolChat(chatState);

    if (state.status === 'idle') {
        return <OverallTriggerCta onTrigger={trigger} />;
    }

    if (state.status === 'bot_blocked') {
        return <BotBlockedNotice />;
    }

    if (state.status === 'pending_dependencies') {
        return (
            <DependencyProgress
                pendingJobs={state.pendingJobs}
                retryCount={state.retryCount}
            />
        );
    }

    if (state.status === 'submitting' || state.status === 'polling') {
        const loadingLabel =
            state.status === 'submitting'
                ? 'AI 종합 분석 요청 중…'
                : 'AI 종합 분석 생성 중…';
        return (
            <section
                aria-labelledby="overall-loading-heading"
                aria-busy="true"
                className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            >
                <h2
                    id="overall-loading-heading"
                    className="mb-4 text-lg font-semibold text-balance"
                >
                    AI 종합 분석
                </h2>
                <div className="flex items-center gap-3">
                    <div
                        aria-hidden="true"
                        className="border-primary-500 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                    />
                    <p
                        className="text-secondary-400 text-sm"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {loadingLabel}
                    </p>
                </div>
                <div className="mt-4 space-y-2">
                    {[...Array(SKELETON_LINE_COUNT)].map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'bg-secondary-700 h-4 animate-pulse rounded motion-reduce:animate-none',
                                'w-(--skeleton-w)'
                            )}
                            style={
                                {
                                    '--skeleton-w': `${SKELETON_WIDTH_START_PCT - i * SKELETON_WIDTH_STEP_PCT}%`,
                                } as CSSProperties
                            }
                            aria-hidden="true"
                        />
                    ))}
                </div>
            </section>
        );
    }

    if (state.status === 'error') {
        return (
            <section
                aria-labelledby="overall-error-heading"
                className="border-ui-danger/30 bg-secondary-800 rounded-xl border p-6"
            >
                <h2
                    id="overall-error-heading"
                    className="mb-2 text-lg font-semibold text-balance"
                >
                    AI 종합 분석
                </h2>
                <p className="text-ui-danger text-sm" role="alert">
                    {state.error ?? '분석 중 오류가 발생했습니다.'}
                    {state.axis !== undefined ? ` (${state.axis} 축 실패)` : ''}
                </p>
                <button
                    type="button"
                    onClick={trigger}
                    className="text-primary-400 focus-visible:ring-primary-500 mt-3 rounded-sm text-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    다시 시도
                </button>
            </section>
        );
    }

    if (state.status !== 'done') return null;

    const r = state.result;
    const optionsOiStale = r.optionsOiStale ?? false;
    // 옵션 분석이 실제로 수행됐고(=bullets 존재) OI 스냅샷이 stale일 때만 재분석
    // 버튼을 amber로 강조한다. 빈 옵션 분석(NoChains)에서는 stale 여부가 의미가
    // 없으므로 강조하지 않는다 — OptionsSummary의 stale 배지 노출 조건과 동일.
    const reanalyzeHighlighted =
        r.optionsBulletsKo.length > 0 && optionsOiStale;

    return (
        <div className="space-y-6">
            <OverallSummary headline={r.headlineKo} />
            <TechnicalSummary bullets={r.technicalBulletsKo} />
            <OptionsSummary
                bullets={r.optionsBulletsKo}
                oiStale={optionsOiStale}
            />
            <FundamentalSummary bullets={r.fundamentalBulletsKo} />
            <NewsSummary bullets={r.newsBulletsKo} />
            <IntegratedConclusion text={r.integratedConclusionKo} />
            <ScenarioAnalysis scenarios={r.scenarios} />
            <RiskFactors factors={r.riskFactorsKo} />
            <ReanalyzeButton
                onClick={trigger}
                highlighted={reanalyzeHighlighted}
            />
        </div>
    );
}
