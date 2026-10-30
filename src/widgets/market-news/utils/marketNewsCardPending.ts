/**
 * 마켓 뉴스 카드의 AI 보강 대기 여부 판정.
 */
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';

/**
 * 감성이나 가격 영향 중 하나라도 비어 있으면 아직 보강 전인 카드다.
 *
 * 엔티티 `hasPendingCard`(`entities/news-article/lib/cardPollDecision`)의 카드 한 장짜리
 * 규칙과 같아야 한다 — 폴러는 그 규칙으로 "전부 보강됨"을 판정하고, 이 함수는 같은 기준으로
 * 스켈레톤 표시를 정한다. 둘이 어긋나면 폴링은 끝났는데 스켈레톤이 남는다.
 */
export function isMarketNewsCardPending(
    item: Pick<MarketNewsCardItem, 'sentiment' | 'priceImpact'>
): boolean {
    return item.sentiment === null || item.priceImpact === null;
}
