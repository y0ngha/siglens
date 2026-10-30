import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';

/**
 * 렌더 직전에 행 수를 직렬화 상한에 맞춘다. 서버 렌더와 폴링 액션이 같은 상한을 쓰지만 한쪽이
 * 잃으면 첫 페인트의 "더보기 (N개 남음)"이 폴링 직후 실제 전체 개수로 튄다. 남기는 쪽은 앞(최신)이다.
 */
export function capMarketNewsRows<T>(items: readonly T[]): readonly T[] {
    return items.length > NEWS_ROW_SERIALIZATION_LIMIT
        ? items.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
        : items;
}
