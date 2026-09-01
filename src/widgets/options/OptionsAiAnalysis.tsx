'use client';

import { useTranslations } from 'next-intl';
import type {
    ModelId,
    OptionsAnalysisResponse,
    OptionsSignalKind,
    OptionsTone,
} from '@y0ngha/siglens-core';

import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { cn } from '@/shared/lib/cn';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { OptionsAiAnalysisSkeleton } from './OptionsAiAnalysisSkeleton';
import { useOptionsAnalysis } from './hooks/useOptionsAnalysis';
import { buildChatState } from './utils/buildChatState';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { useRegisterShareable, mapAnalysisStatus } from '@/features/share';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';

/** OptionsTone → `shared.enumLabel.optionsTone` 카탈로그 키. */
const TONE_LABEL_KEY: Record<OptionsTone, string> = {
    bullish: 'optionsTone.bullish',
    bearish: 'optionsTone.bearish',
    cautious: 'optionsTone.cautious',
    neutral: 'optionsTone.neutral',
};

// 배지 **텍스트**는 `-text` 변형을 쓴다. `chart-bullish`/`chart-bearish`/`ui-warning`은
// 그래픽(3:1) 기준으로 튜닝된 값이라, 자기 `/10` 틴트 위 10px 글씨로 쓰면 라이트에서
// 3.99~4.14:1로 AA(4.5)에 미달한다(실측). `globals.css`의 `ui-*-text` 주석이 정확히
// 이 경우를 경고하고 있었는데, 이 파일의 예전 주석은 반대로 "Safe for UI badge usage"라고
// 적혀 있었다 — 측정으로 반증됐다.
// 채움·보더는 그래픽이므로 기본 토큰을 그대로 쓴다.
const TONE_CLASS: Record<
    OptionsTone,
    { text: string; bg: string; border: string }
> = {
    bullish: {
        text: 'text-ui-success-text',
        bg: 'bg-chart-bullish/10',
        border: 'border-chart-bullish/30',
    },
    bearish: {
        text: 'text-ui-danger-text',
        bg: 'bg-chart-bearish/10',
        border: 'border-chart-bearish/30',
    },
    cautious: {
        text: 'text-ui-warning-text',
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

/** OptionsSignalKind → `shared.enumLabel.optionsSignalKind` 카탈로그 키. */
const SIGNAL_KIND_LABEL_KEY: Record<OptionsSignalKind, string> = {
    bullish: 'optionsSignalKind.bullish',
    bearish: 'optionsSignalKind.bearish',
    volatility: 'optionsSignalKind.volatility',
    neutral: 'optionsSignalKind.neutral',
};

interface ToneBadgeProps {
    tone: OptionsTone;
}

function ToneBadge({ tone }: ToneBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
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
            {tLabel(TONE_LABEL_KEY[tone])}
        </span>
    );
}

interface SignalBadgeProps {
    kind: OptionsSignalKind;
}

function SignalBadge({ kind }: SignalBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
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
            {tLabel(SIGNAL_KIND_LABEL_KEY[kind])}
        </span>
    );
}

interface OptionsAiAnalysisViewProps {
    result: OptionsAnalysisResponse;
}

export function OptionsAiAnalysisView({ result }: OptionsAiAnalysisViewProps) {
    const t = useTranslations('widgets.options');
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
            className="rounded-lg border border-primary-500/30 bg-gradient-to-br from-secondary-800 to-secondary-900 p-6 shadow-lg ring-1 shadow-primary-500/5 ring-primary-500/10"
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2
                    id="options-ai-analysis-heading"
                    className={HEADING_SECTION}
                >
                    {t('OptionsAiAnalysis.eefb95')}
                </h2>
                {result.analyzedAt ? (
                    <time
                        dateTime={result.analyzedAt}
                        className="text-xs text-secondary-500"
                    >
                        {formatAnalyzedAt(result.analyzedAt)}
                    </time>
                ) : null}
            </div>

            {result.summary ? (
                <p className="mb-5 text-sm leading-relaxed text-secondary-300">
                    {result.summary}
                </p>
            ) : null}

            {result.perExpiration.length > 0 && (
                <div className="mb-5">
                    <h3 className={cn('mb-3', HEADING_SUBSECTION)}>
                        {t('OptionsAiAnalysis.e26a05')}
                    </h3>
                    <ul
                        className="space-y-3"
                        aria-label={t('OptionsAiAnalysis.440d96')}
                    >
                        {result.perExpiration.map(item => (
                            <li
                                key={item.expirationDate}
                                className="rounded-lg border border-secondary-700 p-3"
                            >
                                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-medium text-secondary-200 tabular-nums">
                                        {item.expirationDate}
                                    </span>
                                    <ToneBadge tone={item.tone} />
                                </div>
                                <p className="text-sm leading-relaxed text-secondary-400">
                                    {item.commentary}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result.signals.length > 0 && (
                <div>
                    <h3 className={cn('mb-3', HEADING_SUBSECTION)}>
                        {t('OptionsAiAnalysis.598bf4')}
                    </h3>
                    <ul
                        className="space-y-2"
                        aria-label={t('OptionsAiAnalysis.e0c6a1')}
                    >
                        {result.signals.map(signal => (
                            <li
                                // Signals are render-only and the AI rarely emits
                                // duplicate `${kind}::${message}` pairs; using the
                                // composite as key avoids the index-key anti-pattern.
                                key={`${signal.kind}::${signal.message}`}
                                className="flex min-w-0 items-start gap-2 text-sm text-secondary-400"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-secondary-500"
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

interface OptionsAiAnalysisProps {
    symbol: string;
    companyName: string;
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: OptionsExpirationSelector;
    modelId: ModelId;
    /** Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle spec Part A). */
    reasoning?: boolean;
    /** `modelId`/`reasoning`이 확정값인지 여부 — 확정 전에는 제출하지 않는다. */
    isSettingsHydrated?: boolean;
    /**
     * SSR 스냅샷 프로즈가 같은 AI 결론을 이미 렌더 중일 때 `true`.
     *
     * UI만 숨기고 마운트는 유지한다 — 렌더 자체를 건너뛰면
     * `usePublishSymbolChat`이 돌지 않아 챗봇 컨텍스트가 비고 입력이 잠긴다.
     */
    hideView?: boolean;
    /**
     * 캐시에 있는 분석만 읽고 새로 만들지 않는다 — OI가 stale할 때 사용.
     * 자세한 근거는 `useOptionsAnalysis`의 동명 옵션 JSDoc 참조.
     */
    cacheOnly?: boolean;
}

export function OptionsAiAnalysis({
    symbol,
    companyName,
    expirationDate,
    modelId,
    reasoning,
    isSettingsHydrated,
    hideView = false,
    cacheOnly = false,
}: OptionsAiAnalysisProps) {
    const t = useTranslations('widgets.options');
    const state = useOptionsAnalysis({
        symbol,
        companyName,
        expirationDate,
        modelId,
        reasoning,
        isSettingsHydrated,
        cacheOnly,
    });

    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생
    // 변수)를 인자로 받으므로 useMemo 뒤에 위치해야 한다. 다른 페이지
    // (overall/fundamental/news/chart) 모두 동일 패턴.
    const chatState = buildChatState(state);
    usePublishSymbolChat(chatState);
    useRegisterShareable({
        kind: 'options',
        status: mapAnalysisStatus(state.status),
        result: state.status === 'done' ? state.result : null,
        context: {
            symbol,
            displayName: companyName,
            analyzedAt:
                state.status === 'done' ? state.result.analyzedAt : undefined,
        },
        trigger: state.trigger,
    });

    // 훅은 모두 실행된 뒤에 렌더만 건너뛴다 — publish는 유지된다.
    if (hideView) return null;

    if (state.status === 'loading') {
        return <OptionsAiAnalysisSkeleton />;
    }

    if (state.status === 'bot_blocked') {
        return (
            <section
                aria-labelledby="options-ai-analysis-heading"
                className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
            >
                <h2
                    id="options-ai-analysis-heading"
                    className={cn('mb-3', HEADING_SECTION)}
                >
                    {t('OptionsAiAnalysis.eefb95')}
                </h2>
                <BotBlockedNotice />
            </section>
        );
    }

    if (state.status === 'error') {
        return <OptionsAiAnalysisError resetErrorBoundary={state.retry} />;
    }

    return (
        <PlainAnalysisSwitch plain={state.plain}>
            <OptionsAiAnalysisView result={state.result} />
        </PlainAnalysisSwitch>
    );
}
