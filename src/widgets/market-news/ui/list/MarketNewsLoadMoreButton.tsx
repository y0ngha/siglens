/**
 * 카드가 많은 카테고리에서 한 번에 다 그리지 않고 사용자가 펼치게 해 초기 렌더 비용을 줄인다.
 */
import { useTranslations } from 'next-intl';

interface MarketNewsLoadMoreButtonProps {
    remaining: number;
    onClick: () => void;
}

/** 남은 개수를 라벨에 보여 줘야 사용자가 더 볼지 판단할 수 있다. */
export function MarketNewsLoadMoreButton({
    remaining,
    onClick,
}: MarketNewsLoadMoreButtonProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border-control py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {t('MarketNewsList.8e5a3a', { v0: remaining })}
        </button>
    );
}
