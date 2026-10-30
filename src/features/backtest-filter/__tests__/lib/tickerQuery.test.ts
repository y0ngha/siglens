import {
    BACKTEST_ALL_TAB,
    buildTickerHref,
    resolveTickerTab,
} from '@/features/backtest-filter/lib/tickerQuery';

describe('resolveTickerTab', () => {
    const tickers = ['AAPL', 'MSFT'];

    it('keeps a ticker that is in the list', () => {
        expect(resolveTickerTab(tickers, 'MSFT')).toBe('MSFT');
    });

    it('falls back to the all-tab for null, unknown values and the all-tab itself', () => {
        expect(resolveTickerTab(tickers, null)).toBe(BACKTEST_ALL_TAB);
        expect(resolveTickerTab(tickers, 'INVALID')).toBe(BACKTEST_ALL_TAB);
        expect(resolveTickerTab(tickers, BACKTEST_ALL_TAB)).toBe(
            BACKTEST_ALL_TAB
        );
    });
});

describe('buildTickerHref', () => {
    it('sets ?ticker= on the current path, keeping other params and the hash', () => {
        expect(
            buildTickerHref(
                { pathname: '/en/backtesting', search: '?utm=a', hash: '#x' },
                'AAPL'
            )
        ).toBe('/en/backtesting?utm=a&ticker=AAPL#x');
    });

    it('replaces an existing ?ticker= value', () => {
        expect(
            buildTickerHref(
                { pathname: '/backtesting', search: '?ticker=MSFT', hash: '' },
                'AAPL'
            )
        ).toBe('/backtesting?ticker=AAPL');
    });

    it('drops ?ticker= (and the bare "?") for the all-tab', () => {
        expect(
            buildTickerHref(
                { pathname: '/backtesting', search: '?ticker=MSFT', hash: '' },
                BACKTEST_ALL_TAB
            )
        ).toBe('/backtesting');
    });
});
