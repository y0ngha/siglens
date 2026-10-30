import {
    insertWatchlistItemAt,
    rollbackAddedItem,
    rollbackRemovedItem,
} from '../lib/watchlistListOps';
import type { WatchlistItemView } from '../model';

const item = (symbol: string): WatchlistItemView => ({
    symbol,
    companyName: null,
    addedAt: '2026-10-09T00:00:00.000Z',
});
const symbols = (list: WatchlistItemView[]): string[] =>
    list.map(i => i.symbol);

describe('insertWatchlistItemAt', () => {
    it('index 자리에 끼운다', () => {
        expect(
            symbols(insertWatchlistItemAt([item('A'), item('C')], item('B'), 1))
        ).toEqual(['A', 'B', 'C']);
    });

    it('index가 길이를 넘으면 맨 뒤에 붙인다', () => {
        expect(
            symbols(insertWatchlistItemAt([item('A')], item('B'), 9))
        ).toEqual(['A', 'B']);
    });
});

describe('rollbackAddedItem', () => {
    it('이전에 없던 심볼이면 낙관적 행만 지운다', () => {
        expect(
            symbols(
                rollbackAddedItem([item('N'), item('A')], {
                    symbol: 'N',
                    prior: null,
                    index: -1,
                })
            )
        ).toEqual(['A']);
    });

    it('이전에 있던 심볼이면 원래 자리에 원래 행으로 되돌린다', () => {
        const prior = { ...item('B'), companyName: 'Old' };
        const result = rollbackAddedItem([item('B'), item('A'), item('C')], {
            symbol: 'B',
            prior,
            index: 2,
        });
        expect(result).toEqual([item('A'), item('C'), prior]);
    });
});

describe('rollbackRemovedItem', () => {
    const context = { symbol: 'B', prior: item('B'), index: 1 };

    it('지운 행을 원래 자리에 다시 넣는다', () => {
        expect(
            symbols(rollbackRemovedItem([item('A'), item('C')], context))
        ).toEqual(['A', 'B', 'C']);
    });

    it('이미 돌아와 있으면 같은 배열을 그대로 돌려준다', () => {
        const list = [item('A'), item('B')];
        expect(rollbackRemovedItem(list, context)).toBe(list);
    });

    it('prior가 없으면 건드리지 않는다', () => {
        const list = [item('A')];
        expect(
            rollbackRemovedItem(list, { symbol: 'B', prior: null, index: -1 })
        ).toBe(list);
    });
});
