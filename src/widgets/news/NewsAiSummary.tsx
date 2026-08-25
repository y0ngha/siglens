'use client';

import {
    usePublishSymbolChat,
    type SymbolChatState,
} from '@/features/symbol-chat';
import { useNewsAnalysis } from './hooks/useNewsAnalysis';
import { useNewsAnalysisTrigger } from './hooks/useNewsAnalysisTrigger';
import { useWaitForNewsCards } from './hooks/useWaitForNewsCards';
import { buildChatState } from './utils/buildChatState';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import {
    useDefaultModelId,
    useDefaultReasoning,
    useAnalysisSettingsHydrated,
} from '@/features/symbol-model';
import { cn } from '@/shared/lib/cn';
import {
    type NewsAnalysisResponse,
    type NewsSentiment,
} from '@y0ngha/siglens-core';

import { NEWS_ANALYSIS_PERIOD_LABEL } from '@/shared/lib/news/periodLabels';
import { useRegisterShareable, mapAnalysisStatus } from '@/features/share';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-400',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
};

interface StatusCardProps {
    phase: 'fetching' | 'analyzing';
}

function StatusCard({ phase }: StatusCardProps) {
    const isFetching = phase === 'fetching';

    return (
        <section
            aria-labelledby="news-ai-summary-status-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
        >
            <div className="mb-4 flex items-center gap-2">
                <h2
                    id="news-ai-summary-status-heading"
                    className={HEADING_SECTION}
                >
                    뉴스 AI 종합 분석
                </h2>
                <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                    {NEWS_ANALYSIS_PERIOD_LABEL}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <div
                    aria-hidden="true"
                    className={cn(
                        'h-4 w-4 animate-spin rounded-full border-2 motion-reduce:animate-none',
                        isFetching
                            ? 'border-primary-400'
                            : 'border-primary-500',
                        'border-t-transparent'
                    )}
                />
                <p
                    className="text-sm text-secondary-400"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {isFetching
                        ? '뉴스 데이터를 수집하고 있어요…'
                        : 'AI 종합 분석 중이에요…'}
                </p>
            </div>
            <p className="mt-2 text-xs text-secondary-500">
                {isFetching
                    ? '최신 뉴스를 가져온 뒤에 AI 분석을 시작해요.'
                    : '수집한 뉴스를 종합 분석하고 있어요. 잠시만 기다려 주세요.'}
            </p>
            <div className="mt-4 space-y-2" aria-hidden="true">
                <div className="h-4 w-[91%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[67%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[79%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
        </section>
    );
}

interface NewsAiSummaryViewProps {
    result: NewsAnalysisResponse;
}

export function NewsAiSummaryView({ result }: NewsAiSummaryViewProps) {
    return (
        <section
            aria-labelledby="news-ai-summary-heading"
            className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 p-6 motion-safe:animate-[fade-in_200ms_ease-out]"
        >
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <h2
                        id="news-ai-summary-heading"
                        className={HEADING_SECTION}
                    >
                        뉴스 AI 종합 분석
                    </h2>
                    <span className="shrink-0 rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                        {NEWS_ANALYSIS_PERIOD_LABEL}
                    </span>
                </div>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {SENTIMENT_LABEL[result.overallSentiment]}
                </span>
            </div>

            <p className="mb-4 text-sm leading-relaxed wrap-break-word text-secondary-400">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                        핵심 이벤트
                    </h3>
                    <ul className="space-y-1.5" aria-label="핵심 이벤트 목록">
                        {result.keyEventsKo.map(event => (
                            <li
                                key={event}
                                className="flex min-w-0 gap-2 text-sm wrap-break-word text-secondary-400"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                <span className="min-w-0 wrap-break-word">
                                    {event}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result.upcomingEventsKo.length > 0 && (
                <div>
                    <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                        다가오는 주요 일정
                    </h3>
                    <ul
                        className="space-y-1.5"
                        aria-label="다가오는 주요 일정 목록"
                    >
                        {result.upcomingEventsKo.map(event => (
                            <li
                                key={event}
                                className="flex min-w-0 gap-2 text-sm wrap-break-word text-secondary-400"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-ui-warning-text"
                                >
                                    ⚠
                                </span>
                                <span className="min-w-0 wrap-break-word">
                                    {event}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

interface NewsAiSummaryInlineErrorProps {
    error: Error;
    onRetry: () => void;
}

function NewsAiSummaryInlineError({
    error,
    onRetry,
}: NewsAiSummaryInlineErrorProps) {
    return (
        <section
            aria-labelledby="news-ai-summary-error-heading"
            className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-ui-danger/30 bg-secondary-800 p-6"
        >
            <div className="mb-2 flex items-center gap-2">
                <h2
                    id="news-ai-summary-error-heading"
                    className={HEADING_SECTION}
                >
                    뉴스 AI 종합 분석
                </h2>
                <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                    {NEWS_ANALYSIS_PERIOD_LABEL}
                </span>
            </div>
            <p
                className="text-sm wrap-break-word text-ui-danger-text"
                role="alert"
            >
                {error.message}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded bg-primary-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}

interface NewsAiSummaryProps {
    symbol: string;
    companyName: string;
    /**
     * Whether the SSR snapshot already contained at least one AI-enriched
     * news card. When `false`, the component waits for background enrichment
     * to produce the first enriched card before triggering aggregate analysis.
     */
    hasEnrichedNews: boolean;
    /**
     * SSR 스냅샷 프로즈가 같은 AI 결론을 이미 렌더 중일 때 `true`.
     *
     * UI만 숨기고 마운트는 유지한다 — 페이지가 위젯을 렌더하지 않으면
     * `usePublishSymbolChat`이 돌지 않아 챗봇 컨텍스트가 비고 입력이 잠긴다.
     */
    hideView?: boolean;
}

// cards 대기/poll error 동안 publish할 stale-safe chatState.
// 모듈 스코프 상수라 매 렌더마다 새 객체가 만들어지지 않아 useMemo 없이도
// publish의 prev 비교가 동일 reference로 dedupe된다.
const WAITING_CHAT_STATE: SymbolChatState = {
    context: null,
    timeframe: null,
    isAnalysisReady: false,
};

export function NewsAiSummary({
    symbol,
    companyName,
    hasEnrichedNews,
    hideView = false,
}: NewsAiSummaryProps) {
    useNewsAnalysisTrigger(symbol);

    const { isReady: isCardsReady, pollError } = useWaitForNewsCards(
        symbol,
        hasEnrichedNews
    );
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    // enabled 게이트: enriched news cards가 DB에 적어도 1개 있을 때까지 submit을
    // 미룬다. 이 게이트가 없으면 빈 DB에 대해 submit이 즉시 fire되어 core가
    // no_news 결과를 돌려주고, retry:false + staleTime:Infinity 정책에 의해
    // 에러가 영구 캐시돼 cards가 enrich된 뒤에도 분석 패널이 회복되지 않는다.
    const analysis = useNewsAnalysis(symbol, companyName, modelId, {
        enabled: isCardsReady,
        reasoning,
        isSettingsHydrated,
    });

    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
    //
    // cards 준비 전에는 분석 결과가 아직 없으므로 WAITING_CHAT_STATE를 publish하여
    // 이전 페이지의 stale context가 그대로 남지 않게 한다. cards ready 후에는
    // analysis 상태 기반 chatState로 takeover한다. 단일 publish 사이트를 유지하여
    // parent/child 이중 publish로 인한 race condition을 막는다.
    //
    // `analysis`는 discriminated union이라 deps에는 객체 전체를 둔다. React Query가
    // `query.data`를 memoize하므로 동일 분석에 대한 reference는 안정적 — 실제
    // 데이터가 바뀔 때만 재계산된다.
    const chatState = isCardsReady
        ? buildChatState(analysis)
        : WAITING_CHAT_STATE;
    usePublishSymbolChat(chatState);
    // When enriched news cards are not yet ready the analysis query is disabled
    // (enabled: false → useNewsAnalysis returns status 'loading' immediately).
    // Mapping that 'loading' to 'pending' misleads the share system into showing
    // "preparing" before any actual analysis has started. Register 'idle' instead
    // so the share button stays dormant until real analysis work begins.
    useRegisterShareable({
        kind: 'news',
        status: isCardsReady ? mapAnalysisStatus(analysis.status) : 'idle',
        result: analysis.status === 'done' ? analysis.result : null,
        context: {
            symbol,
            displayName: companyName,
            // NewsAnalysisResponse has no analyzedAt; resolveAsOf falls back to createdAt.
            analyzedAt: undefined,
        },
        trigger: analysis.trigger,
    });

    // Surface persistent polling errors to the surrounding error boundary
    // (NewsAiSummaryErrorBoundary) so the fallback UI takes over.
    if (pollError !== null) {
        throw pollError;
    }

    // 훅과 pollError 전파는 그대로 두고 렌더만 건너뛴다 — publish는 유지된다.
    if (hideView) return null;

    if (!isCardsReady) {
        return <StatusCard phase="fetching" />;
    }

    if (analysis.status === 'error') {
        return (
            <NewsAiSummaryInlineError
                error={analysis.error}
                onRetry={analysis.retry}
            />
        );
    }

    if (analysis.status === 'bot_blocked') {
        return <BotBlockedNotice />;
    }

    if (analysis.status === 'loading') {
        return <StatusCard phase="analyzing" />;
    }

    return <NewsAiSummaryView result={analysis.result} />;
}
