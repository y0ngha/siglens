import type { MarketProfileDescriptor } from './types';

/**
 * US listing exchanges that survive search filtering.
 *
 * Mirrors `US_EXCHANGES` in `src/entities/ticker/lib/fmpTickerApi.ts`.
 * If you add or remove an exchange here, apply the same change there (and
 * vice-versa) to keep ticker search and market-profile routing in sync.
 * See MISTAKES.md §16.5 for the duplication rationale.
 */
const US_EXCHANGES: ReadonlySet<string> = new Set([
    'NYSE',
    'NASDAQ',
    'AMEX',
    'CBOE',
    'OTC',
    'PNK',
]);

export const US_EQUITY_DESCRIPTOR: MarketProfileDescriptor = {
    id: 'us-equity',
    assetClass: 'equity',
    region: 'us',
    priceFormat: {
        currency: 'USD',
        locale: 'en-US',
        precision: { kind: 'fixed', digits: 2 },
    },
    sessionModel: 'us-equity-et',
    dataProvider: 'fmp',
    toProviderSymbol: canonical => canonical,
    newsSource: 'stock',
    exchangeWhitelist: US_EXCHANGES,
    searchSource: 'fmp-us',
    tabs: [
        'chart',
        'news',
        'fundamental',
        'financials',
        'congress',
        'options',
        'fear-greed',
        'overall',
        'position',
    ],
    defaultTimeframe: '1Day',
    allowedTimeframes: ['5Min', '15Min', '30Min', '1Hour', '4Hour', '1Day'],
    seo: {
        aboutNodeType: 'Corporation',
    },
    sitemapLastmod: 'us-close',
};
