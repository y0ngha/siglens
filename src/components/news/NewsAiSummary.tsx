'use client';

import { useMemo } from 'react';
import {
    type NewsAnalysisResponse,
    type NewsSentiment,
} from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';
import { useDefaultModelId } from '@/components/symbol-page/hooks/useDefaultModelId';
import { useNewsAnalysis } from '@/components/news/hooks/useNewsAnalysis';
import { usePublishSymbolChat } from '@/components/chat/hooks/useSymbolChat';

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    neutral: 'bg-secondary-700 text-secondary-400',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
};

interface NewsAiSummaryViewProps {
    result: NewsAnalysisResponse;
}

function NewsAiSummaryView({ result }: NewsAiSummaryViewProps) {
    return (
        <section
            aria-labelledby="news-ai-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="news-ai-summary-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 뉴스 종합 분석
                </h2>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {SENTIMENT_LABEL[result.overallSentiment]}
                </span>
            </div>

            <p className="text-secondary-400 mb-5 text-sm leading-relaxed">
                {result.currentDriverKo}
            </p>

            {result.keyEventsKo.length > 0 && (
                <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold">핵심 이벤트</h3>
                    <ul className="space-y-1.5" aria-label="핵심 이벤트 목록">
                        {result.keyEventsKo.map((event, i) => (
                            <li
                                key={i}
                                className="text-secondary-400 flex gap-2 text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                {event}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result.upcomingEventsKo.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold">
                        향후 주의 이벤트
                    </h3>
                    <ul
                        className="space-y-1.5"
                        aria-label="향후 주의 이벤트 목록"
                    >
                        {result.upcomingEventsKo.map((event, i) => (
                            <li
                                key={i}
                                className="text-secondary-400 flex gap-2 text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                {event}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

interface NewsAiSummaryProps {
    symbol: string;
}

export function NewsAiSummary({ symbol }: NewsAiSummaryProps) {
    const modelId = useDefaultModelId();
    const result = useNewsAnalysis(symbol, modelId);

    // Publish the in-view news result so the chatbot can reference live numbers
    // from this page. `timeframe` is null — news analysis is timeframe-agnostic.
    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
    const chatState = useMemo(
        () => ({
            context: { kind: 'news', payload: result } as const,
            timeframe: null,
            isAnalysisReady: true,
        }),
        [result]
    );
    usePublishSymbolChat(chatState);

    return <NewsAiSummaryView result={result} />;
}
