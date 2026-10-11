import { sortWatchlistItems } from '@/features/watchlist/lib/sortWatchlist';
import type { WatchlistItemView } from '@/entities/watchlist/model';

const item = (symbol: string): WatchlistItemView => ({
    symbol,
    companyName: null,
    addedAt: '2026-10-11T00:00:00.000Z',
});
const items = [item('B'), item('C'), item('A')];
const names: Record<string, string> = { A: '애플', B: '테슬라', C: '엔비디아' };
const changes: Record<string, number | null> = { A: 1.2, B: null, C: 3 };
const accessors = {
    nameOf: (i: WatchlistItemView) => names[i.symbol]!,
    changeOf: (i: WatchlistItemView) => changes[i.symbol] ?? null,
    locale: 'ko',
};

describe('sortWatchlistItems', () => {
    it('담은 순은 입력 순서를 그대로 둔다', () => {
        expect(
            sortWatchlistItems(items, 'added', accessors).map(i => i.symbol)
        ).toEqual(['B', 'C', 'A']);
    });

    it('이름 순은 보이는 이름으로 정렬한다', () => {
        expect(
            sortWatchlistItems(items, 'name', accessors).map(i => i.symbol)
        ).toEqual(['A', 'C', 'B']);
    });

    it('등락률 순은 큰 것부터, 시세를 모르는 행은 맨 뒤', () => {
        expect(
            sortWatchlistItems(items, 'change', accessors).map(i => i.symbol)
        ).toEqual(['C', 'A', 'B']);
    });

    it('입력 배열을 바꾸지 않는다', () => {
        const input = [...items];
        sortWatchlistItems(input, 'name', accessors);
        expect(input.map(i => i.symbol)).toEqual(['B', 'C', 'A']);
    });
});
