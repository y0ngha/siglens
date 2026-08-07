export type {
    RemovalSitemapCandidateSource,
    RemovalSitemapEntry,
    RemovalSitemapKind,
    SitemapChangeFrequency,
    SitemapEntry,
    SitemapIndexEntry,
} from './model';
export {
    isRemovalSitemapKind,
    REMOVAL_CHART_CUTOFF_ISO,
    REMOVAL_CRYPTO_LIMIT,
    REMOVAL_LAST_MODIFIED_ISO,
    REMOVAL_LEGACY_TAB_CUTOFF_ISO,
    REMOVAL_SITEMAP_KINDS,
    SITEMAP_MAX_URLS_PER_FILE,
} from './model';

export { escapeXml, toUrlSetXml, toSitemapIndexXml } from './lib/xml';
export { buildRemovalEntries } from './lib/buildRemovalEntries';
export { toRemovalUrlSetXml } from './lib/removalXml';
export { buildPopularEntries } from './lib/buildPopularEntries';
export { buildCryptoPopularEntries } from './lib/buildCryptoPopularEntries';
export { buildStaticEntries } from './lib/buildStaticEntries';
