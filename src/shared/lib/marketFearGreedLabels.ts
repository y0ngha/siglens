// sentimentLabelText and formatConfidenceFooter are shared verbatim with the
// per-stock index — both indices use the same 5-stage label vocabulary and the
// same "표본 N — 신뢰도" footer phrasing, so we re-export instead of duplicating.
export { sentimentLabelText, confidenceLabelKey } from './fearGreedLabels';

/**
 * 시장 공포·탐욕 지수를 제공하는 시장.
 *
 * `NavRegionId`와 값이 같아졌지만 재사용하지 않는다 — 내비에 지역을 연다고 그
 * 지역의 지수가 생기는 것이 아니다. 암호화폐는 채권 요인이 없는 전용 6요인 지수
 * (`computeCryptoFearGreedIndex`)가 생긴 뒤에야 여기 들어왔다.
 */
export type FearGreedMarketId = 'us' | 'kr' | 'crypto';

// Locale-aware formatters hoisted to module scope — Intl.NumberFormat instances
// are expensive to construct, so we reuse them across all factors.
// Every market factor's rawValue is a ratio, so one 2dp precision fits all.
// What differs is the sign: US/KR factors (and crypto momentum, downside
// volatility, safe haven) are signed distances or return spreads, while three
// crypto factors are [0, 1] shares — "+50.00%" would read as a change that
// does not exist, so shares render unsigned.
const MARKET_FACTOR_PERCENT_FORMAT = new Intl.NumberFormat('ko-KR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
});

const MARKET_FACTOR_SHARE_FORMAT = new Intl.NumberFormat('ko-KR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Crypto factors whose rawValue is a share in [0, 1] (core
 * `CryptoFearGreedFactorKey`). `breadth` is listed here only for crypto — the
 * US/KR `breadth` is a return spread and stays signed.
 */
const CRYPTO_SHARE_FACTOR_KEYS: ReadonlySet<string> = new Set([
    'breadth',
    'alt_season',
    'volume_flow',
]);

/**
 * Raw value 표시 포맷터 — 2dp 퍼센트. 부호 있는 거리·수익률 차는 `+`/`-`를
 * 붙이고, 암호화폐의 비율 요인(시장 폭·알트 시즌·거래량 흐름)은 부호 없이 낸다.
 */
export function formatMarketFactorRaw(
    rawValue: number,
    key: string,
    market: FearGreedMarketId
): string {
    const isShare = market === 'crypto' && CRYPTO_SHARE_FACTOR_KEYS.has(key);
    return (
        isShare ? MARKET_FACTOR_SHARE_FORMAT : MARKET_FACTOR_PERCENT_FORMAT
    ).format(rawValue);
}
