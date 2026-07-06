// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 HTTP 402(플랜 미지원)이라
// 단건 quote를 심볼별로 호출하여 시가총액 상위 N개를 선정한다(update-popular-cryptos.ts).
// 갱신은 누적 방식이다: 매 실행마다 시총 상위 N개 중 기존 목록에 없는 심볼만
// "// --- Trending (YYYY-MM-DD) ---" 섹션으로 배열 끝에 추가하며, 기존 심볼은 삭제하지 않는다.
// 심볼 후보를 늘리려면 scripts/update-popular-cryptos.ts의 CRYPTO_CANDIDATE_POOL을 수정하라.
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
