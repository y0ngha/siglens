'use client';

import { usePublishSymbolChat } from '@/features/symbol-chat';
import { useNewsAnalysisTrigger, useWaitForNewsCards } from '@/widgets/news';
import { DependencyProgress } from './DependencyProgress';
import { useOverallAnalysis } from './hooks/useOverallAnalysis';
import { OverallTriggerCta } from './OverallTriggerCta';
import { ReanalyzeButton } from './ReanalyzeButton';
import { FinancialsSummary } from './sections/FinancialsSummary';
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
    /**
     * SSR snapshot에서 enriched news card가 1개라도 있는지. `true`면 useWaitForNewsCards가
     * 폴링 없이 즉시 ready로 결정한다. `/news`와 동일 게이트 — 종합 분석 input과
     * /news submitNewsAnalysis 호출의 input이 동기화돼야 axis cache가 공유된다.
     */
    hasEnrichedNews: boolean;
}

export function OverallContent({
    symbol,
    companyName,
    initialAnalysis,
    hasEnrichedNews,
}: OverallContentProps) {
    // /news와 동일 패턴: 마운트 시 개별 카드 분석 fire-and-forget trigger + cards ready 폴링.
    // 새 뉴스 fetch+분석을 사용자 클릭 전에 시작해두면 trigger 시점엔 분석 완료 row만
    // input으로 들어가 submitNewsAnalysis cache key가 /news와 일치한다(axis hit).
    useNewsAnalysisTrigger(symbol);
    const { isReady: isCardsReady, pollError } = useWaitForNewsCards(
        symbol,
        hasEnrichedNews
    );

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

    // useWaitForNewsCards가 누적 polling 실패 임계를 넘으면 inline fallback으로 회복한다 —
    // OverallContent는 ErrorBoundary로 감싸지 않으므로(throw하면 페이지 전체 crash),
    // 자체 fallback UI로 사용자에게 안내하고 새로고침 기회를 준다.
    if (pollError !== null) {
        return (
            <section
                aria-labelledby="overall-cta-poll-error-heading"
                role="alert"
                className="border-ui-danger/30 bg-secondary-800 rounded-xl border p-6 text-center"
            >
                <h2
                    id="overall-cta-poll-error-heading"
                    className="mb-2 text-lg font-semibold text-balance"
                >
                    AI 종합 분석
                </h2>
                <p className="text-ui-danger text-sm">
                    뉴스 카드 분석 준비 중 오류가 발생했어요.
                </p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    다시 시도
                </button>
            </section>
        );
    }

    if (state.status === 'idle') {
        // /news와 동일 게이트 — 새 뉴스 fetch+분석을 백그라운드에서 끝낸 뒤 submit이 일어나야
        // submitNewsAnalysis cache key가 /news와 일치(axis hit)한다.
        return (
            <OverallTriggerCta onTrigger={trigger} disabled={!isCardsReady} />
        );
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
            <FinancialsSummary bullets={r.financialsBulletsKo} />
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
