'use client';

import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import {
    getAllowedModels,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { useSelectedProvider } from '@/components/symbol-page/hooks/useSelectedProvider';
import { resolveDefaultModelForProvider } from '@/domain/llm/providerDefaults';
import { useOverallAnalysis } from './hooks/useOverallAnalysis';
import { OverallTriggerCta } from './OverallTriggerCta';
import { DependencyProgress } from './DependencyProgress';
import { OverallSummary } from './sections/OverallSummary';
import { TechnicalSummary } from './sections/TechnicalSummary';
import { FundamentalSummary } from './sections/FundamentalSummary';
import { NewsSummary } from './sections/NewsSummary';
import { ThreeAxisConclusion } from './sections/ThreeAxisConclusion';
import { ScenarioAnalysis } from './sections/ScenarioAnalysis';
import { RiskFactors } from './sections/RiskFactors';

const DEFAULT_TIER = 'free' as const;

interface OverallContentProps {
    symbol: string;
    timeframe: Timeframe;
}

/**
 * Client orchestrator for the `/[symbol]/overall` page.
 *
 * Renders a state machine driven by `useOverallAnalysis`:
 *   idle            → CTA trigger button
 *   pending_deps    → per-axis dependency progress
 *   submitting/poll → loading indicator
 *   done            → full 7-section result layout
 *   error           → error message with axis context
 */
export function OverallContent({ symbol, timeframe }: OverallContentProps) {
    const [selectedProvider] = useSelectedProvider();
    const allowedModels = useMemo(() => getAllowedModels(DEFAULT_TIER), []);
    const modelId = useMemo(
        () =>
            resolveDefaultModelForProvider(selectedProvider, allowedModels) ??
            'claude-haiku-3-5',
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
                className="rounded-xl border border-border bg-card p-6"
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
                        className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                    />
                    <p
                        className="text-muted-foreground text-sm"
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
                                'bg-muted h-4 animate-pulse rounded motion-reduce:animate-none',
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
                className="rounded-xl border border-destructive/30 bg-card p-6"
            >
                <h2
                    id="overall-error-heading"
                    className="mb-2 text-lg font-semibold text-balance"
                >
                    AI 종합 분석
                </h2>
                <p className="text-destructive text-sm" role="alert">
                    {state.error ?? '분석 중 오류가 발생했습니다.'}
                    {state.axis !== undefined ? ` (${state.axis} 축 실패)` : ''}
                </p>
                <button
                    type="button"
                    onClick={trigger}
                    className="text-primary mt-3 rounded-sm text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
