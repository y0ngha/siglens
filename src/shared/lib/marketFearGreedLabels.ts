import type { MarketFearGreedFactorKey } from '@y0ngha/siglens-core';

// SENTIMENT_LABEL_TEXT and formatConfidenceFooter are shared verbatim with the
// per-stock index — both indices use the same 5-stage label vocabulary and the
// same "표본 N — 신뢰도" footer phrasing, so we re-export instead of duplicating.
export {
    SENTIMENT_LABEL_TEXT,
    formatConfidenceFooter,
} from './fearGreedLabels';

/**
 * 시장 공포·탐욕 지수를 제공하는 시장.
 *
 * `NavRegionId`를 재사용하지 않는다 — 거기엔 `'crypto'`가 있는데, core의 5개 요인은
 * `longTreasury`/`highYield`/`investmentGrade`를 요구해서 암호화폐에는 대응 자산이
 * 없다. 지원하지 않는 시장이 타입에 들어와 있으면 라벨을 억지로 채우게 된다.
 */
export type FearGreedMarketId = 'us' | 'kr';

/**
 * Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다.
 *
 * **시장별로 갈리는 이유**: 요인 키는 core가 정한 경제적 역할이고, 그 역할을 어떤
 * 자산으로 채웠는지는 시장마다 다르다. 한국에는 유동성 있는 하이일드 채권이 없어
 * `junk_bond` 슬롯을 회사채−국고채 스프레드로 채웠으므로, 라벨을 `하이일드 수요`로
 * 두면 화면이 사실과 다른 말을 하게 된다.
 */
export const MARKET_FACTOR_LABEL: Record<
    FearGreedMarketId,
    Record<MarketFearGreedFactorKey, string>
> = {
    us: {
        momentum: '시장 모멘텀',
        volatility: '시장 변동성',
        safe_haven: '안전자산 선호',
        junk_bond: '하이일드 수요',
        breadth: '시장 폭',
    },
    kr: {
        momentum: '시장 모멘텀',
        volatility: '시장 변동성',
        safe_haven: '안전자산 선호',
        junk_bond: '신용 스프레드 수요',
        breadth: '시장 폭',
    },
};

/**
 * Factor key → 입력값과 방향을 설명하는 한 줄 한글 설명.
 *
 * 요인 막대와 페이지의 "공포탐욕지수 읽는 법" 가이드가 같은 문장을 쓴다 — 설명이 두
 * 벌이면 계산식을 바꿀 때 한쪽만 갱신되어 조용히 어긋난다.
 *
 * 한국 쪽 `volatility` 문장이 "실현변동성"이라고 말하는 것은 정확한 서술이다.
 * VKOSPI를 받을 수 있는 무료 소스가 없어(yahoo 미제공, 공공데이터포털 지수시세는
 * 별도 서비스 신청 필요) 코스피 종가에서 직접 산출한다 —
 * `entities/market-fear-greed/lib/realizedVolatility.ts`.
 */
export const MARKET_FACTOR_DESCRIPTION: Record<
    FearGreedMarketId,
    Record<MarketFearGreedFactorKey, string>
> = {
    us: {
        momentum: 'S&P 500이 125일 이동평균보다 높을수록 탐욕',
        volatility: 'VIX가 50일 이동평균보다 낮을수록(시장이 잠잠할수록) 탐욕',
        safe_haven: '최근 20일 주식 수익률이 장기국채보다 앞설수록 탐욕',
        junk_bond: '최근 20일 하이일드 회사채가 투자등급보다 앞설수록 탐욕',
        breadth:
            '최근 20일 동일가중 지수가 시총가중보다 앞설수록(중소형까지 온기가 퍼질수록) 탐욕',
    },
    kr: {
        momentum: '코스피200(KODEX 200)이 125일 이동평균보다 높을수록 탐욕',
        volatility:
            '코스피 20일 실현변동성이 50일 평균보다 낮을수록(시장이 잠잠할수록) 탐욕',
        safe_haven: '최근 20일 주식 수익률이 국고채 30년보다 앞설수록 탐욕',
        junk_bond:
            '최근 20일 회사채가 국고채 10년보다 앞설수록(신용 위험을 감수할수록) 탐욕',
        breadth:
            '최근 20일 코스피200 동일가중이 시총가중보다 앞설수록(중소형까지 온기가 퍼질수록) 탐욕',
    },
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
