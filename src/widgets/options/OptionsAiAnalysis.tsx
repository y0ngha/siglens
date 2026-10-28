'use client';

/**
 * Options AI analysis card: wires the analysis hook, share registration and
 * status branches. Section markup lives in `ui/ai-analysis/`.
 */
import { useTranslations } from 'next-intl';
import type { ModelId, OptionsAnalysisResponse } from '@y0ngha/siglens-core';

import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatCapturedAtKst } from './utils/formatCapturedAtKst';
import { isEmptyOptionsAnalysis } from './utils/isEmptyOptionsAnalysis';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { OptionsAiAnalysisSkeleton } from './OptionsAiAnalysisSkeleton';
import { PerExpirationSection } from './ui/ai-analysis/PerExpirationSection';
import { SignalsSection } from './ui/ai-analysis/SignalsSection';
import { useOptionsAnalysis } from './hooks/useOptionsAnalysis';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { AiAnalysisAwaitingSection } from '@/shared/ui/AiAnalysisAwaitingSection';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';
import { mapAnalysisStatus } from '@/features/share/lib/mapAnalysisStatus';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';

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

/** Read-only analysis view; also used by the share panel. */
export function OptionsAiAnalysisView({
    result,
    basisCaption = null,
}: OptionsAiAnalysisViewProps) {
    const t = useTranslations('widgets.options');

    if (isEmptyOptionsAnalysis(result)) {
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

            <PerExpirationSection items={result.perExpiration} />
            <SignalsSection signals={result.signals} />
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

/** Live options analysis card for the options tab. */
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
    // nothing — this caller always pairs `cacheOnly` with `hideView`, so a
    // visible page never reaches this branch.
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
        return (
            <OptionsAiAnalysisError
                resetErrorBoundary={state.retry}
                message={state.error.message}
            />
        );
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
