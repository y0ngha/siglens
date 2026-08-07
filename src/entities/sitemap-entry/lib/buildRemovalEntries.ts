import { SITE_URL } from '@/shared/lib/seo';

import {
    REMOVAL_LAST_MODIFIED_ISO,
    type RemovalSitemapEntry,
    type RemovalSitemapKind,
} from '../model';

const REMOVAL_SUFFIX_BY_KIND: Record<RemovalSitemapKind, string> = {
    chart: '',
    news: '/news',
    overall: '/overall',
    fundamental: '/fundamental',
    'fear-greed': '/fear-greed',
};

export function buildRemovalEntries(
    kind: RemovalSitemapKind,
    symbols: readonly string[]
): RemovalSitemapEntry[] {
    const suffix = REMOVAL_SUFFIX_BY_KIND[kind];
    const normalizedSymbols = [
        ...new Set(symbols.map(symbol => symbol.toUpperCase())),
    ].toSorted();

    return normalizedSymbols.map(symbol => ({
        url: `${SITE_URL}/${symbol}${suffix}`,
        lastModified: new Date(REMOVAL_LAST_MODIFIED_ISO),
    }));
}
