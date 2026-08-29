'use client';

import { useTranslations } from 'next-intl';
import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';

import { useMacroBriefing } from '../hooks/useMacroBriefing';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/** MacroBriefingResponse['regime'] → `shared.enumLabel.macroRegime` 카탈로그 키. */
const REGIME_LABEL_KEY: Record<MacroBriefingResponse['regime'], string> = {
    expansion: 'macroRegime.expansion',
    slowdown: 'macroRegime.slowdown',
    contraction: 'macroRegime.contraction',
    recovery: 'macroRegime.recovery',
    neutral: 'macroRegime.neutral',
};

const REGIME_COLORS: Record<MacroBriefingResponse['regime'], string> = {
    expansion: 'bg-ui-success/20 text-ui-success-text',
    slowdown: 'bg-ui-warning/20 text-ui-warning-text',
    contraction: 'bg-ui-danger/20 text-ui-danger-text',
    recovery: 'bg-ui-success/20 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-100',
};

interface MacroBriefingProps {
    peekSeed: MacroBriefingResponse | null;
}

interface MacroBriefingViewProps {
    briefing: MacroBriefingResponse;
    /** null when displaying peekSeed before the real generatedAt is available from the server. */
    generatedAt: string | null;
}

interface MacroBriefingErrorProps {
    onRetry: () => void;
}

/**
 * /economy 상단 거시 AI 브리핑 위젯.
 *
 * 흐름:
 * 1. mount → `useMacroBriefing` — peekSeed가 있으면 그걸 먼저 표시.
 * 2. cached/done이면 briefing 본문 표시. error/봇 차단/미정 시 안내.
 *
 * error는 위젯이 inline notice로 처리한다 — throw로 라우트 단위 boundary에
 * 빠지면 indicator grid·calendar까지 unmount되므로 회피.
 */
export function MacroBriefing({ peekSeed }: MacroBriefingProps) {
    const { input, refetch } = useMacroBriefing(peekSeed);

    if (input === undefined) return <MacroBriefingSkeleton />;
    if (input === null) return <MacroBriefingBotBlocked />;
    if (input === 'error') return <MacroBriefingError onRetry={refetch} />;
    // `cached`와 `done`은 둘 다 briefing 본문을 들고 온다 — 구 구조에서는 `done`이
    // jobId만 주고 별도 폴링 뷰가 결과를 받아왔지만, 이제 한 번의 호출로 완결된다.
    return (
        <MacroBriefingView
            briefing={input.briefing}
            generatedAt={input.generatedAt}
        />
    );
}

function MacroBriefingView({ briefing, generatedAt }: MacroBriefingViewProps) {
    const t = useTranslations('widgets.economy');
    const tLabel = useTranslations('shared.enumLabel');
    const locale = useResolvedLocale();
    return (
        <section
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
            aria-labelledby="macro-briefing-heading"
        >
            <header className="mb-4 flex items-center gap-3">
                <h2 id="macro-briefing-heading" className={HEADING_SECTION}>
                    {t('MacroBriefing.283194')}
                </h2>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-sm font-medium',
                        REGIME_COLORS[briefing.regime]
                    )}
                >
                    {tLabel(REGIME_LABEL_KEY[briefing.regime])}
                </span>
            </header>
            <p className="mb-4 leading-relaxed whitespace-pre-line text-secondary-200">
                {briefing.summary}
            </p>
            {briefing.highlights.length > 0 && (
                <ul className="space-y-1 text-sm text-secondary-300">
                    {briefing.highlights.map(h => (
                        // briefing 객체가 교체될 때 항목 수가 다르면 index key는
                        // 잘못된 reconciliation을 유발한다 — content+index 결합으로 stable화.
                        <li key={h} className="flex gap-2">
                            <span aria-hidden>•</span>
                            <span>{h}</span>
                        </li>
                    ))}
                </ul>
            )}
            {generatedAt !== null && (
                <p className="mt-3 text-xs text-secondary-400">
                    {t('MacroBriefing.62f15d', {
                        v0: formatKoreanDateTime(generatedAt, locale),
                    })}
                </p>
            )}
        </section>
    );
}

function MacroBriefingSkeleton() {
    const t = useTranslations('widgets.economy');
    return (
        <section
            className="animate-pulse rounded-lg border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
            aria-busy="true"
            aria-label={t('MacroBriefing.a0f763')}
        >
            <div className="mb-3 h-6 w-32 rounded bg-secondary-700" />
            <div className="mb-2 h-4 w-full rounded bg-secondary-700" />
            <div className="h-4 w-4/5 rounded bg-secondary-700" />
        </section>
    );
}

function MacroBriefingBotBlocked() {
    const t = useTranslations('widgets.economy');
    return (
        <section
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6 text-sm text-secondary-300"
            aria-label={t('MacroBriefing.b5f759')}
        >
            {t('MacroBriefing.903a71')}
        </section>
    );
}

function MacroBriefingError({ onRetry }: MacroBriefingErrorProps) {
    const t = useTranslations('widgets.economy');
    return (
        <section
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
            role="alert"
            aria-label={t('MacroBriefing.b5f759')}
        >
            <p className="text-sm text-secondary-300">
                {t('MacroBriefing.15d863')}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex min-h-11 items-center rounded bg-primary-600 px-3 py-2 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                {t('MacroBriefing.0c767c')}
            </button>
        </section>
    );
}
