import { isRawWatchlistInput } from '@/entities/watchlist/lib/isRawWatchlistInput';

describe('isRawWatchlistInput', () => {
    it('symbol·label이 모두 문자열이면 true', () => {
        expect(isRawWatchlistInput({ symbol: 'AAPL', label: '' })).toBe(true);
    });

    it.each([
        null,
        undefined,
        'AAPL',
        42,
        {},
        { symbol: 'AAPL' },
        { label: 'x' },
        { symbol: 42, label: 'x' },
        { symbol: 'AAPL', label: null },
    ])('형상이 깨졌으면 false: %j', input => {
        expect(isRawWatchlistInput(input)).toBe(false);
    });
});
