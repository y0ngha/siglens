'use client';

/**
 * 뉴스 목록의 제목과 조회 기간 배지 — 로딩·빈 상태·목록이 같은 머리말을 쓴다.
 */
import { useTranslations } from 'next-intl';
import { NEWS_LIST_PERIOD_KEY } from '@/shared/lib/news/periodLabels';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/** `aria-labelledby="news-list-heading"`가 가리키는 h2와 기간 배지. */
export function NewsListHeading() {
    const t = useTranslations('widgets.news');
    const tPeriod = useTranslations('shared.lib.newsPeriod');
    return (
        <div className="flex min-w-0 items-center gap-2">
            <h2 id="news-list-heading" className={HEADING_SECTION}>
                {t('NewsList.ac2367')}
            </h2>
            <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                {tPeriod(NEWS_LIST_PERIOD_KEY)}
            </span>
        </div>
    );
}
