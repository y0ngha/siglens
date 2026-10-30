/**
 * 종목 뉴스 사실 요약 카드 — 제목과 (빈 상태 | 본문) 선택만 맡는다. 집계는 `utils/newsFacts`, 본문은 `ui/news-facts/`.
 */
import { useTranslations } from 'next-intl';
import type { NewsDisplayItem } from '@/shared/lib/types';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { NewsFactsBody } from './ui/news-facts/NewsFactsBody';

export interface NewsFactsSummaryProps {
    displayName: string;
    assetClass: AssetClass;
    items: readonly NewsDisplayItem[];
}

/** 기사가 없으면 안내 문구만, 있으면 집계 본문을 보인다. */
export function NewsFactsSummary({
    displayName,
    assetClass,
    items,
}: NewsFactsSummaryProps) {
    const t = useTranslations('widgets.news');

    return (
        <section
            aria-labelledby="news-facts-summary-heading"
            className={cn(SURFACE_CARD, 'p-5')}
        >
            <h2 id="news-facts-summary-heading" className={HEADING_SECTION}>
                {displayName} {t('NewsFactsSummary.438417')}
            </h2>

            {items.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-secondary-300">
                    {t('NewsFactsSummary.3ed34b', { v0: displayName })}
                </p>
            ) : (
                <NewsFactsBody
                    displayName={displayName}
                    assetClass={assetClass}
                    items={items}
                />
            )}
        </section>
    );
}
