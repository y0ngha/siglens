import type { Metadata } from 'next';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { brandName } from '@/shared/lib/brandName';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import {
    buildSymbolTabSeoContent,
    NOINDEX_SYMBOL_METADATA,
    SITE_URL,
    type BuildSymbolSeoOptions,
    type SeoTranslator,
    type SymbolSeoContent,
    type SymbolSeoTab,
} from '@/shared/lib/seo';
import { localeAlternates, localeOpenGraph } from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';

/*
 * 종목 탭 페이지의 `Metadata` 조립. `seo.ts`에 있었는데, 이 함수 하나 때문에 `seo.ts`가
 * `seoAlternates`를 import하고 `seoAlternates`는 `SITE_URL` 때문에 `seo.ts`를 import해서
 * 런타임 순환이 됐다(`src/__tests__/guards/importCycles.test.ts`). 두 모듈을 모두 쓰는
 * 조립 함수(`symbolMetadataFromSeo`·`noindexSymbolMetadata`)를 위에 따로 둬서 의존이 한 방향으로만 흐르게 한다.
 */

/**
 * 8개 심볼 페이지 `generateMetadata`가 반환하는 Metadata 객체를 생성한다.
 * SymbolSeoContent의 `title/fullTitle/description/url/keywords` 5개 필드를
 * Next.js Metadata 형태로 매핑한다. 동일한 구조가 8 곳에 중복됐던 것을 제거.
 *
 * `title`은 `{ absolute: title }`로 반환해 루트 레이아웃의 `title.template`
 * (ko `%s | 시그렌즈` · 그 외 `%s | SIGLENS` 자동 접미사)을 무시한다 — 접미사 폭(앞 공백 포함
 * ko 11 · 그 외 10 폭단위)을 2,247개 URL 전부에서 검색 의도 카피에 되돌려준다. 브랜드 검색어("siglens")는
 * 이미 자연 순위 2.0위라 title 폭을 추가로 쓸 이유가 없다. `/backtesting`이
 * 같은 `absolute` 메커니즘을 쓰지만 그쪽은 반대로 `fullTitle`(브랜드 포함)을
 * 넣는다 — 단일 페이지라 폭 제약이 이만큼 타이트하지 않고 브랜드 노출도 원해서다.
 * `openGraph.title`·`twitter.title`은 그대로 `fullTitle`을 쓴다 — 소셜 카드는
 * SERP 폭 제약이 없고 브랜드 노출이 도움이 된다.
 *
 * options/page.tsx의 `robots` 스프레드는 호출측이 직접 추가해야 한다:
 * `return { ...symbolMetadataFromSeo(seo), ...(hasOptions ? {} : { robots }) };`
 */
export function symbolMetadataFromSeo(
    seo: SymbolSeoContent,
    locale: Locale
): Metadata {
    const { title, fullTitle, description, url, keywords } = seo;
    // `seo.url`은 기본 로케일 절대 URL이다. 경로만 떼어 로케일별 URL을 다시 만든다.
    const path = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
    const localizedUrl = `${SITE_URL}${localePath(locale, path || '/')}`;
    return {
        title: { absolute: title },
        description,
        keywords,
        // hreflang은 **분석 본문이 준비된 로케일만** 광고한다. 준비되지 않은
        // 로케일을 광고하면 한국어 본문이 담긴 영어 URL을 크롤러에게 권하는 셈이다.
        // 준비된 로케일이 하나뿐이면 `buildLanguageAlternates`가 빈 객체를 돌려주고
        // `languages` 키 자체가 나가지 않는다.
        alternates: localeAlternates(locale, path, {
            canonical: localizedUrl,
            available: SYMBOL_INDEXABLE_LOCALES,
        }),
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title: fullTitle,
            description,
            url: localizedUrl,
            ...localeOpenGraph(locale),
        },
        /**
         * `images`를 **싣지 않는다** — Next는 `twitter.images`가 없으면 최종 `openGraph.images`
         * (= 탭의 `opengraph-image.tsx`)로 `twitter:image`를 채운다(`resolve-metadata`의
         * `postProcessMetadata`). 예전에는 탭마다 `twitter-image.tsx`가 og 이미지를 re-export해
         * 같은 이미지가 다른 URL로 두 번 렌더·저장됐다(2026-10 감사). 여기에 `images`를 넣으면
         * 그 자동 채움이 꺼진다.
         */
        twitter: buildTwitterMetadata({ title: fullTitle, description }),
        /**
         * 준비되지 않은 로케일은 **제목·설명은 그대로 두고 robots만** 덮는다.
         *
         * 이전에는 `getBlockedSymbolMetadata`가 통째로 `NOINDEX_SYMBOL_METADATA`를
         * 돌려줬는데, 그 상수엔 title이 없다. 그래서 `/en/AAPL`의 `<title>`이
         * 루트 레이아웃의 **한국어 사이트 기본 제목**으로 떨어졌다 — 브라우저 탭·
         * 북마크·`og:title`이 전부 그렇게 나갔고, `og:image`만 종목별이라 공유하면
         * AAPL 차트에 한국어 일반 문구가 붙었다.
         *
         * `follow: true`인 이유는 정적 페이지 게이트(`localeRobots`)와 같다 —
         * 색인은 막되 링크는 따라가게 둔다. 같은 게이트가 두 표면에서 다른
         * `follow` 값을 내면 그것 자체가 크롤 예산 결함이다.
         */
        ...(SYMBOL_INDEXABLE_LOCALES.includes(locale)
            ? {}
            : { robots: { index: false, follow: true } }),
    };
}

export interface NoindexSymbolMetadataOptions extends Omit<
    BuildSymbolSeoOptions,
    'locale'
> {
    /**
     * The tab this route renders. Without it every blocked tab of one symbol
     * repeats the chart page's title and description, which Naver Search
     * Advisor reports as duplicate `<title>`/`<meta name="description">`
     * documents (2026-09-17: `/QQQ/financials` carried the `/QQQ` title).
     * Omitted means the chart tab (`technical`).
     */
    tab?: SymbolSeoTab;
    /**
     * 자산군. 크립토면 `시세`/`Price` 카피 빌더를 쓴다 — 생략하면 equity다. 호출부가
     * `assetInfo`를 들고 있으면 `getDescriptor(marketProfileOf(assetInfo)).assetClass`를 넘긴다.
     */
    assetClass?: AssetClass;
}

/**
 * noindex인 `[symbol]` 라우트의 메타데이터 — **심볼을 알 때** 쓴다.
 *
 * **왜 필요한가 (2026-08-24 프로덕션 실측)**: `title`/`description`/`openGraph`를
 * 비워 두면 Next가 루트 레이아웃 값을 그대로 상속시킨다. 그 결과 차단된 심볼
 * URL 전부(`/SOXX`, `/QQQM`, `/TLT`, `/XLK`, `/SOXX/fundamental` …)가
 *   - 홈페이지와 **똑같은** `<title>`·`<meta name="description">`을 쓰고,
 *   - `og:url`을 `https://siglens.io`로 선언한다.
 * 두 번째가 특히 나쁘다 — og:url을 정규 URL 힌트로 쓰는 크롤러에게 수만 개
 * 심볼 URL이 자기를 홈페이지라고 말하는 셈이다. noindex는 색인을 막을 뿐
 * 이 잘못된 동일성 선언까지 막아 주지는 않는다.
 *
 * **`[symbol]/**\/page.tsx`의 200 + noindex 분기는 전부 이걸 쓴다**(FMP profile degrade,
 * 빈 재무 스냅샷, congress trades degrade, overall 캐시 미스 …). 전부 심볼이 확정된 뒤라
 * 자기 정체성을 가질 수 있고, **실존 티커가 200을 반환하는 경로**라 홈 메타 상속이 실제로
 * 크롤된다. 404로 끝나는 경로(형식 불합격 `!isAdmissibleSymbolShape`, tab-not-allowed,
 * assetInfo 없음·장애 중 형상 불합격)는 여기로 오지 않는다 — `generateMetadata`가
 * `notFound()`를 던져 404 경계의 메타를 쓴다. 레이아웃이 먼저 `notFound()`를 던져도 페이지의
 * `generateMetadata` 결과가 이기므로, 그 경로에서 메타를 돌려주면 404 응답에 정상 페이지
 * title·canonical이 얹힌다.
 *
 * `opts.tab`이 있으면 그 탭의 카피·URL을 쓴다 — 없으면 차트 탭(`technical`)이다.
 *
 * `opts`는 호출부가 이미 `assetInfo`를 들고 있을 때만 넘긴다 — 안 넘겨도
 * displayName이 티커로 폴백해 동작은 같고, 있으면 description이 사명까지 담는다.
 *
 * URL 로케일은 세 번째 인자 하나로만 받아 빌더에도 그대로 넘긴다(`opts`에는 `locale`이 없다).
 * 예전에는 빌더에 로케일을 넘기지 않아 `composeSymbolTitle`이 기본 로케일로 동작했고,
 * `/en/AAPL`의 차단 메타 title이 `애플(AAPL) Stock Analysis`처럼 한국어명을 달고 나갔다.
 */
export function noindexSymbolMetadata(
    symbol: string,
    t: SeoTranslator,
    locale: Locale,
    opts: NoindexSymbolMetadataOptions = {}
): Metadata {
    const { tab = 'technical', assetClass = 'equity', ...buildOpts } = opts;
    const base = symbolMetadataFromSeo(
        buildSymbolTabSeoContent(tab, symbol, assetClass, t, {
            ...buildOpts,
            locale,
        }),
        locale
    );
    return {
        ...base,
        // self-canonical은 유지하고 hreflang 군집(`languages`)만 뺀다 — noindex 페이지가
        // 다른 로케일 URL과 상호 참조(return tag)를 주장할 이유가 없다.
        alternates: { canonical: base.alternates?.canonical ?? null },
        // robots(noindex)가 symbolMetadataFromSeo의 index 기본값을 덮는다.
        ...NOINDEX_SYMBOL_METADATA,
    };
}
