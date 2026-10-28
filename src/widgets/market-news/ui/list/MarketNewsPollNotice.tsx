/**
 * 폴링 실패가 에러 바운더리로 번지지 않게, 이미 받은 목록은 두고 작은 안내만 덧붙인다.
 */
import { useTranslations } from 'next-intl';

/** `role="status"` — 목록은 그대로 두고 스크린리더에만 조용히 알린다. */
export function MarketNewsPollNotice() {
    const t = useTranslations('widgets.market-news');
    return (
        <p role="status" className="text-xs text-secondary-400">
            {t('MarketNewsList.pollFailed')}
        </p>
    );
}
