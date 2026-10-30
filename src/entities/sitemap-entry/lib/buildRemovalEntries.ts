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

/**
 * 후보 심볼을 제거 sitemap 엔트리로 만든다. 심볼은 대문자로 정규화·중복 제거·정렬해
 * 출력이 입력 순서와 무관하게 결정적이다. kind별 URL 접미사는 차트가 심볼 루트, 나머지는 탭 경로다.
 */
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
