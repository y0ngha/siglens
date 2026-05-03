'use client';

import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { DEFAULT_TIER, getAllowedModels, type Timeframe } from '@y0ngha/siglens-core';
import { useSelectedProvider } from '@/components/symbol-page/hooks/useSelectedProvider';
import {
    FALLBACK_MODEL_ID,
    resolveDefaultModelForProvider,
} from '@/domain/llm/providerDefaults';
import { useOverallAnalysis } from '@/components/overall/hooks/useOverallAnalysis';
import { OverallTriggerCta } from '@/components/overall/OverallTriggerCta';
import { DependencyProgress } from '@/components/overall/DependencyProgress';
import { OverallSummary } from '@/components/overall/sections/OverallSummary';
import { TechnicalSummary } from '@/components/overall/sections/TechnicalSummary';
import { FundamentalSummary } from '@/components/overall/sections/FundamentalSummary';
import { NewsSummary } from '@/components/overall/sections/NewsSummary';
import { ThreeAxisConclusion } from '@/components/overall/sections/ThreeAxisConclusion';
import { ScenarioAnalysis } from '@/components/overall/sections/ScenarioAnalysis';
import { RiskFactors } from '@/components/overall/sections/RiskFactors';

interface OverallContentProps {
    symbol: string;
    timeframe: Timeframe;
}

/** Client orchestrator for `/[symbol]/overall`; renders the `useOverallAnalysis` state machine. */
export function OverallContent({ symbol, timeframe }: OverallContentProps) {
    const [selectedProvider] = useSelectedProvider();
    const allowedModels = useMemo(() => getAllowedModels(DEFAULT_TIER), []);
    const modelId = useMemo(
        () =>
            resolveDefaultModelForProvider(selectedProvider, allowedModels) ??
            FALLBACK_MODEL_ID,
        [selectedProvider, allowedModels]
    );

    const { state, trigger } = useOverallAnalysis(symbol, timeframe, modelId);

    if (state.status === 'idle') {
        return <OverallTriggerCta onTrigger={trigger} />;
    }

    if (state.status === 'pending_dependencies') {
        return <DependencyProgress pendingJobs={state.pendingJobs} />;
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
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'bg-secondary-700 h-4 animate-pulse rounded motion-reduce:animate-none',
                                'w-[var(--skeleton-w)]'
                            )}
                            style={
                                {
                                    '--skeleton-w': `${85 - i * 12}%`,
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

    // status === 'done'
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
