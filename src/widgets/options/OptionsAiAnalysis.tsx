'use client';

import { useTranslations } from 'next-intl';
import type {
    ModelId,
    OptionsAnalysisResponse,
    OptionsSignalKind,
    OptionsTone,
} from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatCapturedAtKst } from './utils/formatCapturedAtKst';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { OptionsAiAnalysisSkeleton } from './OptionsAiAnalysisSkeleton';
import { useOptionsAnalysis } from './hooks/useOptionsAnalysis';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { AiAnalysisAwaitingSection } from '@/shared/ui/AiAnalysisAwaitingSection';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';
import { mapAnalysisStatus } from '@/features/share/lib/mapAnalysisStatus';
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
    /**
     * 분석이 읽은 옵션 데이터의 기준을 밝히는 한 줄(예: "분석 기준: 직전 정규장 · 10월 3일
     * 05:00 KST 수집"). `analyzedAt`은 분석을 **만든** 시각일 뿐 입력 데이터의 시점이
     * 아니라서, 정규장 밖에 직전 정규장 스냅샷을 쓰는 경우에만 별도로 알린다.
     * 공유 패널처럼 스냅샷 정보가 없는 호출부는 넘기지 않는다.
     */
    basisCaption?: string | null;
}

export function OptionsAiAnalysisView({
    result,
    basisCaption = null,
}: OptionsAiAnalysisViewProps) {
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

            {basisCaption !== null && (
                <p className="mb-3 text-[10px] text-secondary-500">
                    {basisCaption}
                </p>
            )}

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
     * UI만 숨기고 마운트는 유지한다 — `useRegisterShareable`이 여기서만 불리므로,
     * 렌더 자체를 건너뛰면 헤더의 공유 버튼이 이 탭의 분석 결과를 등록받지
     * 못한다.
     */
    hideView?: boolean;
    /**
     * 캐시에 있는 분석만 읽고 새로 만들지 않는다 — OI가 stale할 때 사용.
     * 자세한 근거는 `useOptionsAnalysis`의 동명 옵션 JSDoc 참조.
     */
    cacheOnly?: boolean;
    /** 옵션 스냅샷 수집 시각(ISO). `showSnapshotBasis`가 켜질 때만 읽는다. */
    snapshotCapturedAt?: string;
    /**
     * 정규장 밖에 직전 정규장 스냅샷으로 분석한 경우 `true`(지표 카드의 캡션과 같은 조건).
     * 부모가 마운트 이후에만 켠다 — 서버·첫 렌더는 항상 `false`.
     */
    showSnapshotBasis?: boolean;
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
    snapshotCapturedAt,
    showSnapshotBasis = false,
}: OptionsAiAnalysisProps) {
    const t = useTranslations('widgets.options');
    const locale = useResolvedLocale();
    const { allowed: autoRunAllowed, grant } = useAiAutoRunAllowed(symbol);
    const state = useOptionsAnalysis({
        symbol,
        companyName,
        expirationDate,
        modelId,
        reasoning,
        isSettingsHydrated,
        cacheOnly,
        autoRunAllowed,
    });

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
        // 공유 스냅샷에 쉽게보기 산문을 함께 싣는다 — 링크를 받은 사람은
        // SSE 라우트를 타지 않아 평이화를 다시 만들 수 없다.
        plain: state.status === 'done' ? state.plain : null,
        trigger: state.trigger,
    });

    // 훅은 모두 실행된 뒤에 렌더만 건너뛴다 — 공유 데이터 등록은 유지된다.
    if (hideView) return null;

    const capturedAtKst =
        showSnapshotBasis && snapshotCapturedAt !== undefined
            ? formatCapturedAtKst(snapshotCapturedAt, locale)
            : null;
    const basisCaption =
        capturedAtKst === null
            ? null
            : t('OptionsAiAnalysis.previousSessionBasis', {
                  v0: capturedAtKst,
              });

    if (state.status === 'loading') {
        return <OptionsAiAnalysisSkeleton />;
    }

    // `cache_miss`: the cacheOnly read found no cached analysis. Render
    // nothing (no data, no notice) — in practice this caller always pairs
    // `cacheOnly` with `hideView` too (see `useOptionsAnalysis`'s `cacheOnly`
    // JSDoc), so this never reaches a visible page.
    if (state.status === 'cache_miss') {
        return null;
    }

    if (state.status === 'awaiting_interaction') {
        return (
            <AiAnalysisAwaitingSection
                heading={t('OptionsAiAnalysis.eefb95')}
                idPrefix="options-ai-analysis"
                onStart={grant}
            />
        );
    }

    if (state.status === 'error') {
        return <OptionsAiAnalysisError resetErrorBoundary={state.retry} />;
    }

    return (
        <PlainAnalysisSwitch plain={state.plain}>
            <OptionsAiAnalysisView
                result={state.result}
                basisCaption={basisCaption}
            />
        </PlainAnalysisSwitch>
    );
}
