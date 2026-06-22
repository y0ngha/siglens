// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 HTTP 402(플랜 미지원)이라
// 단건 quote를 심볼별로 호출하여 시가총액 기준 상위 N개를 자동 선정한다(update-popular-cryptos.ts).
// 수동으로 순서를 바꾸거나 심볼을 추가/제거할 수 있습니다.
export const POPULAR_CRYPTOS = [
    'BTCUSD',
    'ETHUSD',
    'BNBUSD',
    'XRPUSD',
    'SOLUSD',
    'TRXUSD',
    'DOGEUSD',
    'XLMUSD',
    'ADAUSD',
    'LINKUSD',
    'TONUSD',
    'BCHUSD',
    'LTCUSD',
    'SHIBUSD',
    'SUIUSD',
] as const;
