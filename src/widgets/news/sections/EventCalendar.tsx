'use client';

/**
 * 실적 캘린더 섹션 — 제목과 비교 그리드를 조립한다. 표기·막대 계산·카드는 `utils/`·`ui/event-calendar/`에 있다.
 */
import { useTranslations } from 'next-intl';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { EarningsReportComparison } from '../ui/event-calendar/EarningsReportComparison';

interface EventCalendarProps {
    earningsReports: EarningsReportComparisonItem[];
}

/** 실적 발표가 없으면 섹션 자체를 그리지 않는다. */
export function EventCalendar({ earningsReports }: EventCalendarProps) {
    const t = useTranslations('widgets.news');
    if (earningsReports.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby="event-calendar-heading" className="space-y-3">
            <h2 id="event-calendar-heading" className={HEADING_SECTION}>
                {t('EventCalendar.4732b0')}
            </h2>
            <EarningsReportComparison items={earningsReports} />
        </section>
    );
}
