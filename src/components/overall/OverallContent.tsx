'use client';

import { usePublishSymbolChat } from '@/components/chat/hooks/useSymbolChat';
import { DependencyProgress } from '@/components/overall/DependencyProgress';
import { useOverallAnalysis } from '@/components/overall/hooks/useOverallAnalysis';
import { OverallTriggerCta } from '@/components/overall/OverallTriggerCta';
import { FundamentalSummary } from '@/components/overall/sections/FundamentalSummary';
import { NewsSummary } from '@/components/overall/sections/NewsSummary';
import { OverallSummary } from '@/components/overall/sections/OverallSummary';
import { RiskFactors } from '@/components/overall/sections/RiskFactors';
import { ScenarioAnalysis } from '@/components/overall/sections/ScenarioAnalysis';
import { TechnicalSummary } from '@/components/overall/sections/TechnicalSummary';
import { ThreeAxisConclusion } from '@/components/overall/sections/ThreeAxisConclusion';
import { buildChatState } from '@/components/overall/utils/buildChatState';
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';
import { useDefaultModelId } from '@/components/symbol-page/hooks/useDefaultModelId';
import { cn } from '@/lib/cn';
import { type Timeframe } from '@y0ngha/siglens-core';
import { type CSSProperties, useMemo } from 'react';

const SKELETON_LINE_COUNT = 3;
const SKELETON_WIDTH_START_PCT = 85;
const SKELETON_WIDTH_STEP_PCT = 12;

interface OverallContentProps {
    symbol: string;
    companyName: string;
    timeframe: Timeframe;
}

export function OverallContent({
    symbol,
    companyName,
    timeframe,
}: OverallContentProps) {
    const modelId = useDefaultModelId();
    const { state, trigger } = useOverallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId
    );

    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
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
    return (
        <div className="space-y-6">
            <OverallSummary headline={r.headlineKo} />
            <TechnicalSummary bullets={r.technicalBulletsKo} />
            <FundamentalSummary bullets={r.fundamentalBulletsKo} />
            <NewsSummary bullets={r.newsBulletsKo} />
            <ThreeAxisConclusion text={r.threeAxisConclusionKo} />
            <ScenarioAnalysis scenarios={r.scenarios} />
            <RiskFactors factors={r.riskFactorsKo} />
        </div>
    );
}
