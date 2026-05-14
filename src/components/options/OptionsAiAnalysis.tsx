'use client';

import type { OptionsTone, OptionsSignalKind } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';
import { useOptionsAnalysis } from './hooks/useOptionsAnalysis';
import { OptionsAiAnalysisSkeleton } from './OptionsAiAnalysisSkeleton';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

// ─── tone / kind ─────────────────────────────────────────────────────────────

const TONE_LABEL: Record<OptionsTone, string> = {
    bullish: '강세',
    bearish: '약세',
    cautious: '방어적',
    neutral: '중립',
};

const TONE_CLASS: Record<
    OptionsTone,
    { text: string; bg: string; border: string }
> = {
    bullish: {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
    },
    bearish: {
        text: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
    },
    cautious: {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
    },
    neutral: {
        text: 'text-secondary-300',
        bg: 'bg-secondary-700/40',
        border: 'border-secondary-600',
    },
};

// OptionsSignalKind uses the same four-value colour pattern; `volatility` maps
// to amber (same as `cautious` in the tone table).
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

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Format an ISO datetime string as "YYYY-MM-DD HH:mm" (no timezone conversion
 * — the value from the server is already in an appropriate zone for display).
 *
 * No third-party dependency needed; the ISO string is sliced to the minute
 * boundary. Example: "2026-05-14T09:35:11.000Z" → "2026-05-14 09:35".
 */
function formatAnalyzedAt(iso: string): string {
    // ISO strings have the shape "YYYY-MM-DDTHH:mm:ss…"
    const withoutTz = iso.replace('T', ' ').slice(0, 16);
    return withoutTz;
}

// ─── sub-components ──────────────────────────────────────────────────────────

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

// ─── view ─────────────────────────────────────────────────────────────────────

import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

interface OptionsAiAnalysisViewProps {
    result: OptionsAnalysisResponse;
}

function OptionsAiAnalysisView({ result }: OptionsAiAnalysisViewProps) {
    const isEmpty =
        result.summary === '' &&
        result.perExpiration.length === 0 &&
        result.signals.length === 0;

    if (isEmpty) {
        return (
            <OptionsAiAnalysisError
                resetErrorBoundary={undefined}
            />
        );
    }

    return (
        <section
            aria-labelledby="options-ai-analysis-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2
                    id="options-ai-analysis-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    ⚡ AI 옵션 분석
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

            {/* Summary */}
            {result.summary ? (
                <p className="text-secondary-300 mb-5 text-sm leading-relaxed">
                    {result.summary}
                </p>
            ) : null}

            {/* Per-expiration commentary */}
            {result.perExpiration.length > 0 && (
                <div className="mb-5">
                    <h3 className="text-secondary-200 mb-3 text-xs font-semibold tracking-wider uppercase">
                        ▸ 만기별 해석
                    </h3>
                    <ul
                        className="space-y-3"
                        aria-label="만기별 옵션 해석"
                    >
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

            {/* Signals */}
            {result.signals.length > 0 && (
                <div>
                    <h3 className="text-secondary-200 mb-3 text-xs font-semibold tracking-wider uppercase">
                        ▸ 시그널
                    </h3>
                    <ul
                        className="space-y-2"
                        aria-label="옵션 시그널 목록"
                    >
                        {result.signals.map((signal, i) => (
                            <li
                                key={i}
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

// ─── public export ────────────────────────────────────────────────────────────

export interface OptionsAiAnalysisProps {
    symbol: string;
    companyName: string;
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: string | 'all';
    modelId: string;
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
        modelId: modelId as Parameters<typeof useOptionsAnalysis>[0]['modelId'],
    });

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
                    ⚡ AI 옵션 분석
                </h2>
                <BotBlockedNotice />
            </section>
        );
    }

    if (state.status === 'error') {
        return (
            <OptionsAiAnalysisError
                resetErrorBoundary={state.retry}
            />
        );
    }

    return <OptionsAiAnalysisView result={state.result} />;
}
