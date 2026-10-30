'use client';

/**
 * AI 요약 카드의 제목과 분석 기간 배지 — 로딩·오류·결과 카드가 같은 머리말을 쓴다.
 */
import { useTranslations } from 'next-intl';
import { NEWS_ANALYSIS_PERIOD_KEY } from '@/shared/lib/news/periodLabels';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface SummaryTitleProps {
    /** `aria-labelledby`가 가리킬 h2의 id. */
    headingId: string;
}

/** h2와 기간 배지. */
export function SummaryTitle({ headingId }: SummaryTitleProps) {
    const t = useTranslations('widgets.news');
    const tPeriod = useTranslations('shared.lib.newsPeriod');
    return (
        <div className="flex min-w-0 items-center gap-2">
            <h2 id={headingId} className={HEADING_SECTION}>
                {t('NewsAiSummary.a74178')}
            </h2>
            <span className="shrink-0 rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                {tPeriod(NEWS_ANALYSIS_PERIOD_KEY)}
            </span>
        </div>
    );
}
