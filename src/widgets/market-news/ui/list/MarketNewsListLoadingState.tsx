/**
 * 첫 응답 전에 빈 화면이 뜨면 "뉴스 없음"으로 읽히므로, 수집 중임을 알리는 자리표시자를 둔다.
 */
import { useTranslations } from 'next-intl';
import { MarketNewsCardSkeleton } from './MarketNewsCardSkeleton';
import { MarketNewsListHeader } from './MarketNewsListHeader';

const SKELETON_COUNT = 3;
const SKELETON_SLOTS = Array.from({ length: SKELETON_COUNT }, (_, i) => i);

interface MarketNewsListLoadingStateProps {
    /** 헤더의 조회 기간 배지에 쓴다. */
    lookbackDays: number;
}

/** 스크린리더에도 대기 중임을 알리려고 `aria-busy`와 `aria-live`를 함께 쓴다. */
export function MarketNewsListLoadingState({
    lookbackDays,
}: MarketNewsListLoadingStateProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <section
            aria-labelledby="market-news-list-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <MarketNewsListHeader lookbackDays={lookbackDays} />
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
