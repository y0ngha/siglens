import type { MarketProfileDescriptor } from './types';

export const CRYPTO_DESCRIPTOR: MarketProfileDescriptor = {
    id: 'crypto',
    assetClass: 'crypto',
    region: 'global',
    priceFormat: {
        currency: 'USD',
        locale: 'en-US',
        precision: { kind: 'dynamic-by-magnitude' },
    },
    sessionModel: 'always-open',
    dataProvider: 'fmp',
    toProviderSymbol: canonical => canonical, // FMP crypto symbols are already canonical (BTCUSD) — no mapping needed
    newsSource: 'crypto',
    exchangeWhitelist: null, // FMP crypto exchange is "CRYPTO"/"CCC"; classify via DB
    searchSource: 'crypto-store',
    // 15Min/30Min/4Hour are NOT supported by FMP crypto intraday endpoints.
    tabs: ['chart', 'news', 'fear-greed', 'overall'],
    defaultTimeframe: '1Day',
    allowedTimeframes: ['5Min', '1Hour', '1Day'],
    seo: {
        aboutNodeType: null, // no standard schema.org crypto type → omit about node
    },
    sitemapLastmod: 'rolling',
};
