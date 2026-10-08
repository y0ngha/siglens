import type { Bar } from '@y0ngha/siglens-core';

/** 메일 차트에 그리는 일봉 수(약 3개월). */
export const REPORT_CHART_BARS = 60;

export interface ChartBox {
    width: number;
    height: number;
    /** 위·아래 여백(px) — 고가·저가 캔들이 테두리에 붙지 않게 한다. */
    padding: number;
}

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

export interface ChartGeometry {
    candles: CandleShape[];
    bodyWidth: number;
    /** 이동평균선 SVG `points` 값. 값이 없으면 빈 문자열. */
    maLines: { period: number; points: string }[];
    high: number;
    low: number;
}

/**
 * 일봉과 이동평균을 SVG 좌표로 바꾼다. 가격 축은 보이는 봉의 고가·저가와 이동평균을
 * 함께 담도록 잡는다 — 이동평균만 범위 밖으로 나가 잘리는 일이 없게 한다.
 *
 * `bars`와 `ma`의 각 배열은 같은 인덱스가 같은 봉이어야 한다(지표 계산 결과 그대로).
 * 마지막 {@link REPORT_CHART_BARS}개만 쓴다. 봉이 없으면 `null`.
 */
export function computeChartGeometry(
    bars: readonly Bar[],
    ma: Readonly<Record<number, readonly (number | null)[]>>,
    box: ChartBox
): ChartGeometry | null {
    const start = Math.max(0, bars.length - REPORT_CHART_BARS);
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

    return { candles, bodyWidth, maLines, high, low };
}
