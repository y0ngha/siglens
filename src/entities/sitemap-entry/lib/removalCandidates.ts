import { APPROVED_LONGTAIL_TICKERS } from '@/entities/symbol-indexability/config/approved-longtail-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';

import {
    REMOVAL_CHART_CUTOFF_ISO,
    REMOVAL_LEGACY_TAB_CUTOFF_ISO,
    type RemovalSitemapKind,
} from '../model';

const protectedSymbolSet: ReadonlySet<string> = new Set(
    [...POPULAR_TICKERS, ...POPULAR_CRYPTOS, ...APPROVED_LONGTAIL_TICKERS].map(
        symbol => symbol.toUpperCase()
    )
);

/**
 * 제거 sitemap에서 절대 빼면 안 되는(색인 대상인) 심볼 — 대문자, 정렬됨.
 * DB 쿼리의 `NOT IN` 제외 목록으로 쓴다. 쿼리는 대소문자를 구분하므로
 * {@link excludeProtectedSymbols}가 대소문자 무시로 한 번 더 거른다.
 */
export const PROTECTED_SITEMAP_SYMBOLS: readonly string[] = [
    ...protectedSymbolSet,
].toSorted();

const REMOVAL_CUTOFF_ISO_BY_KIND: Readonly<Record<RemovalSitemapKind, string>> =
    {
        chart: REMOVAL_CHART_CUTOFF_ISO,
        news: REMOVAL_LEGACY_TAB_CUTOFF_ISO,
        overall: REMOVAL_LEGACY_TAB_CUTOFF_ISO,
        fundamental: REMOVAL_LEGACY_TAB_CUTOFF_ISO,
        'fear-greed': REMOVAL_LEGACY_TAB_CUTOFF_ISO,
    };

/**
 * kind별 후보 컷오프(ISO). 차트 URL만 신규 컷오프를 쓰고 나머지 탭은 레거시 컷오프를 쓴다.
 * kind를 추가하면 Record 매핑에서 컴파일 에러로 누락을 잡는다.
 * 캐시 키에도 들어가므로 컷오프가 바뀌면 캐시 항목이 새로 만들어진다.
 */
export function removalCutoffIsoFor(kind: RemovalSitemapKind): string {
    return REMOVAL_CUTOFF_ISO_BY_KIND[kind];
}

/** 색인 대상 심볼을 대소문자 무시로 제외한 후보 목록. */
export function excludeProtectedSymbols(symbols: readonly string[]): string[] {
    return symbols.filter(
        symbol => !protectedSymbolSet.has(symbol.toUpperCase())
    );
}
