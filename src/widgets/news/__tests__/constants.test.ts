import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    NEWS_ROW_SERIALIZATION_LIMIT,
} from '@/widgets/news/constants';

describe('news constants', () => {
    it('POLL_INTERVAL_MS is 3 seconds', () => {
        expect(POLL_INTERVAL_MS).toBe(3_000);
    });

    it('MAX_CONSECUTIVE_FAILURES is 3', () => {
        expect(MAX_CONSECUTIVE_FAILURES).toBe(3);
    });

    /**
     * 값이 바뀌면 클라이언트로 나가는 행 수가 바뀐다 — 페이로드와 "더보기" 깊이를
     * 동시에 정하는 숫자라 조용히 흔들리면 안 된다. PAGE_SIZE(5) × 10페이지.
     */
    it('NEWS_ROW_SERIALIZATION_LIMIT는 50이다', () => {
        expect(NEWS_ROW_SERIALIZATION_LIMIT).toBe(50);
    });
});
