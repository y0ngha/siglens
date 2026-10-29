import { SITE_NAME } from '@/shared/config/brand';
import type { Locale } from '@/shared/i18n/locales';
import { brandName, brandTitle } from '@/shared/lib/brandName';
import { TERMS_PATH } from '@/shared/lib/legal';
import {
    backtestingDescription,
    backtestingTitle,
    BACKTESTING_URL,
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    localizedAbsoluteUrl,
    SITE_URL,
    type SeoTranslator,
} from '@/shared/lib/seo';
import { BACKTEST_STATS } from './backtestingData';

/** `/backtesting` 페이지가 `<JsonLd>`로 각각 내보내는 세 노드. */
export interface BacktestingJsonLd {
    readonly webPageJsonLd: Record<string, unknown>;
    readonly breadcrumbJsonLd: Record<string, unknown>;
    readonly datasetJsonLd: Record<string, unknown>;
}

/**
 * `/backtesting`의 JSON-LD 세 노드(WebPage·BreadcrumbList·Dataset).
 *
 * `name`/`description`은 `backtestingTitle`/`backtestingDescription`을 재사용해
 * title/description과 같은 로케일로 정렬된다. `variableMeasured`/`keywords`는 그 문구와
 * 무관한 별도 문구다.
 *
 * **번역자를 둘 받는다.** `datasetName`은 `app.backtesting.seo` 아래에 있어 `shared.seo`
 * 번역자로 부르면 next-intl이 던지지 않고 **키 경로 문자열을 그대로 돌려주므로**
 * Dataset JSON-LD의 `name`에 키 경로가 박힌 채 크롤러에 나간다(실측: e2e webServer
 * 로그의 `MISSING_MESSAGE`). 타입도 게이트도 통과하고 런타임에만 드러난다.
 *
 * @param t      `shared.seo` 번역자 — `backtestingTitle`/`backtestingDescription`이 쓴다.
 * @param tPage  `app.backtesting.seo` 번역자 — Dataset 전용 문구가 쓴다.
 * @param breadcrumbLabel  화면 브레드크럼과 `BreadcrumbList`가 함께 쓰는 짧은 이름.
 */
export function buildBacktestingJsonLd(
    t: SeoTranslator,
    tPage: SeoTranslator,
    breadcrumbLabel: string,
    locale: Locale
): BacktestingJsonLd {
    const description = backtestingDescription(t);
    const fullTitle = brandTitle(backtestingTitle(t), locale);
    return {
        // 손으로 다시 짜지 않는다 — `@id`·`url`의 로케일 접두사와 `inLanguage`를 빌더가 한 번에 맞춘다.
        webPageJsonLd: buildWebPageJsonLd({
            url: BACKTESTING_URL,
            name: fullTitle,
            description,
            locale,
        }),
        breadcrumbJsonLd: buildBreadcrumbJsonLd(
            [{ name: breadcrumbLabel, url: BACKTESTING_URL }],
            locale
        ),
        datasetJsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: tPage('datasetName', { v0: brandName(locale) }),
            description,
            // 로케일별 URL — 같은 Dataset을 네 URL이 각자 자기 주소로 선언해야
            // 크롤러가 언어 클러스터를 하나로 접지 않는다.
            url: localizedAbsoluteUrl(BACKTESTING_URL, locale),
            identifier: 'siglens-backtesting-2024-2026',
            creator: {
                '@type': 'Organization',
                name: SITE_NAME,
                url: SITE_URL,
            },
            license: `${SITE_URL}${TERMS_PATH}`,
            // 화면 통계(`BacktestHero`)와 같은 파생값을 쓴다 — 두 표면이 같은 기간을 말한다.
            // 손으로 적은 범위는 실제 진입일 범위(2024-11~2026-03, 2026-09-17 확인)보다 넓었다.
            temporalCoverage: `${BACKTEST_STATS.periodStart}/${BACKTEST_STATS.periodEnd}`,
            /*
             * Dataset은 신선도를 `dateModified`로 읽는다. 정적 데이터셋이라 값은
             * "언제 배포했는지"가 아니라 **데이터의 마지막 진입일**이다.
             *
             * `periodEnd` 문자열을 그대로 쓴다 — `Date`로 바꾸면 연-월(`2026-03`)이
             * 3월 1일로 파싱돼 우리가 모르는 날짜를 주장하게 된다. schema.org의
             * Date는 `YYYY-MM`도 허용하므로 통계가 말하는 정밀도 그대로 내보낸다.
             * 값이 없으면(`''`) 필드를 싣지 않는다.
             */
            ...(BACKTEST_STATS.periodEnd !== '' && {
                dateModified: BACKTEST_STATS.periodEnd,
            }),
            spatialCoverage: 'US',
            variableMeasured: tPage('variableMeasured'),
            keywords: [
                'AI stock analysis backtesting',
                'US stock technical analysis backtest',
                'RSI MACD signal backtest results',
                'Magnificent 7 backtest',
                'AAPL NVDA TSLA backtest',
                '주식 기술적 분석 백테스팅',
                'AI 주식 분석 백테스트',
            ],
            distribution: [
                {
                    '@type': 'DataDownload',
                    encodingFormat: 'application/json',
                    contentUrl: `${SITE_URL}/backtesting/data.json`,
                },
            ],
        },
    };
}
