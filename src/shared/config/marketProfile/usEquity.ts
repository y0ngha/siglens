import type { MarketProfileDescriptor } from './types';

/** US listing exchanges that survive search filtering (mirror of fmpTickerApi US_EXCHANGES). */
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
    ],
    defaultTimeframe: '1Day',
    allowedTimeframes: ['5Min', '15Min', '30Min', '1Hour', '4Hour', '1Day'],
    seo: {
        aboutNodeType: 'Corporation',
    },
    sitemapLastmod: 'us-close',
};
