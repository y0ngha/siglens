import type { Bar } from '@y0ngha/siglens-core';

/** 메일 차트에 그리는 일봉 수(약 3개월). */
export const REPORT_CHART_BARS = 60;

/**
 * 분석 작도가 더 이른 시점에서 시작할 때 창을 넓히는 상한. 메일 폭(536 css px)에서 캔들이 읽히는 한계이고,
 * 넘는 작도는 그리지 않는다.
 */
export const REPORT_CHART_MAX_BARS = 120;

/** 차트에 겹치는 이동평균 기간 — 이미지 라우트와 샘플 차트 데이터가 같은 기간을 쓴다. */
export const REPORT_CHART_MA_PERIODS = [20, 60] as const;

/** 리포트 차트가 그리는 이동평균 기간. */
export type ReportChartMaPeriod = (typeof REPORT_CHART_MA_PERIODS)[number];

/** `period`가 리포트 차트가 그리는 이동평균 기간인지 좁힌다. */
export function isReportChartMaPeriod(
    period: number
): period is ReportChartMaPeriod {
    return REPORT_CHART_MA_PERIODS.some(known => known === period);
}

/** 차트를 그릴 픽셀 상자. */
export interface ChartBox {
    width: number;
    height: number;
    /** 위·아래 여백(px) — 고가·저가 캔들이 테두리에 붙지 않게 한다. */
    padding: number;
}

/** 캔들 하나의 SVG 좌표. */
export interface CandleShape {
    /** 캔들 중심 x. */
    x: number;
    wickTop: number;
    wickBottom: number;
    bodyTop: number;
    /** 시가 = 종가여도 보이도록 최소 1px. */
    bodyHeight: number;
    up: boolean;
}

/** `computeChartGeometry`의 결과 — 이미지 렌더러가 그대로 SVG로 옮긴다. */
export interface ChartGeometry {
    candles: CandleShape[];
    bodyWidth: number;
    /** 이동평균선 SVG `points` 값. 값이 없으면 빈 문자열. */
    maLines: { period: number; points: string }[];
    high: number;
    low: number;
    /** 입력 `bars`에서 첫 보이는 봉의 인덱스. */
    startIndex: number;
    /** 보이는 봉 수. */
    count: number;
    /**
     * 보이는 봉 인덱스(0부터) → x. 캔들·이동평균·작도가 같은 슬롯 계산을 써서 선이 캔들 중심에 정확히 얹힌다.
     */
    xAt: (visibleIndex: number) => number;
    /** 가격 → y. 축 밖의 가격도 그대로 외삽한다(자르는 것은 호출자 몫). */
    yAt: (price: number) => number;
}

/**
 * 일봉과 이동평균을 SVG 좌표로 바꾼다. 가격 축은 보이는 봉의 고가·저가와 이동평균을
 * 함께 담도록 잡는다 — 이동평균만 범위 밖으로 나가 잘리는 일이 없게 한다.
 *
 * `bars`와 `ma`의 각 배열은 같은 인덱스가 같은 봉이어야 한다(지표 계산 결과 그대로).
 * 마지막 `windowSize`개(기본 {@link REPORT_CHART_BARS})만 쓴다. 봉이 없으면 `null`.
 */
export function computeChartGeometry(
    bars: readonly Bar[],
    ma: Readonly<Record<number, readonly (number | null)[]>>,
    box: ChartBox,
    windowSize: number = REPORT_CHART_BARS
): ChartGeometry | null {
    const start = Math.max(0, bars.length - windowSize);
    const visible = bars.slice(start);
    if (visible.length === 0) return null;

    const maVisible = Object.entries(ma).map(([period, values]) => ({
        period: Number(period),
        values: values.slice(start, bars.length),
    }));
    const prices = [
        ...visible.flatMap(b => [b.high, b.low]),
        ...maVisible.flatMap(m =>
            m.values.filter(
                (v): v is number => v !== null && Number.isFinite(v)
            )
        ),
    ];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const span = high - low || 1;
    const plotHeight = box.height - box.padding * 2;
    const y = (price: number) =>
        box.padding + ((high - price) / span) * plotHeight;

    const slot = box.width / visible.length;
    const bodyWidth = Math.max(1, slot * 0.6);
    const xAt = (i: number) => slot * i + slot / 2;

    const candles = visible.map((bar, i) => {
        const top = y(Math.max(bar.open, bar.close));
        const bottom = y(Math.min(bar.open, bar.close));
        return {
            x: xAt(i),
            wickTop: y(bar.high),
            wickBottom: y(bar.low),
            bodyTop: top,
            bodyHeight: Math.max(1, bottom - top),
            up: bar.close >= bar.open,
        };
    });

    const maLines = maVisible.map(m => ({
        period: m.period,
        points: m.values
            .map((v, i) =>
                v === null || !Number.isFinite(v)
                    ? null
                    : `${xAt(i).toFixed(1)},${y(v).toFixed(1)}`
            )
            .filter(p => p !== null)
            .join(' '),
    }));

    return {
        candles,
        bodyWidth,
        maLines,
        high,
        low,
        startIndex: start,
        count: visible.length,
        xAt,
        yAt: y,
    };
}
