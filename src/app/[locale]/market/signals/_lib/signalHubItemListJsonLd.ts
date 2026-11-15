import type { SignalEpisodeRow } from '@/entities/signal-history/types';
import { isPopularSymbol } from '@/entities/ticker/lib/searchRelevance';
import type { Locale } from '@/shared/i18n/locales';
import { localizedAbsoluteUrl, SITE_URL } from '@/shared/lib/seo';
import { signalHubRowLabel } from './signalHubRowLabel';

/**
 * 신호 페이지의 ItemList 구조화데이터. `rows`는 화면 순서 그대로 받는다(`orderForDisplay`) — position이
 * 화면에 그린 순서와 같아야 한다. noindex인 비인기 종목 페이지는 URL을 싣지 않는다(시장 페이지와 같은 규칙).
 */
export function buildSignalHubItemListJsonLd(
    name: string,
    rows: readonly SignalEpisodeRow[],
    locale: Locale
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        itemListElement: rows.map((row, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: `${signalHubRowLabel(row, locale)} (${row.symbol})`,
            ...(isPopularSymbol(row.symbol) && {
                url: localizedAbsoluteUrl(`${SITE_URL}/${row.symbol}`, locale),
            }),
        })),
    };
}
