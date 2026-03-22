import { detectPatterns } from '@/domain/patterns/detect';
import {
    PATTERN_BARS_WEDGE,
    PATTERN_MIN_BARS_DOUBLE,
    PATTERN_MIN_BARS_HEAD_SHOULDERS,
    PATTERN_PEAK_LOOKBACK,
} from '@/domain/patterns/constants';
import type { Bar, PatternType } from '@/domain/types';

// ─── 테스트 상수 ──────────────────────────────────────────────────────────────

const TEST_DEFAULT_VOLUME = 1000;
const TEST_HIGH_VOLUME = 2000;
const TEST_LOW_VOLUME = 800;
const TEST_MED_VOLUME = 1200;

/** 픽스처에서 사용하는 BAR 봉 수 */
const H_AND_S_BAR_COUNT = PATTERN_MIN_BARS_HEAD_SHOULDERS;
const DOUBLE_BAR_COUNT = PATTERN_MIN_BARS_DOUBLE;
const WEDGE_BAR_COUNT = PATTERN_BARS_WEDGE;

/** 너무 적은 봉 수 (모든 패턴 감지 불가) */
const TOO_FEW_BAR_COUNT = PATTERN_PEAK_LOOKBACK * 2;

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeBar(
    i: number,
    high: number,
    low: number,
    options: { open?: number; close?: number; volume?: number } = {}
): Bar {
    const mid = (high + low) / 2;
    return {
        time: 1700000000 + i * 60,
        open: options.open ?? mid,
        high,
        low,
        close: options.close ?? mid,
        volume: options.volume ?? TEST_DEFAULT_VOLUME,
    };
}

// ─── HEAD AND SHOULDERS 픽스처 ────────────────────────────────────────────────
// 피크: 5 (left shoulder h=115, vol=HIGH), 14 (head h=130), 23 (right shoulder h=114, vol=MED)
// 밸리: 9 (low=90), 18 (low=90) → 넥라인 완벽 수평
// 오른쪽 어깨 거래량 < 왼쪽 어깨 → volumeScore 양수
const HS_LEFT_SHOULDER_IDX = 5;
const HS_HEAD_IDX = 14;
const HS_RIGHT_SHOULDER_IDX = 23;
const HS_VALLEY1_IDX = 9;
const HS_VALLEY2_IDX = 18;

const headAndShouldersBars: Bar[] = Array.from(
    { length: H_AND_S_BAR_COUNT },
    (_, i) => {
        const TABLE: Record<number, [number, number, number?]> = {
            0: [100, 90],
            1: [104, 93],
            2: [108, 97],
            3: [110, 99],
            4: [112, 101],
            [HS_LEFT_SHOULDER_IDX]: [115, 104, TEST_HIGH_VOLUME],
            6: [112, 100],
            7: [108, 96],
            8: [104, 93],
            [HS_VALLEY1_IDX]: [100, 90],
            10: [106, 95],
            11: [110, 100],
            12: [118, 107],
            13: [124, 113],
            [HS_HEAD_IDX]: [130, 118],
            15: [124, 112],
            16: [118, 106],
            17: [110, 98],
            [HS_VALLEY2_IDX]: [100, 90],
            19: [104, 94],
            20: [108, 97],
            21: [110, 100],
            22: [112, 101],
            [HS_RIGHT_SHOULDER_IDX]: [114, 103, TEST_MED_VOLUME],
            24: [110, 100],
            25: [106, 95],
            26: [102, 91],
            27: [98, 88],
            28: [94, 84],
            29: [90, 80],
        };
        const [high, low, vol] = TABLE[i] ?? [100, 90];
        return makeBar(i, high, low, { volume: vol });
    }
);

// ─── INVERSE HEAD AND SHOULDERS 픽스처 ───────────────────────────────────────
// 밸리: 5 (low=85, vol=HIGH), 14 (low=70, head), 23 (low=86, vol=MED)
// 넥라인 피크: 9 (high=110), 18 (high=110) → 완벽 수평
const inverseHeadAndShouldersBars: Bar[] = Array.from(
    { length: H_AND_S_BAR_COUNT },
    (_, i) => {
        const TABLE: Record<number, [number, number, number?]> = {
            0: [110, 100],
            1: [106, 97],
            2: [102, 93],
            3: [100, 91],
            4: [98, 88],
            5: [96, 85, TEST_HIGH_VOLUME],
            6: [100, 88],
            7: [104, 92],
            8: [102, 96],
            9: [110, 100],
            10: [104, 95],
            11: [100, 90],
            12: [92, 83],
            13: [86, 76],
            14: [82, 70],
            15: [86, 76],
            16: [92, 82],
            17: [100, 90],
            18: [110, 100],
            19: [106, 96],
            20: [102, 92],
            21: [100, 90],
            22: [98, 88],
            23: [96, 86, TEST_MED_VOLUME],
            24: [100, 90],
            25: [104, 94],
            26: [108, 98],
            27: [112, 102],
            28: [116, 106],
            29: [120, 110],
        };
        const [high, low, vol] = TABLE[i] ?? [110, 100];
        return makeBar(i, high, low, { volume: vol });
    }
);

// ─── DOUBLE TOP 픽스처 ────────────────────────────────────────────────────────
// 피크: 6 (h=120, vol=HIGH), 15 (h=120, vol=LOW, 슈팅스타)
// 밸리: 10 (low=95)
// 두 번째 고점 = 슈팅스타: open=112, close=111, high=120, low=110
//   → bodyRatio = 1/10 = 0.1 (≤ CANDLE_REVERSAL_MAX_BODY)
//   → upperShadowRatio = (120-112)/10 = 0.8 (≥ CANDLE_SHOOTING_STAR_UPPER_SHADOW_MIN) ✓
const DT_PEAK1_IDX = 6;
const DT_VALLEY_IDX = 10;
const DT_PEAK2_IDX = 15;

const doubleTopBars: Bar[] = Array.from(
    { length: DOUBLE_BAR_COUNT },
    (_, i) => {
        const TABLE: Record<
            number,
            Parameters<typeof makeBar>[3] & { high: number; low: number }
        > = {
            0: { high: 100, low: 90 },
            1: { high: 104, low: 93 },
            2: { high: 108, low: 97 },
            3: { high: 110, low: 99 },
            4: { high: 112, low: 101 },
            5: { high: 115, low: 104 },
            [DT_PEAK1_IDX]: { high: 120, low: 110, volume: TEST_HIGH_VOLUME },
            7: { high: 115, low: 104 },
            8: { high: 112, low: 102 },
            9: { high: 110, low: 100 },
            [DT_VALLEY_IDX]: { high: 105, low: 95 },
            11: { high: 108, low: 97 },
            12: { high: 110, low: 100 },
            13: { high: 112, low: 101 },
            14: { high: 115, low: 104 },
            // 슈팅스타: 긴 윗 꼬리, 작은 봉체, 낮은 거래량
            [DT_PEAK2_IDX]: {
                high: 120,
                low: 110,
                open: 112,
                close: 111,
                volume: TEST_LOW_VOLUME,
            },
            16: { high: 115, low: 104 },
            17: { high: 110, low: 100 },
            18: { high: 105, low: 95 },
            19: { high: 100, low: 90 },
        };
        const { high, low, ...opts } = TABLE[i] ?? { high: 100, low: 90 };
        return makeBar(i, high, low, opts);
    }
);

// ─── DOUBLE BOTTOM 픽스처 ─────────────────────────────────────────────────────
// 밸리: 6 (low=80, vol=HIGH), 15 (low=80, vol=LOW, 망치)
// 피크: 10 (high=110)
// 두 번째 저점 = 망치: open=87, close=88, high=90, low=80
//   → bodyRatio = 1/10 = 0.1 (≤ CANDLE_REVERSAL_MAX_BODY)
//   → lowerShadowRatio = (87-80)/10 = 0.7 (≥ CANDLE_HAMMER_LOWER_SHADOW_MIN) ✓
const DB_VALLEY1_IDX = 6;
const DB_PEAK_IDX = 10;
const DB_VALLEY2_IDX = 15;

const doubleBottomBars: Bar[] = Array.from(
    { length: DOUBLE_BAR_COUNT },
    (_, i) => {
        const TABLE: Record<
            number,
            Parameters<typeof makeBar>[3] & { high: number; low: number }
        > = {
            0: { high: 110, low: 100 },
            1: { high: 106, low: 97 },
            2: { high: 102, low: 93 },
            3: { high: 100, low: 91 },
            4: { high: 98, low: 88 },
            5: { high: 95, low: 84 },
            [DB_VALLEY1_IDX]: { high: 90, low: 80, volume: TEST_HIGH_VOLUME },
            7: { high: 95, low: 84 },
            8: { high: 98, low: 88 },
            9: { high: 100, low: 91 },
            [DB_PEAK_IDX]: { high: 110, low: 100 },
            11: { high: 102, low: 92 },
            12: { high: 100, low: 90 },
            13: { high: 97, low: 87 },
            14: { high: 94, low: 84 },
            // 망치: 긴 아랫 꼬리, 작은 봉체, 낮은 거래량
            [DB_VALLEY2_IDX]: {
                high: 90,
                low: 80,
                open: 87,
                close: 88,
                volume: TEST_LOW_VOLUME,
            },
            16: { high: 94, low: 84 },
            17: { high: 98, low: 88 },
            18: { high: 104, low: 94 },
            19: { high: 110, low: 100 },
        };
        const { high, low, ...opts } = TABLE[i] ?? { high: 110, low: 100 };
        return makeBar(i, high, low, opts);
    }
);

// ─── ASCENDING WEDGE 픽스처 ───────────────────────────────────────────────────
// high[i] = 100 + i * 0.5, low[i] = 85 + i * 1.2
// slopeHighs = 0.5, slopeLows = 1.2 → slopeLows > slopeHighs ✓ (수렴)
// convergenceRatio = 1 - rangeEnd / rangeStart = 1 - 1.7/15 ≈ 0.887
const ascendingWedgeBars: Bar[] = Array.from(
    { length: WEDGE_BAR_COUNT },
    (_, i) => makeBar(i, 100 + i * 0.5, 85 + i * 1.2)
);

// ─── DESCENDING WEDGE 픽스처 ──────────────────────────────────────────────────
// high[i] = 120 - i * 2, low[i] = 100 - i
// slopeHighs = -2, slopeLows = -1 → slopeLows > slopeHighs ✓ (수렴)
// convergenceRatio = 1 - 1/20 = 0.95
const descendingWedgeBars: Bar[] = Array.from(
    { length: WEDGE_BAR_COUNT },
    (_, i) => makeBar(i, 120 - i * 2, 100 - i)
);

// ─── 테스트 ───────────────────────────────────────────────────────────────────

const ALL_PATTERN_TYPES: PatternType[] = [
    'head_and_shoulders',
    'inverse_head_and_shoulders',
    'ascending_wedge',
    'descending_wedge',
    'double_top',
    'double_bottom',
];

describe('detectPatterns', () => {
    // ── 경계 케이스 ───────────────────────────────────────────────────────────

    describe('bars가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(detectPatterns([], ALL_PATTERN_TYPES)).toEqual([]);
        });
    });

    describe('activePatterns가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            const bars = Array.from({ length: DOUBLE_BAR_COUNT }, (_, i) =>
                makeBar(i, 100 + i, 90 + i)
            );
            expect(detectPatterns(bars, [])).toEqual([]);
        });
    });

    describe('봉 수가 감지 최소 요건 미만일 때', () => {
        it('모든 패턴에 대해 빈 배열을 반환한다', () => {
            const tooFewBars = Array.from(
                { length: TOO_FEW_BAR_COUNT },
                (_, i) => makeBar(i, 100 + i, 90 + i)
            );
            expect(detectPatterns(tooFewBars, ALL_PATTERN_TYPES)).toEqual([]);
        });
    });

    // ── head_and_shoulders ────────────────────────────────────────────────────

    describe('head_and_shoulders 패턴이 있을 때', () => {
        it('PatternResult를 반환한다', () => {
            const result = detectPatterns(headAndShouldersBars, [
                'head_and_shoulders',
            ]);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('head_and_shoulders');
        });

        it('confidence는 0 이상 1 이하다', () => {
            const [result] = detectPatterns(headAndShouldersBars, [
                'head_and_shoulders',
            ]);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('오른쪽 어깨 거래량이 낮아 confidence가 0.5 이상이다', () => {
            const [result] = detectPatterns(headAndShouldersBars, [
                'head_and_shoulders',
            ]);
            expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        });

        it('startIndex는 endIndex보다 작다', () => {
            const [result] = detectPatterns(headAndShouldersBars, [
                'head_and_shoulders',
            ]);
            expect(result.startIndex).toBeLessThan(result.endIndex);
        });

        it('endIndex는 bars 범위 안에 있다', () => {
            const [result] = detectPatterns(headAndShouldersBars, [
                'head_and_shoulders',
            ]);
            expect(result.endIndex).toBeLessThan(headAndShouldersBars.length);
        });
    });

    describe('head_and_shoulders 패턴이 없을 때', () => {
        it('단조 상승 봉이면 빈 배열을 반환한다', () => {
            const risingBars = Array.from(
                { length: PATTERN_MIN_BARS_HEAD_SHOULDERS },
                (_, i) => makeBar(i, 100 + i, 90 + i)
            );
            expect(detectPatterns(risingBars, ['head_and_shoulders'])).toEqual(
                []
            );
        });
    });

    // ── inverse_head_and_shoulders ────────────────────────────────────────────

    describe('inverse_head_and_shoulders 패턴이 있을 때', () => {
        it('PatternResult를 반환한다', () => {
            const result = detectPatterns(inverseHeadAndShouldersBars, [
                'inverse_head_and_shoulders',
            ]);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('inverse_head_and_shoulders');
        });

        it('confidence는 0 이상 1 이하다', () => {
            const [result] = detectPatterns(inverseHeadAndShouldersBars, [
                'inverse_head_and_shoulders',
            ]);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('startIndex는 endIndex보다 작다', () => {
            const [result] = detectPatterns(inverseHeadAndShouldersBars, [
                'inverse_head_and_shoulders',
            ]);
            expect(result.startIndex).toBeLessThan(result.endIndex);
        });
    });

    describe('inverse_head_and_shoulders 패턴이 없을 때', () => {
        it('단조 하락 봉이면 빈 배열을 반환한다', () => {
            const fallingBars = Array.from(
                { length: PATTERN_MIN_BARS_HEAD_SHOULDERS },
                (_, i) => makeBar(i, 100 - i * 0.5, 90 - i * 0.5)
            );
            expect(
                detectPatterns(fallingBars, ['inverse_head_and_shoulders'])
            ).toEqual([]);
        });
    });

    // ── double_top ────────────────────────────────────────────────────────────

    describe('double_top 패턴이 있을 때', () => {
        it('PatternResult를 반환한다', () => {
            const result = detectPatterns(doubleTopBars, ['double_top']);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('double_top');
        });

        it('슈팅스타와 거래량 감소로 confidence가 0.5 이상이다', () => {
            const [result] = detectPatterns(doubleTopBars, ['double_top']);
            expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        });

        it('두 고점 가격이 동일해 priceSimilarity 가 최대다', () => {
            // priceSimilarity = 1 → 가격 유사도 가중치 0.6 기여 보장
            expect(doubleTopBars[DT_PEAK1_IDX].high).toBe(
                doubleTopBars[DT_PEAK2_IDX].high
            );
        });

        it('startIndex는 endIndex보다 작다', () => {
            const [result] = detectPatterns(doubleTopBars, ['double_top']);
            expect(result.startIndex).toBeLessThan(result.endIndex);
        });
    });

    describe('double_top 패턴이 없을 때', () => {
        it('단조 상승 봉이면 빈 배열을 반환한다', () => {
            const risingBars = Array.from(
                { length: PATTERN_MIN_BARS_DOUBLE },
                (_, i) => makeBar(i, 100 + i, 90 + i)
            );
            expect(detectPatterns(risingBars, ['double_top'])).toEqual([]);
        });
    });

    // ── double_bottom ─────────────────────────────────────────────────────────

    describe('double_bottom 패턴이 있을 때', () => {
        it('PatternResult를 반환한다', () => {
            const result = detectPatterns(doubleBottomBars, ['double_bottom']);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('double_bottom');
        });

        it('망치와 거래량 감소로 confidence가 0.5 이상이다', () => {
            const [result] = detectPatterns(doubleBottomBars, [
                'double_bottom',
            ]);
            expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        });

        it('두 저점 가격이 동일해 priceSimilarity 가 최대다', () => {
            expect(doubleBottomBars[DB_VALLEY1_IDX].low).toBe(
                doubleBottomBars[DB_VALLEY2_IDX].low
            );
        });

        it('startIndex는 endIndex보다 작다', () => {
            const [result] = detectPatterns(doubleBottomBars, [
                'double_bottom',
            ]);
            expect(result.startIndex).toBeLessThan(result.endIndex);
        });
    });

    describe('double_bottom 패턴이 없을 때', () => {
        it('단조 하락 봉이면 빈 배열을 반환한다', () => {
            const fallingBars = Array.from(
                { length: PATTERN_MIN_BARS_DOUBLE },
                (_, i) => makeBar(i, 100 - i * 0.5, 90 - i * 0.5)
            );
            expect(detectPatterns(fallingBars, ['double_bottom'])).toEqual([]);
        });
    });

    // ── ascending_wedge ───────────────────────────────────────────────────────

    describe('ascending_wedge 패턴이 있을 때', () => {
        it('PatternResult를 반환한다', () => {
            const result = detectPatterns(ascendingWedgeBars, [
                'ascending_wedge',
            ]);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('ascending_wedge');
        });

        it('선형 회귀 기반 수렴으로 confidence가 0 이상 1 이하다', () => {
            const [result] = detectPatterns(ascendingWedgeBars, [
                'ascending_wedge',
            ]);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('startIndex는 endIndex보다 작다', () => {
            const [result] = detectPatterns(ascendingWedgeBars, [
                'ascending_wedge',
            ]);
            expect(result.startIndex).toBeLessThan(result.endIndex);
        });
    });

    describe('ascending_wedge 패턴이 없을 때', () => {
        it('평행 채널 봉이면 빈 배열을 반환한다', () => {
            const parallelBars = Array.from(
                { length: WEDGE_BAR_COUNT },
                (_, i) => makeBar(i, 100 + i, 90 + i)
            );
            expect(detectPatterns(parallelBars, ['ascending_wedge'])).toEqual(
                []
            );
        });
    });

    // ── descending_wedge ──────────────────────────────────────────────────────

    describe('descending_wedge 패턴이 있을 때', () => {
        it('PatternResult를 반환한다', () => {
            const result = detectPatterns(descendingWedgeBars, [
                'descending_wedge',
            ]);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('descending_wedge');
        });

        it('강한 수렴으로 confidence가 0.5 이상이다', () => {
            const [result] = detectPatterns(descendingWedgeBars, [
                'descending_wedge',
            ]);
            expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        });

        it('startIndex는 endIndex보다 작다', () => {
            const [result] = detectPatterns(descendingWedgeBars, [
                'descending_wedge',
            ]);
            expect(result.startIndex).toBeLessThan(result.endIndex);
        });
    });

    describe('descending_wedge 패턴이 없을 때', () => {
        it('평행 채널 봉이면 빈 배열을 반환한다', () => {
            const parallelBars = Array.from(
                { length: WEDGE_BAR_COUNT },
                (_, i) => makeBar(i, 100 - i, 90 - i)
            );
            expect(detectPatterns(parallelBars, ['descending_wedge'])).toEqual(
                []
            );
        });
    });

    // ── 복수 패턴 ─────────────────────────────────────────────────────────────

    describe('여러 패턴 타입을 동시에 전달할 때', () => {
        it('각 패턴이 독립적으로 감지된다', () => {
            const result = detectPatterns(doubleTopBars, [
                'double_top',
                'double_bottom',
            ]);
            const types = result.map(r => r.type);
            expect(types).toContain('double_top');
        });

        it('감지되지 않는 패턴은 결과에 포함되지 않는다', () => {
            const result = detectPatterns(doubleTopBars, [
                'double_top',
                'head_and_shoulders',
            ]);
            expect(result.every(r => r.type !== 'head_and_shoulders')).toBe(
                true
            );
        });
    });

    // ── 픽스처 인덱스 일관성 ──────────────────────────────────────────────────

    describe('픽스처 인덱스 상수 일관성', () => {
        it('H&S 왼쪽 어깨가 가장 높지 않다 (머리가 더 높음)', () => {
            expect(
                headAndShouldersBars[HS_LEFT_SHOULDER_IDX].high
            ).toBeLessThan(headAndShouldersBars[HS_HEAD_IDX].high);
        });

        it('H&S 오른쪽 어깨가 왼쪽 어깨와 유사하다 (5 % 이내)', () => {
            const left = headAndShouldersBars[HS_LEFT_SHOULDER_IDX].high;
            const right = headAndShouldersBars[HS_RIGHT_SHOULDER_IDX].high;
            expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(
                0.05
            );
        });

        it('H&S 두 밸리 저점이 동일하다', () => {
            expect(headAndShouldersBars[HS_VALLEY1_IDX].low).toBe(
                headAndShouldersBars[HS_VALLEY2_IDX].low
            );
        });

        it('Double Top 두 피크 고점이 동일하다', () => {
            expect(doubleTopBars[DT_PEAK1_IDX].high).toBe(
                doubleTopBars[DT_PEAK2_IDX].high
            );
        });

        it('Double Top 밸리가 두 피크 사이에 있다', () => {
            expect(DT_VALLEY_IDX).toBeGreaterThan(DT_PEAK1_IDX);
            expect(DT_VALLEY_IDX).toBeLessThan(DT_PEAK2_IDX);
        });

        it('Double Bottom 두 밸리 저점이 동일하다', () => {
            expect(doubleBottomBars[DB_VALLEY1_IDX].low).toBe(
                doubleBottomBars[DB_VALLEY2_IDX].low
            );
        });

        it('Double Bottom 피크가 두 밸리 사이에 있다', () => {
            expect(DB_PEAK_IDX).toBeGreaterThan(DB_VALLEY1_IDX);
            expect(DB_PEAK_IDX).toBeLessThan(DB_VALLEY2_IDX);
        });

        it('TEST_HIGH_VOLUME > TEST_MED_VOLUME > TEST_LOW_VOLUME', () => {
            expect(TEST_HIGH_VOLUME).toBeGreaterThan(TEST_MED_VOLUME);
            expect(TEST_MED_VOLUME).toBeGreaterThan(TEST_LOW_VOLUME);
        });
    });
});
