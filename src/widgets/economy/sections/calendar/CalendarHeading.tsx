'use client';

/**
 * 경제 캘린더 섹션 제목 — "경제 캘린더 (한국시간 기준)".
 */
import { useTranslations } from 'next-intl';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/** 섹션 `aria-labelledby`가 가리키는 제목 id. */
export const CALENDAR_HEADING_ID = 'economy-calendar-heading';

/** 섹션 제목과 시간대 보조 문구를 그린다. 아래 여백은 호출부가 정한다. */
export function CalendarHeading() {
    const t = useTranslations('widgets.economy');
    return (
        <h2 id={CALENDAR_HEADING_ID} className={HEADING_SECTION}>
            {t('EconomicCalendarGrid.596fce')}{' '}
            <span className="text-sm font-normal text-secondary-400">
                {t('EconomicCalendarGrid.4ccace')}
            </span>
        </h2>
    );
}
