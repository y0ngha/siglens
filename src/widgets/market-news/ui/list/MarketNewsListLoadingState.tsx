/**
 * 첫 폴링 응답을 기다리는 동안의 목록 화면.
 */
import { useTranslations } from 'next-intl';
import { MarketNewsCardSkeleton } from './MarketNewsCardSkeleton';
import { MarketNewsListHeader } from './MarketNewsListHeader';

const SKELETON_COUNT = 3;
const SKELETON_SLOTS = Array.from({ length: SKELETON_COUNT }, (_, i) => i);

/** `aria-busy` 섹션과 `aria-live` 수집 안내, 카드 스켈레톤 3장. */
export function MarketNewsListLoadingState() {
    const t = useTranslations('widgets.market-news');
    return (
        <section
            aria-labelledby="market-news-list-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <MarketNewsListHeader />
            <span
                className="block text-xs text-secondary-400"
                aria-live="polite"
                aria-atomic="true"
            >
                {t('MarketNewsList.b514aa')}
            </span>
            <ul className="space-y-3">
                {SKELETON_SLOTS.map(slot => (
                    // 고정 개수의 정적 자리표시자라 재정렬·삽입이 없다 — 슬롯 번호로 충분하다.
                    <li key={slot}>
                        <MarketNewsCardSkeleton />
                    </li>
                ))}
            </ul>
        </section>
    );
}
