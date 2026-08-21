// sentimentLabelText and formatConfidenceFooter are shared verbatim with the
// per-stock index — both indices use the same 5-stage label vocabulary and the
// same "표본 N — 신뢰도" footer phrasing, so we re-export instead of duplicating.
export { sentimentLabelText, confidenceLabelKey } from './fearGreedLabels';

/**
 * 시장 공포·탐욕 지수를 제공하는 시장.
 *
 * `NavRegionId`를 재사용하지 않는다 — 거기엔 `'crypto'`가 있는데, core의 5개 요인은
 * `longTreasury`/`highYield`/`investmentGrade`를 요구해서 암호화폐에는 대응 자산이
 * 없다. 지원하지 않는 시장이 타입에 들어와 있으면 라벨을 억지로 채우게 된다.
 */
export type FearGreedMarketId = 'us' | 'kr';

// Locale-aware formatter hoisted to module scope — Intl.NumberFormat instances
// are expensive to construct, so we reuse one instance for all five factors.
// Every market factor's rawValue is a ratio (moving-average distance or a
// return spread), so unlike the per-stock formatter, one precision fits all.
const MARKET_FACTOR_PERCENT_FORMAT = new Intl.NumberFormat('ko-KR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
});

/** Raw value 표시 포맷터 — 부호 있는 2dp 퍼센트로 통일 출력한다. */
export function formatMarketFactorRaw(rawValue: number): string {
    return MARKET_FACTOR_PERCENT_FORMAT.format(rawValue);
}
