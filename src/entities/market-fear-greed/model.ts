import type {
    CryptoFearGreedSnapshot,
    FearGreedLabel,
    MarketFearGreedSnapshot,
} from '@y0ngha/siglens-core';

/**
 * 위젯이 스냅샷에서 읽는 필드. core의 두 스냅샷 타입(시장·크립토)이 모두 만족한다.
 * `factors[].key`를 평범한 문자열로 두어 라벨을 시장별로 찾는다.
 */
export interface MarketFearGreedViewSnapshot {
    score: number;
    label: FearGreedLabel;
    factors: ReadonlyArray<{
        key: string;
        rawValue: number;
        percentile: number;
    }>;
    confidence: 'normal' | 'limited';
    sampleSize: number;
    asOf: string;
}

/** 페이지가 현재 판독과 견주는 네 가지 과거 시점. */
export type MarketFearGreedComparisonKey = 'now' | '1w' | '1m' | '1y';

/** 구체적인 세션으로 이미 풀어낸 과거 판독 하나. */
export interface MarketFearGreedComparisonPoint {
    /** 이 점이 답하는 과거 시점. */
    key: MarketFearGreedComparisonKey;
    /** 실제로 쓴 세션의 ISO `YYYY-MM-DD`. 이력이 짧으면 가장 이른 세션으로 당겨진다. */
    date: string;
    /** [0, 100] 범위의 점수. */
    score: number;
    /** `score`의 5단계 라벨. */
    label: FearGreedLabel;
}

/**
 * 과거 판독 하나에 이력이 너무 짧아 닿지 못했는지를 더한 것. `clamped`이면 `date`는
 * 요청한 과거 시점이 아니라 점수가 있는 가장 이른 세션이라, 호출자가 타일이 실제로 보여 주는
 * 세션을 독자에게 알릴 수 있다.
 */
export interface FearGreedLookbackPoint extends MarketFearGreedComparisonPoint {
    clamped: boolean;
}

/**
 * 시장 공포·탐욕 페이지가 그리는 전부.
 *
 * walk-forward 이력은 여기에 싣지 않는다: ~750 세션에 달하는데 페이지는 그중 네 개만
 * 읽으므로, RSC 페이로드로 직렬화하지 않고 캐시 경계에서 `comparisons`로 줄인다.
 *
 * 스냅샷에 대해 제네릭이라 시장(`MarketFearGreedSnapshot`)과 크립토(`CryptoFearGreedSnapshot`)
 * 판독이 캐스트 없이 같은 위젯으로 렌더된다 — 둘은 요인 키 집합만 다르다.
 */
export interface MarketFearGreedView<
    S extends MarketFearGreedViewSnapshot = MarketFearGreedSnapshot,
> {
    /** 최신 판독. 데이터가 부족하면 `null`. */
    snapshot: S | null;
    /** 현재 + 1주·1개월·1년 전, 이 순서. `snapshot`이 `null`이면 빈 배열. */
    comparisons: MarketFearGreedComparisonPoint[];
}

/** 크립토 판독: 같은 뷰에 크립토 스냅샷(크립토 요인 키 여섯 개)을 끼운 형태. */
export type MarketFearGreedCryptoView =
    MarketFearGreedView<CryptoFearGreedSnapshot>;
