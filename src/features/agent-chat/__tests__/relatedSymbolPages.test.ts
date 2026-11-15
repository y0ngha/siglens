import { describe, expect, it } from 'vitest';
import type { ToolActivityItem } from '@/features/agent-chat/model/types';
import { relatedSymbolPages } from '@/features/agent-chat/lib/relatedSymbolPages';

const tool = (
    name: string,
    args: Record<string, unknown>,
    status: ToolActivityItem['status'] = 'ok'
): ToolActivityItem => ({
    id: `${name}-${JSON.stringify(args)}`,
    name,
    args,
    status,
});

describe('relatedSymbolPages', () => {
    it('one page per looked-up symbol, in first-seen order, upper-cased', () => {
        expect(
            relatedSymbolPages([
                tool('get_quote', { symbols: ['nvda', '005930.KS'] }),
                tool('get_bars_indicators', { symbol: 'NVDA' }),
            ])
        ).toEqual([
            { symbol: 'NVDA', tab: '' },
            { symbol: '005930.KS', tab: '' },
        ]);
    });

    it('a more specific tab replaces the chart page, but never the other way round', () => {
        expect(
            relatedSymbolPages([
                tool('get_quote', { symbols: ['TSLA'] }),
                tool('get_cached_analysis', { symbol: 'TSLA', tab: 'overall' }),
                tool('get_news', { symbol: 'TSLA' }),
            ])
        ).toEqual([{ symbol: 'TSLA', tab: 'overall' }]);
        expect(
            relatedSymbolPages([
                tool('run_fresh_analysis', {
                    symbol: 'AAPL',
                    kind: 'technical',
                }),
                tool('get_options_summary', { symbol: 'AAPL' }),
            ])
        ).toEqual([{ symbol: 'AAPL', tab: 'options' }]);
    });

    it('skips failed calls, lookups without a page, and malformed symbols', () => {
        expect(
            relatedSymbolPages([
                tool('get_quote', { symbols: ['AAPL'] }, 'error'),
                tool('get_quote', { symbols: ['MSFT'] }, 'running'),
                tool('search_ticker', { query: '엔비디아' }),
                tool('web_search', { query: 'NVDA news' }),
                tool('get_my_portfolio', {}),
                tool('get_quote', { symbols: ['../evil', 42] }),
            ])
        ).toEqual([]);
    });

    it('caps the list', () => {
        expect(
            relatedSymbolPages(
                [tool('get_quote', { symbols: ['A', 'B', 'C', 'D'] })],
                2
            ).map(p => p.symbol)
        ).toEqual(['A', 'B']);
    });

    it('get_fundamentals points at the fundamental tab, get_congress_trades at congress', () => {
        expect(
            relatedSymbolPages([tool('get_fundamentals', { symbol: 'AAPL' })])
        ).toEqual([{ symbol: 'AAPL', tab: 'fundamental' }]);
        expect(
            relatedSymbolPages([
                tool('get_congress_trades', { symbol: 'AAPL' }),
            ])
        ).toEqual([{ symbol: 'AAPL', tab: 'congress' }]);
    });

    it('get_analyst_views points at the fundamental tab', () => {
        expect(
            relatedSymbolPages([tool('get_analyst_views', { symbol: 'NVDA' })])
        ).toEqual([{ symbol: 'NVDA', tab: 'fundamental' }]);
    });

    it('get_company_filings points at the news tab', () => {
        expect(
            relatedSymbolPages([
                tool('get_company_filings', { symbol: 'IONQ' }),
            ])
        ).toEqual([{ symbol: 'IONQ', tab: 'news' }]);
    });

    it('get_macro_quotes has no symbol, so it links nowhere', () => {
        expect(
            relatedSymbolPages([
                tool('get_macro_quotes', { instruments: ['wti'] }),
            ])
        ).toEqual([]);
    });

    it('get_investor_flows points at the flows tab', () => {
        expect(
            relatedSymbolPages([tool('get_investor_flows', { symbol: 'AAPL' })])
        ).toEqual([{ symbol: 'AAPL', tab: 'flows' }]);
    });

    it('get_market_overview/get_economy name no symbol and are skipped', () => {
        expect(
            relatedSymbolPages([
                tool('get_market_overview', { market: 'us' }),
                tool('get_economy', {}),
            ])
        ).toEqual([]);
    });
});
