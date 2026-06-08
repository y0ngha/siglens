export type {
    LongTailTickerSource,
    SitemapChangeFrequency,
    SitemapEntry,
    SitemapIndexEntry,
} from './model';
export {
    SITEMAP_MAX_URLS_PER_FILE,
    LONGTAIL_ENTRIES_PER_TICKER,
    LONGTAIL_TICKERS_PER_PAGE,
} from './model';

export { toUrlSetXml, toSitemapIndexXml } from './lib/xml';
export { buildPopularEntries } from './lib/buildPopularEntries';
export { buildStaticEntries } from './lib/buildStaticEntries';
export { buildLongTailEntries } from './lib/buildLongTailEntries';
