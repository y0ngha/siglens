import {
    closeIfCurrent,
    resolveHoldingsListView,
} from '@/features/portfolio-management/lib/portfolioSectionState';

describe('resolveHoldingsListView', () => {
    it('returns loading while loading, even when the query also failed', () => {
        expect(resolveHoldingsListView(true, true, 0)).toBe('loading');
    });

    it('returns error instead of empty when the query failed with no holdings', () => {
        expect(resolveHoldingsListView(false, true, 0)).toBe('error');
    });

    it('returns empty when settled with no holdings', () => {
        expect(resolveHoldingsListView(false, false, 0)).toBe('empty');
    });

    it('returns list when settled with holdings', () => {
        expect(resolveHoldingsListView(false, false, 2)).toBe('list');
    });
});

describe('closeIfCurrent', () => {
    it('closes the row when it is still the open one', () => {
        expect(closeIfCurrent('AAPL')('AAPL')).toBeNull();
    });

    it('keeps another row open', () => {
        expect(closeIfCurrent('AAPL')('MSFT')).toBe('MSFT');
    });

    it('keeps nothing open when nothing was open', () => {
        expect(closeIfCurrent('AAPL')(null)).toBeNull();
    });
});
