import { normalizeWatchlistLabel } from '@/entities/watchlist/lib/normalizeWatchlistLabel';
import { WATCHLIST_LABEL_MAX_LENGTH } from '@/shared/config/watchlist';

describe('normalizeWatchlistLabel', () => {
    it('공백을 지운다', () => {
        expect(normalizeWatchlistLabel('  애플 ', 'AAPL')).toBe('애플');
    });

    it('비었거나 심볼과 같으면 null', () => {
        expect(normalizeWatchlistLabel('   ', 'AAPL')).toBeNull();
        expect(normalizeWatchlistLabel('aapl', 'AAPL')).toBeNull();
    });

    it('코드포인트 단위로 자른다(서로게이트 쌍을 쪼개지 않는다)', () => {
        const result = normalizeWatchlistLabel(
            '😀'.repeat(WATCHLIST_LABEL_MAX_LENGTH + 50),
            'AAPL'
        );
        expect(Array.from(result ?? '')).toHaveLength(
            WATCHLIST_LABEL_MAX_LENGTH
        );
        expect(result).toBe('😀'.repeat(WATCHLIST_LABEL_MAX_LENGTH));
    });
});
