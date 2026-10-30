import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { SITE_URL } from '@/shared/lib/seo';

import type { SitemapEntry } from '../model';
import { sitemapAlternates } from './sitemapAlternates';

/**
 * 종목 sitemap 엔트리(주식·크립토 빌더 공용)에 다국어 대체본을 붙인다.
 *
 * 엔트리마다 손으로 `alternates`를 적지 않는 이유는 분기(산문 게이트 등)마다
 * 리터럴이 흩어지면 한 곳만 빠뜨려도 그 탭만 조용히 hreflang을 잃기 때문이다.
 * 마지막에 일괄로 붙인다.
 *
 * `SYMBOL_INDEXABLE_LOCALES`가 기본 로케일 하나인 동안에는 `sitemapAlternates`가
 * `undefined`를 돌려 XML이 지금과 바이트 단위로 동일하다.
 */
export function withSymbolAlternates(
    entries: readonly SitemapEntry[]
): SitemapEntry[] {
    return entries.map(entry => {
        const alternates = sitemapAlternates(
            entry.url.slice(SITE_URL.length),
            SYMBOL_INDEXABLE_LOCALES
        );
        return alternates ? { ...entry, alternates } : entry;
    });
}
