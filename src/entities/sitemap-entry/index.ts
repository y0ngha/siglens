export type {
    SitemapChangeFrequency,
    SitemapEntry,
    SitemapIndexEntry,
} from './model';
export { SITEMAP_MAX_URLS_PER_FILE } from './model';

export { toUrlSetXml, toSitemapIndexXml } from './lib/xml';
export { buildPopularEntries } from './lib/buildPopularEntries';
export { buildCryptoPopularEntries } from './lib/buildCryptoPopularEntries';
export { buildStaticEntries } from './lib/buildStaticEntries';
