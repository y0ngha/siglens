/**
 * 백그라운드 새로고침이 실패했음을 알리는 비차단 안내.
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
