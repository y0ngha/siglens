'use client';

import { useTranslations } from 'next-intl';
import { MS_PER_MINUTE } from '@/shared/config/time';

const COOLDOWN_TOOLTIP_ID = 'stale-banner-cooldown-tooltip';

interface StaleAnalysisBannerProps {
    onReanalyze: () => void;
    reanalyzeCooldownMs: number;
}

export function StaleAnalysisBanner({
    onReanalyze,
    reanalyzeCooldownMs,
}: StaleAnalysisBannerProps) {
    const t = useTranslations('widgets.analysis.staleBanner');
    const isCoolingDown = reanalyzeCooldownMs > 0;
    const cooldownMinutes = Math.ceil(reanalyzeCooldownMs / MS_PER_MINUTE);
    return (
        <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning"
        >
            <span>{t('message')}</span>
            <div className="relative inline-flex">
                <button
                    type="button"
                    onClick={onReanalyze}
                    disabled={isCoolingDown}
                    aria-describedby={
                        isCoolingDown ? COOLDOWN_TOOLTIP_ID : undefined
                    }
                    title={
                        isCoolingDown
                            ? t('cooldown', { v0: cooldownMinutes })
                            : undefined
                    }
                    className="rounded-md border border-ui-warning/40 px-2 py-1 text-xs font-medium hover:bg-ui-warning/20 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none disabled:opacity-40"
                >
                    {t('reanalyze')}
                </button>
                {isCoolingDown && (
                    <span
                        id={COOLDOWN_TOOLTIP_ID}
                        role="tooltip"
                        className="sr-only"
                    >
                        {t('cooldown', { v0: cooldownMinutes })}
                    </span>
                )}
            </div>
        </div>
    );
}
