import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/shared/i18n/locales';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    type SeoTranslator,
} from '@/shared/lib/seo';
import type { SymbolSubTabKey } from '@/views/symbol/utils/symbolTabsConfig';

interface SymbolTabBreadcrumbInput {
    /** 대문자 티커 — 둘째 마디(종목 차트 페이지) URL을 만든다. */
    readonly ticker: string;
    /** 둘째 마디 이름. 페이지 h1·헤더 브레드크럼과 같은 표시명이다. */
    readonly displayName: string;
    /** 셋째 마디 탭 — 이름은 `shared.symbolTab.<tab>`에서 온다. */
    readonly tab: SymbolSubTabKey;
    /** 셋째 마디 URL(이 탭의 canonical 경로). */
    readonly tabUrl: string;
    readonly tSeo: SeoTranslator;
    readonly locale: Locale;
}

/**
 * 형제 탭(차트 외 8개)의 `BreadcrumbList` JSON-LD — 사이트 → 종목 → 탭 3단계.
 *
 * 셋째 마디 이름은 헤더 가시 브레드크럼(`SymbolLayoutHeader`)과 같은 `shared.symbolTab` 키에서
 * 온다. 구글은 마크업과 화면 텍스트가 다르면 breadcrumb 마크업을 무시하므로, 탭마다 손으로
 * 쓰지 않고 이 한 곳에서 같은 키를 읽는다. 첫 마디(사이트)는 `buildBreadcrumbJsonLd`가 붙인다.
 */
export async function buildSymbolTabBreadcrumbJsonLd({
    ticker,
    displayName,
    tab,
    tabUrl,
    tSeo,
    locale,
}: SymbolTabBreadcrumbInput): Promise<Record<string, unknown>> {
    const tTab = await getTranslations({
        locale,
        namespace: 'shared.symbolTab',
    });
    return buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(ticker, tSeo).url },
            { name: tTab(tab), url: tabUrl },
        ],
        locale
    );
}
