import type { MarketProfileDescriptor } from './types';

/**
 * KOSPI/KOSDAQ 상장 종목 프로필.
 *
 * canonical 심볼이 거래소 접미사를 내장한다(`005930.KS` / `247540.KQ`,
 * `shared/config/ticker.ts`의 `KR_SYMBOL_RE`). 덕분에 크립토와 달리 DB 멤버십
 * 조회 없이 정규식만으로 프로필 판정이 끝난다.
 *
 * 데이터 소스는 yahoo-finance2다(FMP 플랜에 KRX가 포함되지 않는다). 옵션체인이
 * 이미 프로덕션에서 같은 패키지에 의존하고 있어 신규 리스크가 아니다.
 */
export const KR_EQUITY_DESCRIPTOR: MarketProfileDescriptor = {
    id: 'kr-equity',
    assetClass: 'equity',
    region: 'kr',
    priceFormat: {
        currency: 'KRW',
        locale: 'ko-KR',
        // 원화 호가는 소수점이 없다 — 274500원은 정수로 표기한다.
        precision: { kind: 'integer' },
    },
    sessionModel: 'kr-equity-kst',
    // yahoo KRX 시세는 20분 지연이다(2026-08-16 실측 exchangeDataDelayedBy=20).
    // 실시간이 필요하면 증권사 API(KIS 등) 실계좌 연동이 유일한 경로다.
    quoteDelayMinutes: 20,
    dataProvider: 'yahoo',
    // yahoo는 canonical 심볼을 그대로 받는다(`005930.KS`). FMP처럼 표기 변환이 없다.
    toProviderSymbol: canonical => canonical,
    newsSource: 'naver',
    // 거래소는 심볼 접미사(.KS/.KQ)가 이미 결정하므로 별도 필터가 불필요하다.
    exchangeWhitelist: null,
    searchSource: 'kr-store',
    // options: 국내 개별주식옵션은 유동성이 사실상 없다(상장된 것은 KOSPI200 지수옵션).
    // congress: 공직자 주식 백지신탁은 관보 PDF로만 공개되어 API가 존재하지 않는다.
    tabs: [
        'chart',
        'news',
        'fundamental',
        'financials',
        'fear-greed',
        'overall',
        'position',
    ],
    defaultTimeframe: '1Day',
    // '4Hour'는 yahoo chart interval enum에 없다(1m/2m/5m/15m/30m/60m/90m/1h/1d/...).
    // 2026-08-16 005930.KS 실측: 5m/15m/30m/1h 정상, 4h는 InvalidOptionsError.
    allowedTimeframes: ['5Min', '15Min', '30Min', '1Hour', '1Day'],
    seo: {
        aboutNodeType: 'Corporation',
    },
    sitemapLastmod: 'kr-close',
};
