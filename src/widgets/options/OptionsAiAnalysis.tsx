'use client';

import type {
    ModelId,
    OptionsAnalysisResponse,
    OptionsSignalKind,
    OptionsTone,
} from '@y0ngha/siglens-core';
import { useMemo } from 'react';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { cn } from '@/shared/lib/cn';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { OptionsAiAnalysisSkeleton } from './OptionsAiAnalysisSkeleton';
import { useOptionsAnalysis } from './hooks/useOptionsAnalysis';
import { buildChatState } from './utils/buildChatState';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

const TONE_LABEL: Record<OptionsTone, string> = {
    bullish: '강세',
    bearish: '약세',
    cautious: '신중',
    neutral: '중립',
};

// Tone tokens (chart-bullish / chart-bearish) are part of the options-analysis
// shared palette — distinct from the indicator-line-restricted chart-* tokens
// (rsi/bollinger/period5/period10/period60). Safe for UI badge usage.
const TONE_CLASS: Record<
    OptionsTone,
    { text: string; bg: string; border: string }
> = {
    bullish: {
        text: 'text-chart-bullish',
        bg: 'bg-chart-bullish/10',
        border: 'border-chart-bullish/30',
    },
    bearish: {
        text: 'text-chart-bearish',
        bg: 'bg-chart-bearish/10',
        border: 'border-chart-bearish/30',
    },
    cautious: {
        text: 'text-ui-warning',
        bg: 'bg-ui-warning/10',
        border: 'border-ui-warning/30',
    },
    neutral: {
        text: 'text-secondary-400',
        bg: 'bg-secondary-700/40',
        border: 'border-secondary-600',
    },
};

const SIGNAL_KIND_CLASS: Record<
    OptionsSignalKind,
    { text: string; bg: string; border: string }
> = {
    bullish: TONE_CLASS.bullish,
    bearish: TONE_CLASS.bearish,
    volatility: TONE_CLASS.cautious,
    neutral: TONE_CLASS.neutral,
};

const SIGNAL_KIND_LABEL: Record<OptionsSignalKind, string> = {
    bullish: '강세',
    bearish: '약세',
    volatility: '변동성',
    neutral: '중립',
};

interface ToneBadgeProps {
    tone: OptionsTone;
}

function ToneBadge({ tone }: ToneBadgeProps) {
    const cls = TONE_CLASS[tone];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                cls.text,
                cls.bg,
                cls.border
            )}
        >
            {TONE_LABEL[tone]}
        </span>
    );
}

interface SignalBadgeProps {
    kind: OptionsSignalKind;
}

function SignalBadge({ kind }: SignalBadgeProps) {
    const cls = SIGNAL_KIND_CLASS[kind];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                cls.text,
                cls.bg,
                cls.border
            )}
        >
            {SIGNAL_KIND_LABEL[kind]}
        </span>
    );
}

interface OptionsAiAnalysisViewProps {
    result: OptionsAnalysisResponse;
}

function OptionsAiAnalysisView({ result }: OptionsAiAnalysisViewProps) {
    const isEmpty =
        result.summary === '' &&
        result.perExpiration.length === 0 &&
        result.signals.length === 0;

    if (isEmpty) {
        return <OptionsAiAnalysisError />;
    }

    return (
        <section
            aria-labelledby="options-ai-analysis-heading"
            className="border-primary-500/30 from-secondary-800 to-secondary-900 ring-primary-500/10 shadow-primary-500/5 rounded-xl border bg-gradient-to-br p-6 shadow-lg ring-1"
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2
                    id="options-ai-analysis-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 옵션 분석
                </h2>
                {result.analyzedAt ? (
                    <time
                        dateTime={result.analyzedAt}
                        className="text-secondary-500 text-xs"
                    >
                        {formatAnalyzedAt(result.analyzedAt)}
                    </time>
                ) : null}
            </div>

            {result.summary ? (
                <p className="text-secondary-300 mb-5 text-sm leading-relaxed">
                    {result.summary}
                </p>
            ) : null}

            {result.perExpiration.length > 0 && (
                <div className="mb-5">
                    <h3 className="text-secondary-200 mb-3 text-xs font-semibold tracking-wider uppercase">
                        ▸ 만기별 해석
                    </h3>
                    <ul className="space-y-3" aria-label="만기별 옵션 해석">
                        {result.perExpiration.map(item => (
                            <li
                                key={item.expirationDate}
                                className="border-secondary-700 rounded-lg border p-3"
                            >
                                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <span className="text-secondary-200 text-xs font-medium tabular-nums">
                                        {item.expirationDate}
                                    </span>
                                    <ToneBadge tone={item.tone} />
                                </div>
                                <p className="text-secondary-400 text-sm leading-relaxed">
                                    {item.commentary}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result.signals.length > 0 && (
                <div>
                    <h3 className="text-secondary-200 mb-3 text-xs font-semibold tracking-wider uppercase">
                        ▸ 시그널
                    </h3>
                    <ul className="space-y-2" aria-label="옵션 시그널 목록">
                        {result.signals.map(signal => (
                            <li
                                // Signals are render-only and the AI rarely emits
                                // duplicate `${kind}::${message}` pairs; using the
                                // composite as key avoids the index-key anti-pattern.
                                key={`${signal.kind}::${signal.message}`}
                                className="text-secondary-400 flex min-w-0 items-start gap-2 text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className="text-secondary-600 mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <SignalBadge kind={signal.kind} />
                                    <span className="min-w-0 leading-relaxed">
                                        {signal.message}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export interface OptionsAiAnalysisProps {
    symbol: string;
    companyName: string;
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: OptionsExpirationSelector;
    modelId: ModelId;
}

export function OptionsAiAnalysis({
    symbol,
    companyName,
    expirationDate,
    modelId,
}: OptionsAiAnalysisProps) {
    const state = useOptionsAnalysis({
        symbol,
        companyName,
        expirationDate,
        modelId,
    });

    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생
    // 변수)를 인자로 받으므로 useMemo 뒤에 위치해야 한다. 다른 페이지
    // (overall/fundamental/news/chart) 모두 동일 패턴.
    const chatState = useMemo(() => buildChatState(state), [state]);
    usePublishSymbolChat(chatState);

    if (state.status === 'loading') {
        return <OptionsAiAnalysisSkeleton />;
    }

    if (state.status === 'bot_blocked') {
        return (
            <section
                aria-labelledby="options-ai-analysis-heading"
                className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            >
                <h2
                    id="options-ai-analysis-heading"
                    className="text-secondary-400 mb-3 text-xs tracking-widest uppercase"
                >
                    AI 옵션 분석
                </h2>
                <BotBlockedNotice />
            </section>
        );
    }

    if (state.status === 'error') {
        return <OptionsAiAnalysisError resetErrorBoundary={state.retry} />;
    }

    return <OptionsAiAnalysisView result={state.result} />;
}
