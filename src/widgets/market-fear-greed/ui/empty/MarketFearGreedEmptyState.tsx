/**
 * 시장 공포·탐욕 판독값이 없을 때(표본 부족) 게이지 대신 보이는 안내.
 */
import { useTranslations } from 'next-intl';

/** 데이터 부족 안내 두 줄. 판독값이 없으니 게이지·요인 섹션을 통째로 대신한다. */
export function MarketFearGreedEmptyState() {
    const t = useTranslations('widgets.market-fear-greed');
    return (
        <div className="flex flex-col gap-2 py-6 text-sm text-secondary-400">
            <p>{t('MarketFearGreedPage.1d7b3e')}</p>
            <p className="text-xs text-secondary-500">
                {t('MarketFearGreedPage.e446f9')}
            </p>
        </div>
    );
}
