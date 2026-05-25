import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
} from '@/widgets/news/constants';

describe('news constants', () => {
    it('POLL_INTERVAL_MS is 3 seconds', () => {
        expect(POLL_INTERVAL_MS).toBe(3_000);
    });

    it('MAX_CONSECUTIVE_FAILURES is 3', () => {
        expect(MAX_CONSECUTIVE_FAILURES).toBe(3);
    });
});
