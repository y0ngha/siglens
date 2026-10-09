import {
    calculateIndicators,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import {
    mulberry32,
    pathToBars,
    type Waypoint,
} from '@/views/guide/demos/generators';
import type { DemoBar } from '@/views/guide/demos/types';

/**
 * 지표 데모가 함께 쓰는 합성 시세: 상승 → 횡보 → 하락 → 반등 (시드 고정, 260봉).
 * 지표 값은 core `calculateIndicators`가 실제로 계산한다. 항목마다 이 시세의 다른 구간을 잘라 보여 준다.
 */

const PATH: Waypoint[] = [
    [0, 100],
    [18, 116],
    [26, 111],
    [50, 140],
    [58, 134],
    [78, 158],
    [90, 150],
    [100, 160],
    [112, 151],
    [124, 161],
    [134, 152],
    [146, 158],
    [160, 140],
    [168, 146],
    [184, 118],
    [192, 124],
    [206, 104],
    [216, 110],
    [224, 102],
    [240, 124],
    [246, 119],
    [259, 134],
].map(([i, price]) => ({ i, price }));

const BASE_VOLUME = 1_000_000;

export interface SharedSeries {
    bars: DemoBar[];
    result: IndicatorResult;
}

let cached: SharedSeries | null = null;

export function getSharedSeries(): SharedSeries {
    if (cached !== null) return cached;
    const raw = pathToBars(PATH, { seed: 7, rangePct: 0.02, noisePct: 0.022 });
    const rand = mulberry32(99);
    const bars: DemoBar[] = raw.map((bar, index) => {
        const prevClose = index === 0 ? bar.open : raw[index - 1].close;
        const move = Math.abs(bar.close - prevClose) / prevClose;
        const volume = Math.round(
            BASE_VOLUME * (0.6 + move * 55) * (0.8 + rand() * 0.4)
        );
        return { ...bar, volume };
    });
    const result = calculateIndicators(bars as Bar[]);
    cached = { bars, result };
    return cached;
}

/**
 * 다이버전스용 합성 시세: 가격은 두 번째 저점이 더 낮지만, 두 번째 하락은 완만하고
 * 거래량이 말라 RSI·OBV·포스 인덱스의 저점은 오히려 높아진다.
 * 저점 인덱스는 `DIVERGENCE_LOW_1`, `DIVERGENCE_LOW_2`.
 */
export const DIVERGENCE_LOW_1 = 30;
export const DIVERGENCE_LOW_2 = 76;

const DIVERGENCE_PATH: Waypoint[] = [
    [0, 118],
    [10, 112],
    [DIVERGENCE_LOW_1, 100],
    [44, 111],
    [56, 108],
    [DIVERGENCE_LOW_2, 98],
    [94, 114],
    [104, 119],
].map(([i, price]) => ({ i, price }));

let cachedDivergence: SharedSeries | null = null;

function divergenceVolumeFactor(index: number): number {
    if (index < DIVERGENCE_LOW_1) return 1.9;
    if (index < 44) return 2.4;
    if (index < DIVERGENCE_LOW_2) return 0.6;
    return 2.2;
}

export function getDivergenceSeries(): SharedSeries {
    if (cachedDivergence !== null) return cachedDivergence;
    const raw = pathToBars(DIVERGENCE_PATH, {
        seed: 21,
        rangePct: 0.016,
        noisePct: 0.014,
    });
    const rand = mulberry32(5);
    const bars: DemoBar[] = raw.map((bar, index) => ({
        ...bar,
        volume: Math.round(
            BASE_VOLUME * divergenceVolumeFactor(index) * (0.85 + rand() * 0.3)
        ),
    }));
    const result = calculateIndicators(bars as Bar[]);
    cachedDivergence = { bars, result };
    return cachedDivergence;
}

/**
 * 완만한 장기 상승 + 눌림 시세 (260봉): 200일선 위에서의 되돌림 전략용.
 * 마지막 구간에 눌림 저점(`TREND_DIP_LOW`)이 있다.
 */
export const TREND_DIP_LOW = 226;

const TREND_PATH: Waypoint[] = [
    [0, 80],
    [30, 92],
    [60, 100],
    [90, 112],
    [120, 125],
    [150, 138],
    [180, 150],
    [210, 172],
    [TREND_DIP_LOW, 156],
    [238, 167],
    [250, 176],
    [259, 182],
].map(([i, price]) => ({ i, price }));

let cachedTrend: SharedSeries | null = null;

export function getTrendSeries(): SharedSeries {
    if (cachedTrend !== null) return cachedTrend;
    const raw = pathToBars(TREND_PATH, {
        seed: 33,
        rangePct: 0.016,
        noisePct: 0.018,
    });
    const rand = mulberry32(8);
    const bars: DemoBar[] = raw.map(bar => ({
        ...bar,
        volume: Math.round(BASE_VOLUME * (0.8 + rand() * 0.4)),
    }));
    const result = calculateIndicators(bars as Bar[]);
    cachedTrend = { bars, result };
    return cachedTrend;
}
