// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 HTTP 402(플랜 미지원)이라
// 단건 quote를 심볼별로 호출하여 시가총액 상위 N개를 선정한다(update-popular-cryptos.ts).
// 목록 대부분은 스크립트의 누적 갱신 결과다: 매 실행마다 시총 상위 N개 중 기존 목록에
// 없는 심볼만 "// --- Trending (YYYY-MM-DD) ---" 섹션으로 배열 끝에 추가하며, 기존 심볼은
// 삭제하지 않는다. 다만 "Restored from history"·"Curated high-interest" 섹션은 스크립트
// 실행 결과가 아니라 수동으로 복원·추가한 것이므로, 자동 갱신 로직을 건드릴 때 삭제하지 않도록 주의한다.
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

    // --- Restored from history (2026-07-06) ---
    // 과거 전체-교체 방식에서 시총 순위 밖으로 밀려 사라졌던 심볼을 git 히스토리에서 복원.
    // (폐지/리브랜딩된 MATICUSD는 후계 POLUSD로 대체되므로 제외.)
    'DOTUSD',
    'POLUSD',
    'SHIBUSD',

    // --- Curated high-interest (2026-07-06) ---
    // 시총 상위 밖이지만 대중 관심도·거래 활성도가 높은 대표 코인 (CRYPTO_CANDIDATE_POOL 내 유효 심볼).
    // DeFi 대표(UNI/AAVE), L2 양대(ARB/OP), 관심도 높은 L1(NEAR/APT/ATOM/TIA/INJ),
    // 스토리지 대표(FIL), 밈 대표(PEPE).
    'UNIUSD',
    'AAVEUSD',
    'ARBUSD',
    'OPUSD',
    'NEARUSD',
    'APTUSD',
    'ATOMUSD',
    'TIAUSD',
    'INJUSD',
    'FILUSD',
    'PEPEUSD',
] as const;
