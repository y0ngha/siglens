import {
    calculateIndicators,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import {
    barTime,
    mulberry32,
    pathToBars,
    toCoreBars,
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

function buildSharedSeries(): SharedSeries {
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
    return { bars, result: calculateIndicators(toCoreBars(bars)) };
}

// 시드 고정이라 결정적이고 260봉 계산이 싸다 — 모듈 로드 때 한 번 만들어 둔다.
const SHARED_SERIES = buildSharedSeries();

export function getSharedSeries(): SharedSeries {
    return SHARED_SERIES;
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

function divergenceVolumeFactor(index: number): number {
    if (index < DIVERGENCE_LOW_1) return 1.9;
    if (index < 44) return 2.4;
    if (index < DIVERGENCE_LOW_2) return 0.6;
    return 2.2;
}

function buildDivergenceSeries(): SharedSeries {
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
    return { bars, result: calculateIndicators(toCoreBars(bars)) };
}

const DIVERGENCE_SERIES = buildDivergenceSeries();

export function getDivergenceSeries(): SharedSeries {
    return DIVERGENCE_SERIES;
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

function buildTrendSeries(): SharedSeries {
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
    return { bars, result: calculateIndicators(toCoreBars(bars)) };
}

const TREND_SERIES = buildTrendSeries();

export function getTrendSeries(): SharedSeries {
    return TREND_SERIES;
}

/** 표준정규 난수 (Box-Muller). 시드 고정 `rand`를 받아 결정적이다. */
function gaussian(rand: () => number): number {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * 종가열에서 봉을 만든다: 시가는 직전 종가, 고가·저가는 `rangeAt(i)`(가격 대비 비율)에
 * 시드 고정 흔들림을 더해 몸통 밖으로 뻗는다.
 */
function barsFromCloses(
    closes: readonly number[],
    rangeAt: (index: number) => number,
    rand: () => number
): DemoBar[] {
    return closes.map((close, index) => {
        const open = index === 0 ? close : closes[index - 1];
        const wick = close * rangeAt(index);
        return {
            time: barTime(index),
            open,
            high: Math.max(open, close) + wick * (0.3 + rand() * 0.7),
            low: Math.min(open, close) - wick * (0.3 + rand() * 0.7),
            close,
            volume: Math.round(BASE_VOLUME * (0.8 + rand() * 0.4)),
        };
    });
}

/**
 * 장중(5분봉) 합성 시세 하루치 (78봉 = 미국 정규장 6.5시간).
 * 같은 UTC 날짜 안에 있어야 core VWAP이 하루 동안 누적한다 (날짜가 바뀌면 리셋).
 * 거래량은 장 초반·마감에 몰리고, 가격이 VWAP 아래로 내려갔다가
 * 거래량이 실린 봉(INTRADAY_PATH의 54~60번째 봉 구간)으로 다시 올라선다.
 */
export const INTRADAY_BARS = 78;
const INTRADAY_OPEN_TIME = barTime(0) + 52_200; // 14:30 UTC
const INTRADAY_STEP_SECONDS = 300;

const INTRADAY_PATH: Waypoint[] = [
    [0, 100],
    [12, 103.5],
    [30, 100],
    [44, 98.6],
    [54, 99],
    [60, 102.5],
    [77, 105],
].map(([i, price]) => ({ i, price }));

function intradayVolumeFactor(index: number): number {
    const fromEdge = Math.min(index, INTRADAY_BARS - 1 - index);
    const sessionShape = 1 + 2.2 * Math.exp(-fromEdge / 7);
    // 되돌림 이후 위로 올라서는 구간(55~59봉)은 거래량이 크게 실린다.
    return index >= 55 && index <= 59 ? sessionShape + 3 : sessionShape;
}

function buildIntradaySeries(): SharedSeries {
    const raw = pathToBars(INTRADAY_PATH, {
        seed: 12,
        rangePct: 0.004,
        noisePct: 0.006,
    });
    const rand = mulberry32(31);
    const bars: DemoBar[] = raw.map((bar, index) => ({
        ...bar,
        time: INTRADAY_OPEN_TIME + index * INTRADAY_STEP_SECONDS,
        volume: Math.round(
            BASE_VOLUME *
                0.2 *
                intradayVolumeFactor(index) *
                (0.85 + rand() * 0.3)
        ),
    }));
    return { bars, result: calculateIndicators(toCoreBars(bars)) };
}

const INTRADAY_SERIES = buildIntradaySeries();

export function getIntradaySeries(): SharedSeries {
    return INTRADAY_SERIES;
}

/**
 * 장세 전환 합성 시세 (260봉): 앞쪽은 수익률이 같은 방향으로 이어지는 추세 구간
 * (자기상관 +), 뒤쪽은 기준선 둘레를 오르내리는 평균회귀 구간(자기상관 -).
 * 허스트(100봉 창)와 분산비율(60봉 창)이 두 구간에서 서로 다른 쪽으로 가는 걸 보여 준다.
 */
export const REGIME_TREND_END = 120;
export const REGIME_TOTAL_BARS = 260;

function buildRegimeSeries(): SharedSeries {
    const rand = mulberry32(13);
    const closes: number[] = [100];
    let lastReturn = 0;
    let deviation = 0;
    let anchor = 0;
    for (let i = 1; i < REGIME_TOTAL_BARS; i++) {
        if (i < REGIME_TREND_END) {
            // AR(1) 수익률 + 약한 상승 drift: 한 번 간 방향으로 계속 간다.
            lastReturn = 0.7 * lastReturn + 0.004 * gaussian(rand) + 0.0009;
            closes.push(closes[i - 1] * Math.exp(lastReturn));
            anchor = Math.log(closes[i]);
        } else {
            // 로그 가격이 anchor 둘레를 도는 OU 과정: 오르면 되돌아오고 내리면 되튄다.
            deviation = 0.3 * deviation + 0.018 * gaussian(rand);
            closes.push(Math.exp(anchor + deviation));
        }
    }
    const bars = barsFromCloses(closes, () => 0.006, mulberry32(77));
    return { bars, result: calculateIndicators(toCoreBars(bars)) };
}

const REGIME_SERIES = buildRegimeSeries();

export function getRegimeSeries(): SharedSeries {
    return REGIME_SERIES;
}

/**
 * 변동성 확대·수축 합성 시세 (150봉): 잔잔하다가 봉 폭이 점점 커지고 다시 잦아든다.
 * ATR이 오르고 내리는 모습을 보여 주려고 일간 변동폭(`volatilityAt`: 잔잔한 구간 0.7% ~ 격한 구간 3.3%)을 구간별로 정한다.
 */
export const VOLATILITY_BARS = 150;

function volatilityAt(index: number): number {
    if (index < 35) return 0.007;
    if (index < 70) return 0.007 + ((index - 35) / 35) * 0.026;
    if (index < 90) return 0.033;
    if (index < 125) return 0.033 - ((index - 90) / 35) * 0.026;
    return 0.007;
}

function buildVolatilitySeries(): SharedSeries {
    const rand = mulberry32(14);
    const closes: number[] = [100];
    for (let i = 1; i < VOLATILITY_BARS; i++) {
        closes.push(
            closes[i - 1] *
                Math.exp(0.0008 + volatilityAt(i) * 0.7 * gaussian(rand))
        );
    }
    const bars = barsFromCloses(
        closes,
        index => volatilityAt(index) * 0.8,
        mulberry32(52)
    );
    return { bars, result: calculateIndicators(toCoreBars(bars)) };
}

const VOLATILITY_SERIES = buildVolatilitySeries();

export function getVolatilitySeries(): SharedSeries {
    return VOLATILITY_SERIES;
}
