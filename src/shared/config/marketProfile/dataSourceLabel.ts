import type { MarketProfileId } from './types';

/**
 * 산문 하단 고지(`AnalysisProvenanceNote`)가 밝히는 **데이터 출처 문구**의 카탈로그 키.
 *
 * 문구는 시장 프로필이 실제로 부르는 어댑터와 같아야 한다 — 이 파일이 그 대응을
 * 한 곳에 못박고, 옆 테스트가 `MarketProfileDescriptor`(`dataProvider`·`newsSource`)와
 * 카탈로그 문구를 대조한다. 어댑터를 바꾸고 이 표를 안 고치면 테스트가 먼저 깨진다.
 *
 * 대응하는 어댑터(2026-10-04 코드 기준):
 *
 *  - us-equity: 시세·재무 FMP(`shared/api/market/getMarketDataProvider`,
 *    `shared/api/fmp/getFundamentalDataProvider`), 뉴스 FMP `news/stock`
 *    (`entities/news-article/lib/getNewsClient`)
 *  - kr-equity: 시세·재무 Yahoo Finance(`shared/api/yahoo/YahooMarketProvider`,
 *    `YahooFundamentalProvider`) — FMP 플랜에 KRX가 없다 — , 뉴스 네이버 뉴스 검색
 *    (`shared/api/naver/naverSearch`)
 *  - crypto: 시세 FMP, 뉴스 FMP `news/crypto`
 *
 * 문구는 **시세와 뉴스**만 말한다(`'analysis'`). 종목 공포·탐욕 점수는 봉만 쓰므로
 * AI 서술 없는 고지에는 시세만 말하는 `'prices'`를 쓴다 — 뉴스를 쓰지 않는 점수에
 * 뉴스 출처를 달면 거짓이 된다. 옵션체인(Yahoo)·의회 거래(FMP) 같은 부가 데이터는
 * 이 문구가 다루지 않는다(자세한 목록은 `/methodology#data`).
 */
export type DataSourceScope = 'analysis' | 'prices';

type DataSourceProfileSuffix = 'usEquity' | 'krEquity' | 'crypto';

/**
 * `views.symbol.AnalysisProvenanceNote` 네임스페이스 **기준 상대 키**다. 번역자는 그
 * 네임스페이스에서 만들어 이 키를 그대로 먹인다.
 */
export type DataSourceLabelKey =
    `${'dataSource' | 'dataSourcePrices'}.${DataSourceProfileSuffix}`;

function profileSuffix(profile: MarketProfileId): DataSourceProfileSuffix {
    switch (profile) {
        case 'us-equity':
            return 'usEquity';
        case 'kr-equity':
            return 'krEquity';
        case 'crypto':
            return 'crypto';
        default: {
            // 새 `MarketProfileId`가 생기면 컴파일이 여기서 막힌다 — 출처를 정하지
            // 않은 시장이 조용히 다른 시장의 출처를 자처하지 못하게 한다.
            const exhaustive: never = profile;
            throw new Error(`Unhandled market profile: ${String(exhaustive)}`);
        }
    }
}

export function dataSourceLabelKey(
    profile: MarketProfileId,
    scope: DataSourceScope = 'analysis'
): DataSourceLabelKey {
    const group = scope === 'prices' ? 'dataSourcePrices' : 'dataSource';
    return `${group}.${profileSuffix(profile)}`;
}
