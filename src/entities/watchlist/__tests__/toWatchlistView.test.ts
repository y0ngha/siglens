import { toWatchlistView } from '@/entities/watchlist/lib/toWatchlistView';

describe('toWatchlistView', () => {
    it('createdAt을 ISO 문자열 addedAt으로 옮기고 id·userId는 버린다', () => {
        expect(
            toWatchlistView({
                id: 'row-1',
                userId: 'user-1',
                symbol: 'MSFT',
                companyName: 'Microsoft Corp.',
                createdAt: new Date('2026-10-09T01:02:03.000Z'),
            })
        ).toEqual({
            symbol: 'MSFT',
            companyName: 'Microsoft Corp.',
            addedAt: '2026-10-09T01:02:03.000Z',
        });
    });
});
