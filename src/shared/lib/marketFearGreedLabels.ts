import type { MarketFearGreedFactorKey } from '@y0ngha/siglens-core';

// SENTIMENT_LABEL_TEXT and formatConfidenceFooter are shared verbatim with the
// per-stock index — both indices use the same 5-stage label vocabulary and the
// same "표본 N — 신뢰도" footer phrasing, so we re-export instead of duplicating.
export {
    SENTIMENT_LABEL_TEXT,
    formatConfidenceFooter,
} from './fearGreedLabels';

/** Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다. */
export const MARKET_FACTOR_LABEL: Record<MarketFearGreedFactorKey, string> = {
    momentum: '시장 모멘텀',
    volatility: '시장 변동성',
    safe_haven: '안전자산 선호',
    junk_bond: '하이일드 수요',
    breadth: '시장 폭',
};

/**
 * Factor key → 입력값과 방향을 설명하는 한 줄 한글 설명.
 *
 * 요인 막대와 페이지의 "지수 읽는 법" 가이드가 같은 문장을 쓴다 — 설명이 두
 * 벌이면 계산식을 바꿀 때 한쪽만 갱신되어 조용히 어긋난다.
 */
export const MARKET_FACTOR_DESCRIPTION: Record<
    MarketFearGreedFactorKey,
    string
> = {
    momentum: 'S&P 500이 125일 이동평균보다 높을수록 탐욕',
    volatility: 'VIX가 50일 이동평균보다 낮을수록(시장이 잠잠할수록) 탐욕',
    safe_haven: '최근 20일 주식 수익률이 장기국채보다 앞설수록 탐욕',
    junk_bond: '최근 20일 하이일드 회사채가 투자등급보다 앞설수록 탐욕',
    breadth:
        '최근 20일 동일가중 지수가 시총가중보다 앞설수록(중소형까지 온기가 퍼질수록) 탐욕',
};

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
