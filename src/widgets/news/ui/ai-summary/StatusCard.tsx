'use client';

/**
 * 분석 준비 중 카드 — 뉴스 수집 단계와 분석 단계를 같은 골격으로 보여 준다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { Spinner } from '@/shared/ui/Spinner';
import { SummaryTitle } from './SummaryTitle';

interface StatusCardProps {
    phase: 'fetching' | 'analyzing';
}

/** `fetching`은 뉴스 카드 보강 대기, `analyzing`은 집계 분석 대기. */
export function StatusCard({ phase }: StatusCardProps) {
    const t = useTranslations('widgets.news');
    const isFetching = phase === 'fetching';

    return (
        <section
            aria-labelledby="news-ai-summary-status-heading"
            aria-busy="true"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6 motion-safe:animate-[fade-in_200ms_ease-out]'
            )}
        >
            <div className="mb-4">
                <SummaryTitle headingId="news-ai-summary-status-heading" />
            </div>
            <div className="flex items-center gap-3">
                <Spinner />
                <p
                    className="text-sm text-secondary-400"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {isFetching
                        ? t('NewsAiSummary.678c71')
                        : t('NewsAiSummary.c520e4')}
                </p>
            </div>
            <p className="mt-2 text-xs text-secondary-500">
                {isFetching
                    ? t('NewsAiSummary.c4068f')
                    : t('NewsAiSummary.595bae')}
            </p>
            <div className="mt-4 space-y-2" aria-hidden="true">
                <div className="h-4 w-[91%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[67%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[79%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
        </section>
    );
}
