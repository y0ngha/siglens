import {
    hasPublishableHistory,
    scoredReadings,
} from '@/entities/market-fear-greed/lib/publishableHistory';
import type {
    MarketFearGreedHubView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { SITE_NAME } from '@/shared/config/brand';
import {
    FEAR_GREED_DATA_FORMATS,
    FEAR_GREED_DATA_MEDIA_TYPE,
    fearGreedDataPath,
} from '@/shared/config/fearGreedData';
import type { Locale } from '@/shared/i18n/locales';
import { METHODOLOGY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import {
    localizedAbsoluteUrl,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
} from '@/shared/lib/seo';

interface MarketFearGreedDatasetInput {
    readonly view: MarketFearGreedHubView<MarketFearGreedViewSnapshot>;
    /** 내려받기 파일 URL을 정하는 시장. */
    readonly market: FearGreedMarketId;
    /** 화면 브레드크럼과 같은 지수 이름(`copy.heading`). */
    readonly name: string;
    readonly description: string;
    /** 기본 로케일 절대 URL(`${SITE_URL}${copy.path}`). 로케일 주소는 여기서 만든다. */
    readonly url: string;
    readonly locale: Locale;
}

/**
 * 시장 공포·탐욕 지수 자체를 `Dataset`으로 선언한다. 판독값이 없으면 `null`.
 *
 * 이 사이트가 직접 계산하는 1차 데이터라 AI 검색·데이터셋 검색이 출처로 집을 수 있는
 * 표면이다. 기록이 공개 하한을 넘으면(`hasPublishableHistory`) 내려받기 파일 두 개를
 * `distribution`으로 싣고 기간은 점수가 있는 첫 날부터 최신 판독일까지로 말한다. 파일은
 * 로케일이 없으므로 `contentUrl`은 모든 로케일에서 같은 절대 URL이다. 하한을 못 넘으면
 * `distribution`을 빼고 기간은 화면의 비교 시점 중 가장 이른 세션부터 최신 판독일까지 — 화면이
 * 실제로 보여 주는 범위만 말한다.
 *
 * - `url`은 로케일별 주소다 — 같은 Dataset을 네 URL이 각자 자기 주소로 선언해야 크롤러가 언어
 *   클러스터를 하나로 접지 않는다(`backtestingJsonLd.ts`와 같은 이유).
 * - `creator`는 이름·종류를 인라인으로 싣는다 — 리치 결과 검사기는 다른 페이지에 정의된 `@id`를
 *   따라가지 않는다.
 */
export function buildMarketFearGreedDatasetJsonLd({
    view,
    market,
    name,
    description,
    url,
    locale,
}: MarketFearGreedDatasetInput): Record<string, unknown> | null {
    const { snapshot } = view;
    if (snapshot === null) return null;
    const publishable = hasPublishableHistory(view);
    const earliestDate = publishable
        ? scoredReadings(view.history)[0].date
        : (view.comparisons
              .map(point => point.date)
              .toSorted()
              .at(0) ?? snapshot.asOf);
    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name,
        description,
        url: localizedAbsoluteUrl(url, locale),
        creator: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
            name: SITE_NAME,
            url: SITE_URL,
        },
        isAccessibleForFree: true,
        license: `${SITE_URL}${TERMS_PATH}`,
        measurementTechnique: `${SITE_URL}${METHODOLOGY_PATH}`,
        dateModified: snapshot.asOf,
        temporalCoverage: `${earliestDate}/${snapshot.asOf}`,
        ...(publishable
            ? {
                  distribution: FEAR_GREED_DATA_FORMATS.map(format => ({
                      '@type': 'DataDownload',
                      encodingFormat: FEAR_GREED_DATA_MEDIA_TYPE[format],
                      contentUrl: `${SITE_URL}${fearGreedDataPath(market, format)}`,
                  })),
              }
            : {}),
        variableMeasured: {
            '@type': 'PropertyValue',
            name,
            minValue: 0,
            maxValue: 100,
            // 화면·제목과 같은 정수(판독값은 반올림 전 실수다).
            value: Math.round(snapshot.score),
        },
    };
}
