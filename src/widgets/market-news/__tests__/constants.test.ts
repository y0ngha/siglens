import { NEWS_ROW_SERIALIZATION_LIMIT as MARKET_NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';

describe('market-news constants', () => {
    /**
     * 카테고리 페이지가 클라이언트로 넘기는 행 수를 정하는 값이다. 페이지 테스트는
     * 실제 값을 읽고, 값 자체를 고정하는 곳은 여기뿐이다.
     */
    it('MARKET_NEWS_ROW_SERIALIZATION_LIMIT는 50이다', () => {
        expect(MARKET_NEWS_ROW_SERIALIZATION_LIMIT).toBe(50); // PAGE_SIZE(10) × 5페이지
    });
});
