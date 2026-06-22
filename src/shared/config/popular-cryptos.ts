// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 플랜 제한이라
// 시가총액 자동 랭킹이 불가하므로 수동 관리한다(주식 popular-tickers와 동일 방침).
export const POPULAR_CRYPTOS = [
    'BTCUSD',
    'ETHUSD',
    'SOLUSD',
    'XRPUSD',
    'BNBUSD',
    'DOGEUSD',
    'ADAUSD',
    'AVAXUSD',
    'LINKUSD',
    'TRXUSD',
    'DOTUSD',
    'MATICUSD',
    'LTCUSD',
    'BCHUSD',
    'SHIBUSD',
] as const;
