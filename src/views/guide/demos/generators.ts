import type { Bar } from '@y0ngha/siglens-core';
import type { DemoBar } from '@/views/guide/demos/types';

/** 데모 봉의 첫 시각(2024-01-02 00:00 UTC)과 간격(1일). 의미는 없고 단조 증가만 필요하다. */
const BASE_TIME = 1_704_153_600;
const BAR_SECONDS = 86_400;

export interface Waypoint {
    i: number;
    price: number;
}

export interface PathBarsOptions {
    seed: number;
    /** 한 봉의 평균 몸통+꼬리 폭 (가격 대비 비율). */
    rangePct?: number;
    /** 웨이포인트 사이 종가의 흔들림 폭 (가격 대비 비율). 웨이포인트에서는 0이 된다. */
    noisePct?: number;
    /** 거래량 기준값. 주면 volume을 채운다. */
    volume?: number;
}

/**
 * 시드 고정 의사난수 (mulberry32). 같은 시드는 항상 같은 수열을 낸다.
 * `state`는 호출마다 전진하는 PRNG 상태라 클로저 안 가변 변수가 이 알고리즘의 정의다
 * (reduce로 풀면 호출 순서를 호출부가 떠안는다).
 */
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

/**
 * 데모 봉을 core `Bar`로 좁힌다. `volume`만 선택값이라 형이 어긋날 뿐 값은 그대로 넘긴다
 * (`tone`은 core가 읽지 않는다). 호출부마다 단언을 흩뿌리지 않으려고 한 곳에 둔다.
 */
export function toCoreBars(bars: readonly DemoBar[]): Bar[] {
    return bars as Bar[];
}

export function barTime(index: number): number {
    return BASE_TIME + index * BAR_SECONDS;
}

/** 손으로 정한 OHLC로 봉 하나를 만든다. 시각은 나중에 `withTimes`가 매긴다. */
export function candle(
    open: number,
    high: number,
    low: number,
    close: number,
    volume?: number
): DemoBar {
    return { time: 0, open, high, low, close, volume };
}

/** 봉 목록의 시각을 0부터 순서대로 다시 매긴다. */
export function withTimes(bars: readonly DemoBar[]): DemoBar[] {
    return bars.map((bar, index) => ({ ...bar, time: barTime(index) }));
}

type Extremum = 'peak' | 'trough' | 'edge';

function classifyWaypoints(points: readonly Waypoint[]): Extremum[] {
    return points.map((point, index) => {
        const prev = points[index - 1];
        const next = points[index + 1];
        if (prev === undefined || next === undefined) return 'edge';
        if (point.price > prev.price && point.price > next.price) return 'peak';
        if (point.price < prev.price && point.price < next.price)
            return 'trough';
        return 'edge';
    });
}

/**
 * 웨이포인트(꼭짓점)를 지나가는 OHLC 봉열을 만든다.
 *
 * - 웨이포인트가 극값(두 이웃보다 높거나 낮음)이면 그 봉의 고가/저가가 정확히 그 가격이다.
 *   추세선·넥라인이 꼭짓점의 꼬리에 맞닿아 보이게 하려는 것이다.
 * - 그 외 봉은 웨이포인트 사이를 보간한 종가에 시드 고정 노이즈를 얹는다.
 * - 극값 근처 봉은 극값을 넘지 않게 눌러서, "두 고점이 같다" 같은 설명이 그림과 어긋나지 않게 한다.
 */
export function pathToBars(
    waypoints: readonly Waypoint[],
    options: PathBarsOptions
): DemoBar[] {
    if (waypoints.length < 2) return [];
    const rand = mulberry32(options.seed);
    const rangePct = options.rangePct ?? 0.016;
    const noisePct = options.noisePct ?? 0.006;
    const kinds = classifyWaypoints(waypoints);
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    const count = last.i - first.i + 1;

    const anchorClose = (index: number): number => {
        const point = waypoints[index];
        const half = point.price * rangePct * 0.35;
        if (kinds[index] === 'peak') return point.price - half;
        if (kinds[index] === 'trough') return point.price + half;
        return point.price;
    };

    const closes: number[] = [];
    for (let i = 0; i < count; i++) {
        const abs = first.i + i;
        let seg = 0;
        while (seg < waypoints.length - 2 && abs > waypoints[seg + 1].i) seg++;
        const a = waypoints[seg];
        const b = waypoints[seg + 1];
        const t = b.i === a.i ? 0 : (abs - a.i) / (b.i - a.i);
        const base =
            anchorClose(seg) + (anchorClose(seg + 1) - anchorClose(seg)) * t;
        const noise =
            (rand() * 2 - 1) * noisePct * base * Math.sin(Math.PI * t);
        closes.push(base + noise);
    }

    const bounds = waypoints.map((point, index) => ({
        i: point.i - first.i,
        price: point.price,
        kind: kinds[index],
    }));
    const isWaypointBar = (index: number) =>
        bounds.some(bound => bound.i === index);

    const bars: DemoBar[] = [];
    for (let i = 0; i < count; i++) {
        const open = i === 0 ? closes[0] * (1 - rangePct * 0.2) : closes[i - 1];
        const close = closes[i];
        const body = Math.max(open, close) - Math.min(open, close);
        const wick = close * rangePct * (0.15 + rand() * 0.35);
        let high = Math.max(open, close) + wick * (0.4 + rand() * 0.6);
        let low = Math.min(open, close) - wick * (0.4 + rand() * 0.6);
        if (body === 0) high += wick * 0.2;
        bars.push({
            time: barTime(i),
            open,
            high,
            low,
            close,
            volume:
                options.volume === undefined
                    ? undefined
                    : Math.round(options.volume * (0.7 + rand() * 0.6)),
        });
    }

    // 극값 근처 봉을 극값 안쪽으로 눌러서 극값 봉만 진짜 고점/저점이 되게 한다.
    for (const bound of bounds) {
        if (bound.kind === 'edge') continue;
        for (let offset = -3; offset <= 3; offset++) {
            const idx = bound.i + offset;
            const bar = bars[idx];
            if (bar === undefined || isWaypointBar(idx)) continue;
            if (bound.kind === 'peak') {
                const cap = bound.price * 0.9985;
                bar.open = Math.min(bar.open, cap);
                bar.close = Math.min(bar.close, cap);
                bar.high = Math.min(bar.high, cap);
            } else {
                const floor = bound.price * 1.0015;
                bar.open = Math.max(bar.open, floor);
                bar.close = Math.max(bar.close, floor);
                bar.low = Math.max(bar.low, floor);
            }
            bar.high = Math.max(bar.high, bar.open, bar.close);
            bar.low = Math.min(bar.low, bar.open, bar.close);
        }
        const bar = bars[bound.i];
        if (bound.kind === 'peak') {
            bar.high = bound.price;
            bar.open = Math.min(bar.open, bound.price);
            bar.close = Math.min(bar.close, bound.price);
        } else {
            bar.low = bound.price;
            bar.open = Math.max(bar.open, bound.price);
            bar.close = Math.max(bar.close, bound.price);
        }
        bar.high = Math.max(bar.high, bar.open, bar.close);
        bar.low = Math.min(bar.low, bar.open, bar.close);
    }
    return bars;
}

/** 두 가격 사이를 잇는 단순 추세 봉열 (`pathToBars`의 두 점 버전). */
export function trendBars(
    count: number,
    from: number,
    to: number,
    options: PathBarsOptions
): DemoBar[] {
    return pathToBars(
        [
            { i: 0, price: from },
            { i: count - 1, price: to },
        ],
        options
    );
}

/** 봉열을 이어 붙이고 시각을 다시 매긴다. */
export function concatBars(
    ...parts: readonly (readonly DemoBar[])[]
): DemoBar[] {
    return withTimes(parts.flat());
}

/** 값 배열의 [start, end) 구간을 잘라 낸다. */
export function sliceValues<T>(
    values: readonly T[],
    start: number,
    end: number
): T[] {
    return values.slice(start, end);
}
