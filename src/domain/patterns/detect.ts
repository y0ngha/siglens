import type { Bar, PatternResult, PatternType } from '@/domain/types';
import {
    CANDLE_DOJI_BODY_RATIO,
    CANDLE_HAMMER_LOWER_SHADOW_MIN,
    CANDLE_REVERSAL_MAX_BODY,
    CANDLE_SHOOTING_STAR_UPPER_SHADOW_MIN,
    PATTERN_BARS_WEDGE,
    PATTERN_DOUBLE_CANDLE_WEIGHT,
    PATTERN_DOUBLE_PRICE_TOLERANCE,
    PATTERN_DOUBLE_PRICE_WEIGHT,
    PATTERN_DOUBLE_VOLUME_WEIGHT,
    PATTERN_HS_NECKLINE_WEIGHT,
    PATTERN_HS_SHOULDER_WEIGHT,
    PATTERN_HS_VOLUME_WEIGHT,
    PATTERN_MIN_BARS_DOUBLE,
    PATTERN_MIN_BARS_HEAD_SHOULDERS,
    PATTERN_NECKLINE_TOLERANCE,
    PATTERN_PEAK_LOOKBACK,
    PATTERN_SHOULDER_TOLERANCE,
    PATTERN_WEDGE_CONVERGENCE_WEIGHT,
    PATTERN_WEDGE_VOLUME_WEIGHT,
} from '@/domain/patterns/constants';

// ─── 공통 헬퍼 ────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

// ─── 로컬 극값 감지 ───────────────────────────────────────────────────────────

/**
 * 좌우 PATTERN_PEAK_LOOKBACK 봉 모두보다 high 가 높은 인덱스를 반환한다.
 */
function findLocalPeakIndices(bars: Bar[]): number[] {
    return bars.reduce<number[]>((acc, _, i) => {
        if (
            i < PATTERN_PEAK_LOOKBACK ||
            i >= bars.length - PATTERN_PEAK_LOOKBACK
        )
            return acc;
        const priceWindow = bars.slice(
            i - PATTERN_PEAK_LOOKBACK,
            i + PATTERN_PEAK_LOOKBACK + 1
        );
        return priceWindow.every(
            (b, j) => j === PATTERN_PEAK_LOOKBACK || b.high < bars[i].high
        )
            ? [...acc, i]
            : acc;
    }, []);
}

/**
 * 좌우 PATTERN_PEAK_LOOKBACK 봉 모두보다 low 가 낮은 인덱스를 반환한다.
 */
function findLocalValleyIndices(bars: Bar[]): number[] {
    return bars.reduce<number[]>((acc, _, i) => {
        if (
            i < PATTERN_PEAK_LOOKBACK ||
            i >= bars.length - PATTERN_PEAK_LOOKBACK
        )
            return acc;
        const priceWindow = bars.slice(
            i - PATTERN_PEAK_LOOKBACK,
            i + PATTERN_PEAK_LOOKBACK + 1
        );
        return priceWindow.every(
            (b, j) => j === PATTERN_PEAK_LOOKBACK || b.low > bars[i].low
        )
            ? [...acc, i]
            : acc;
    }, []);
}

// ─── 캔들스틱 분석 ────────────────────────────────────────────────────────────

/** 봉체 비율: |close - open| / (high - low). 0 = 도지, 1 = 마루보즈 */
function bodyRatio(bar: Bar): number {
    const range = bar.high - bar.low;
    return range === 0 ? 0 : Math.abs(bar.close - bar.open) / range;
}

/** 윗 꼬리 비율: (high - max(open,close)) / range */
function upperShadowRatio(bar: Bar): number {
    const range = bar.high - bar.low;
    return range === 0 ? 0 : (bar.high - Math.max(bar.open, bar.close)) / range;
}

/** 아랫 꼬리 비율: (min(open,close) - low) / range */
function lowerShadowRatio(bar: Bar): number {
    const range = bar.high - bar.low;
    return range === 0 ? 0 : (Math.min(bar.open, bar.close) - bar.low) / range;
}

/**
 * 하락 반전 캔들 여부 (슈팅스타 · 도지 · 베어리시 엔걸핑).
 * 상단 저항에서 가격이 거부당한 신호.
 */
function isBearishReversalCandle(bar: Bar, prevBar?: Bar): boolean {
    const body = bodyRatio(bar);

    // 슈팅스타: 작은 봉체 + 긴 윗 꼬리 (위로 찌르다 밀린 형태)
    if (
        body <= CANDLE_REVERSAL_MAX_BODY &&
        upperShadowRatio(bar) >= CANDLE_SHOOTING_STAR_UPPER_SHADOW_MIN
    )
        return true;

    // 도지: 봉체가 거의 없음 (매수·매도 균형, 모멘텀 소진)
    if (body <= CANDLE_DOJI_BODY_RATIO) return true;

    // 베어리시 엔걸핑: 전 봉 양봉을 현재 음봉이 완전히 감싸는 형태
    if (
        prevBar !== undefined &&
        bar.close < bar.open &&
        prevBar.close > prevBar.open &&
        bar.open >= prevBar.close &&
        bar.close <= prevBar.open
    )
        return true;

    return false;
}

/**
 * 상승 반전 캔들 여부 (망치 · 도지 · 불리시 엔걸핑).
 * 하단 지지에서 매수세가 나타난 신호.
 */
function isBullishReversalCandle(bar: Bar, prevBar?: Bar): boolean {
    const body = bodyRatio(bar);

    // 망치: 작은 봉체 + 긴 아랫 꼬리 (아래로 찌르다 회복한 형태)
    if (
        body <= CANDLE_REVERSAL_MAX_BODY &&
        lowerShadowRatio(bar) >= CANDLE_HAMMER_LOWER_SHADOW_MIN
    )
        return true;

    // 도지
    if (body <= CANDLE_DOJI_BODY_RATIO) return true;

    // 불리시 엔걸핑: 전 봉 음봉을 현재 양봉이 완전히 감싸는 형태
    if (
        prevBar !== undefined &&
        bar.close > bar.open &&
        prevBar.close < prevBar.open &&
        bar.open <= prevBar.close &&
        bar.close >= prevBar.open
    )
        return true;

    return false;
}

// ─── 거래량 분석 ──────────────────────────────────────────────────────────────

function meanVolume(bars: Bar[]): number {
    return bars.length === 0
        ? 0
        : bars.reduce((s, b) => s + b.volume, 0) / bars.length;
}

/**
 * vol1 대비 vol2 의 감소 비율 [0, 1].
 * vol1 > vol2 → 양수(감소), vol1 ≤ vol2 → 0 으로 클램프.
 */
function volumeDeclineRatio(vol1: number, vol2: number): number {
    return vol1 === 0 ? 0 : clamp01((vol1 - vol2) / vol1);
}

// ─── 선형 회귀 기울기 ─────────────────────────────────────────────────────────

function linearSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((s, v) => s + v, 0) / n;
    const numerator = values.reduce(
        (s, v, i) => s + (i - meanX) * (v - meanY),
        0
    );
    const denominator = values.reduce((s, _, i) => s + (i - meanX) ** 2, 0);
    return denominator === 0 ? 0 : numerator / denominator;
}

// ─── 이중천장 ─────────────────────────────────────────────────────────────────

/**
 * 감지 기준:
 *  - 두 고점(피크)의 가격이 PATTERN_DOUBLE_PRICE_TOLERANCE 이내
 *  - 두 피크 사이에 밸리 존재
 *  - confidence = 가격 유사도(60%) + 거래량 다이버전스(25%) + 슈팅스타·도지 확인(15%)
 *
 * 전형적 신호:
 *  - 두 번째 고점의 거래량이 첫 번째보다 적음 (매수세 소진)
 *  - 두 번째 고점에서 슈팅스타·도지 출현 (가격 거부)
 */
function detectDoubleTop(bars: Bar[]): PatternResult | null {
    if (bars.length < PATTERN_MIN_BARS_DOUBLE) return null;

    const peaks = findLocalPeakIndices(bars);
    const valleys = findLocalValleyIndices(bars);
    if (peaks.length < 2) return null;

    const candidates = peaks
        .slice(0, -1)
        .map((p1, i) => {
            const p2 = peaks[i + 1];
            const h1 = bars[p1].high;
            const h2 = bars[p2].high;
            const priceDiff = Math.abs(h1 - h2) / Math.max(h1, h2);

            if (priceDiff > PATTERN_DOUBLE_PRICE_TOLERANCE) return null;
            if (!valleys.some(v => v > p1 && v < p2)) return null;

            const priceSimilarity =
                1 - priceDiff / PATTERN_DOUBLE_PRICE_TOLERANCE;
            const volumeScore = volumeDeclineRatio(
                bars[p1].volume,
                bars[p2].volume
            );
            const prevBar = p2 > 0 ? bars[p2 - 1] : undefined;
            const candleScore = isBearishReversalCandle(bars[p2], prevBar)
                ? 1
                : 0;

            const confidence = clamp01(
                PATTERN_DOUBLE_PRICE_WEIGHT * priceSimilarity +
                    PATTERN_DOUBLE_VOLUME_WEIGHT * volumeScore +
                    PATTERN_DOUBLE_CANDLE_WEIGHT * candleScore
            );

            return {
                type: 'double_top' as PatternType,
                confidence,
                startIndex: p1,
                endIndex: p2,
            };
        })
        .filter((r): r is PatternResult => r !== null);

    return candidates.length === 0
        ? null
        : candidates.reduce((best, r) =>
              r.endIndex > best.endIndex ? r : best
          );
}

// ─── 이중바닥 ─────────────────────────────────────────────────────────────────

/**
 * 감지 기준:
 *  - 두 저점(밸리)의 가격이 PATTERN_DOUBLE_PRICE_TOLERANCE 이내
 *  - 두 밸리 사이에 피크 존재
 *  - confidence = 가격 유사도(60%) + 거래량 다이버전스(25%) + 망치·도지 확인(15%)
 *
 * 전형적 신호:
 *  - 두 번째 저점의 거래량이 첫 번째보다 적음 (매도세 소진)
 *  - 두 번째 저점에서 망치·도지 출현 (하락 거부)
 */
function detectDoubleBottom(bars: Bar[]): PatternResult | null {
    if (bars.length < PATTERN_MIN_BARS_DOUBLE) return null;

    const peaks = findLocalPeakIndices(bars);
    const valleys = findLocalValleyIndices(bars);
    if (valleys.length < 2) return null;

    const candidates = valleys
        .slice(0, -1)
        .map((v1, i) => {
            const v2 = valleys[i + 1];
            const l1 = bars[v1].low;
            const l2 = bars[v2].low;
            const priceDiff = Math.abs(l1 - l2) / Math.min(l1, l2);

            if (priceDiff > PATTERN_DOUBLE_PRICE_TOLERANCE) return null;
            if (!peaks.some(p => p > v1 && p < v2)) return null;

            const priceSimilarity =
                1 - priceDiff / PATTERN_DOUBLE_PRICE_TOLERANCE;
            const volumeScore = volumeDeclineRatio(
                bars[v1].volume,
                bars[v2].volume
            );
            const prevBar = v2 > 0 ? bars[v2 - 1] : undefined;
            const candleScore = isBullishReversalCandle(bars[v2], prevBar)
                ? 1
                : 0;

            const confidence = clamp01(
                PATTERN_DOUBLE_PRICE_WEIGHT * priceSimilarity +
                    PATTERN_DOUBLE_VOLUME_WEIGHT * volumeScore +
                    PATTERN_DOUBLE_CANDLE_WEIGHT * candleScore
            );

            return {
                type: 'double_bottom' as PatternType,
                confidence,
                startIndex: v1,
                endIndex: v2,
            };
        })
        .filter((r): r is PatternResult => r !== null);

    return candidates.length === 0
        ? null
        : candidates.reduce((best, r) =>
              r.endIndex > best.endIndex ? r : best
          );
}

// ─── 헤드앤숄더 ───────────────────────────────────────────────────────────────

/**
 * 감지 기준:
 *  - 세 피크: 머리(중앙)가 양쪽 어깨보다 높음
 *  - 어깨 높이 차이 PATTERN_SHOULDER_TOLERANCE 이내
 *  - 넥라인(두 밸리) 수평에 가까울수록 신뢰도 높음
 *  - confidence = 어깨 대칭(40%) + 넥라인 일관성(30%) + 거래량 패턴(30%)
 *
 * 전형적 거래량 신호:
 *  - 오른쪽 어깨의 거래량 < 왼쪽 어깨 (상승 모멘텀 소진)
 */
function toHeadAndShouldersResult(
    bars: Bar[],
    valleys: number[],
    p1: number,
    p2: number,
    p3: number
): PatternResult | null {
    const head = bars[p2].high;
    const leftShoulder = bars[p1].high;
    const rightShoulder = bars[p3].high;

    if (head <= leftShoulder || head <= rightShoulder) return null;

    const maxShoulder = Math.max(leftShoulder, rightShoulder);
    const shoulderDiff = Math.abs(leftShoulder - rightShoulder) / maxShoulder;
    if (shoulderDiff > PATTERN_SHOULDER_TOLERANCE) return null;

    const v1 = valleys.find(v => v > p1 && v < p2);
    const v2 = valleys.find(v => v > p2 && v < p3);
    if (v1 === undefined || v2 === undefined) return null;

    const maxNeckline = Math.max(bars[v1].low, bars[v2].low);
    const necklineDiff = Math.abs(bars[v1].low - bars[v2].low) / maxNeckline;
    if (necklineDiff > PATTERN_NECKLINE_TOLERANCE) return null;

    const shoulderSymmetry = 1 - shoulderDiff / PATTERN_SHOULDER_TOLERANCE;
    const necklineConsistency = 1 - necklineDiff / PATTERN_NECKLINE_TOLERANCE;
    const volumeScore = volumeDeclineRatio(bars[p1].volume, bars[p3].volume);

    const confidence = clamp01(
        PATTERN_HS_SHOULDER_WEIGHT * shoulderSymmetry +
            PATTERN_HS_NECKLINE_WEIGHT * necklineConsistency +
            PATTERN_HS_VOLUME_WEIGHT * volumeScore
    );

    return {
        type: 'head_and_shoulders',
        confidence,
        startIndex: p1,
        endIndex: p3,
    };
}

function detectHeadAndShoulders(bars: Bar[]): PatternResult | null {
    if (bars.length < PATTERN_MIN_BARS_HEAD_SHOULDERS) return null;

    const peaks = findLocalPeakIndices(bars);
    const valleys = findLocalValleyIndices(bars);
    if (peaks.length < 3) return null;

    const candidates = peaks
        .slice(0, -2)
        .map((p1, i) =>
            toHeadAndShouldersResult(
                bars,
                valleys,
                p1,
                peaks[i + 1],
                peaks[i + 2]
            )
        )
        .filter((r): r is PatternResult => r !== null);

    return candidates.length === 0
        ? null
        : candidates.reduce((best, r) =>
              r.endIndex > best.endIndex ? r : best
          );
}

// ─── 역헤드앤숄더 ─────────────────────────────────────────────────────────────

/**
 * 감지 기준:
 *  - 세 밸리: 머리(중앙)가 양쪽 어깨보다 낮음
 *  - 어깨 깊이 차이 PATTERN_SHOULDER_TOLERANCE 이내
 *  - 넥라인(두 피크) 수평에 가까울수록 신뢰도 높음
 *  - confidence = 어깨 대칭(40%) + 넥라인 일관성(30%) + 거래량 패턴(30%)
 */
function toInverseHeadAndShouldersResult(
    bars: Bar[],
    peaks: number[],
    v1: number,
    v2: number,
    v3: number
): PatternResult | null {
    const head = bars[v2].low;
    const leftShoulder = bars[v1].low;
    const rightShoulder = bars[v3].low;

    if (head >= leftShoulder || head >= rightShoulder) return null;

    const minShoulder = Math.min(leftShoulder, rightShoulder);
    const shoulderDiff = Math.abs(leftShoulder - rightShoulder) / minShoulder;
    if (shoulderDiff > PATTERN_SHOULDER_TOLERANCE) return null;

    const nk1 = peaks.find(p => p > v1 && p < v2);
    const nk2 = peaks.find(p => p > v2 && p < v3);
    if (nk1 === undefined || nk2 === undefined) return null;

    const minNeckline = Math.min(bars[nk1].high, bars[nk2].high);
    const necklineDiff =
        Math.abs(bars[nk1].high - bars[nk2].high) / minNeckline;
    if (necklineDiff > PATTERN_NECKLINE_TOLERANCE) return null;

    const shoulderSymmetry = 1 - shoulderDiff / PATTERN_SHOULDER_TOLERANCE;
    const necklineConsistency = 1 - necklineDiff / PATTERN_NECKLINE_TOLERANCE;
    const volumeScore = volumeDeclineRatio(bars[v1].volume, bars[v3].volume);

    const confidence = clamp01(
        PATTERN_HS_SHOULDER_WEIGHT * shoulderSymmetry +
            PATTERN_HS_NECKLINE_WEIGHT * necklineConsistency +
            PATTERN_HS_VOLUME_WEIGHT * volumeScore
    );

    return {
        type: 'inverse_head_and_shoulders',
        confidence,
        startIndex: v1,
        endIndex: v3,
    };
}

function detectInverseHeadAndShoulders(bars: Bar[]): PatternResult | null {
    if (bars.length < PATTERN_MIN_BARS_HEAD_SHOULDERS) return null;

    const peaks = findLocalPeakIndices(bars);
    const valleys = findLocalValleyIndices(bars);
    if (valleys.length < 3) return null;

    const candidates = valleys
        .slice(0, -2)
        .map((v1, i) =>
            toInverseHeadAndShouldersResult(
                bars,
                peaks,
                v1,
                valleys[i + 1],
                valleys[i + 2]
            )
        )
        .filter((r): r is PatternResult => r !== null);

    return candidates.length === 0
        ? null
        : candidates.reduce((best, r) =>
              r.endIndex > best.endIndex ? r : best
          );
}

// ─── 쐐기형 ───────────────────────────────────────────────────────────────────

/**
 * 선형 회귀로 고점 추세선·저점 추세선의 기울기를 구한 뒤 수렴 여부를 판단한다.
 *
 * ascending_wedge (상승쐐기, 하락 반전):
 *  - 고점·저점 모두 상승 (두 기울기 > 0)
 *  - 저점 기울기 > 고점 기울기 → 채널이 위쪽에서 수렴
 *  - 거래량이 패턴 진행 중 감소할수록 신뢰도 높음
 *
 * descending_wedge (하락쐐기, 상승 반전):
 *  - 고점·저점 모두 하락 (두 기울기 < 0)
 *  - 저점 기울기 > 고점 기울기 (저점이 덜 하락) → 채널이 아래쪽에서 수렴
 *
 * confidence = 수렴 비율(70%) + 거래량 감소(30%)
 * 수렴 비율 = 1 - (피팅된 채널 끝 폭 / 시작 폭)
 */
function detectWedge(
    bars: Bar[],
    type: 'ascending_wedge' | 'descending_wedge'
): PatternResult | null {
    if (bars.length < PATTERN_BARS_WEDGE) return null;

    const recentBars = bars.slice(-PATTERN_BARS_WEDGE);
    const highs = recentBars.map(b => b.high);
    const lows = recentBars.map(b => b.low);
    const n = PATTERN_BARS_WEDGE;

    const slopeHighs = linearSlope(highs);
    const slopeLows = linearSlope(lows);

    // 두 추세선이 수렴하려면 저점 기울기 > 고점 기울기
    if (slopeLows <= slopeHighs) return null;

    if (type === 'ascending_wedge') {
        if (slopeHighs <= 0 || slopeLows <= 0) return null;
    } else {
        if (slopeHighs >= 0 || slopeLows >= 0) return null;
    }

    // 피팅된 채널 시작·끝 폭으로 수렴 비율 계산
    const meanX = (n - 1) / 2;
    const interceptHighs =
        highs.reduce((s, v) => s + v, 0) / n - slopeHighs * meanX;
    const interceptLows =
        lows.reduce((s, v) => s + v, 0) / n - slopeLows * meanX;

    const rangeStart = interceptHighs - interceptLows;
    const rangeEnd =
        interceptHighs +
        slopeHighs * (n - 1) -
        (interceptLows + slopeLows * (n - 1));

    // 두 선이 교차하면 패턴 불성립
    if (rangeStart <= 0 || rangeEnd <= 0) return null;

    const convergenceRatio = clamp01(1 - rangeEnd / rangeStart);

    // 거래량 감소 (쐐기 내부에서 거래량 감소는 패턴 신뢰도 보강)
    const half = Math.floor(n / 2);
    const volFirst = meanVolume(recentBars.slice(0, half));
    const volSecond = meanVolume(recentBars.slice(half));
    const volumeDecline = volumeDeclineRatio(volFirst, volSecond);

    const confidence = clamp01(
        PATTERN_WEDGE_CONVERGENCE_WEIGHT * convergenceRatio +
            PATTERN_WEDGE_VOLUME_WEIGHT * volumeDecline
    );

    return {
        type,
        confidence,
        startIndex: bars.length - PATTERN_BARS_WEDGE,
        endIndex: bars.length - 1,
    };
}

// ─── 패턴 감지 함수 맵 ────────────────────────────────────────────────────────

const PATTERN_DETECTORS: Record<
    PatternType,
    (bars: Bar[]) => PatternResult | null
> = {
    head_and_shoulders: detectHeadAndShoulders,
    inverse_head_and_shoulders: detectInverseHeadAndShoulders,
    ascending_wedge: bars => detectWedge(bars, 'ascending_wedge'),
    descending_wedge: bars => detectWedge(bars, 'descending_wedge'),
    double_top: detectDoubleTop,
    double_bottom: detectDoubleBottom,
};

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * activePatterns 에 포함된 패턴만 감지하여 PatternResult[] 를 반환한다.
 *
 * activePatterns 는 infrastructure 가 skills/*.md frontmatter 의
 * `type: pattern` · `pattern: <PatternType>` 필드를 파싱한 결과다.
 * detect.ts 는 파일을 직접 읽지 않는다 — 순수 함수만 포함한다.
 *
 * activePatterns 가 비어 있으면 빈 배열을 반환한다.
 */
export function detectPatterns(
    bars: Bar[],
    activePatterns: PatternType[]
): PatternResult[] {
    if (bars.length === 0 || activePatterns.length === 0) return [];

    return activePatterns
        .map(pattern => PATTERN_DETECTORS[pattern](bars))
        .filter((r): r is PatternResult => r !== null);
}
