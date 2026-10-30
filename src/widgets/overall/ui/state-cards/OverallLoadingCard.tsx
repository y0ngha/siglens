'use client';

import { type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { Spinner } from '@/shared/ui/Spinner';

const SKELETON_WIDTH_START_PCT = 85;
const SKELETON_WIDTH_STEP_PCT = 12;
const SKELETON_LINE_COUNT = 3;

const SKELETON_WIDTHS_PCT = Array.from(
    { length: SKELETON_LINE_COUNT },
    (_, i) => SKELETON_WIDTH_START_PCT - i * SKELETON_WIDTH_STEP_PCT
);

/** 분석 요청이 진행 중일 때의 스피너와 스켈레톤 줄. */
export function OverallLoadingCard() {
    const t = useTranslations('widgets.overall');
    return (
        <section
            aria-labelledby="overall-loading-heading"
            aria-busy="true"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2
                id="overall-loading-heading"
                className={cn(HEADING_SECTION, 'mb-4 text-balance')}
            >
                {t('OverallContent.8b7ae7')}
            </h2>
            <div className="flex items-center gap-3">
                <Spinner />
                <p
                    className="text-sm text-secondary-400"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {t('OverallContent.e69812')}
                </p>
            </div>
            <div className="mt-4 space-y-2">
                {SKELETON_WIDTHS_PCT.map(widthPct => (
                    <div
                        key={widthPct}
                        className={cn(
                            'bg-secondary-700 h-4 animate-pulse rounded motion-reduce:animate-none',
                            'w-(--skeleton-w)'
                        )}
                        style={
                            {
                                '--skeleton-w': `${widthPct}%`,
                            } as CSSProperties
                        }
                        aria-hidden="true"
                    />
                ))}
            </div>
        </section>
    );
}
