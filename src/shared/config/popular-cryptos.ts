// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 HTTP 402(플랜 미지원)이라
// 단건 quote를 심볼별로 호출하여 시가총액 기준 상위 N개를 자동 선정한다(update-popular-cryptos.ts).
// 주의: 이 파일은 스크립트가 자동 생성하므로 수동 변경은 다음 실행 때 덮어씌워진다.
// 심볼을 추가/변경하려면 scripts/update-popular-cryptos.ts의 CRYPTO_CANDIDATE_POOL을 수정하라.
export const POPULAR_CRYPTOS = [
    'BTCUSD',
    'ETHUSD',
    'BNBUSD',
    'XRPUSD',
    'SOLUSD',
    'TRXUSD',
    'DOGEUSD',
    'ADAUSD',
    'XLMUSD',
    'LINKUSD',
    'BCHUSD',
    'TONUSD',
    'LTCUSD',
    'AVAXUSD',
    'SUIUSD',
] as const;
