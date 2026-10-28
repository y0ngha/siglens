/**
 * 상태마다 따로 그리면 조회 기간 표기가 어긋나 한 곳에 둔다.
 */
import { useTranslations } from 'next-intl';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface MarketNewsListHeaderProps {
    /** 수집 쪽 조회 기간과 같은 값을 오케스트레이터가 내려 준다. */
    lookbackDays: number;
}

/** 제목 id(`market-news-list-heading`)가 한 곳에서만 정의돼야 각 섹션의 `aria-labelledby`가 어긋나지 않는다. */
export function MarketNewsListHeader({
    lookbackDays,
}: MarketNewsListHeaderProps) {
    const t = useTranslations('widgets.market-news');
    const tMisc = useTranslations('shared.ui.misc');
    return (
        <div className="flex items-center justify-between gap-2">
            <h2 id="market-news-list-heading" className={HEADING_SECTION}>
                {t('MarketNewsList.d107e1')}
            </h2>
            <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-300">
                {tMisc('lastNDays', { v0: lookbackDays })}
            </span>
        </div>
    );
}
