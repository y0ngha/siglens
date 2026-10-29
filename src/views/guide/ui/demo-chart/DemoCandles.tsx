/** 데모 차트의 봉(꼬리 + 몸통). */
import type { DemoBar } from '@/views/guide/demos/types';
import type { DemoChartFrame } from '@/views/guide/lib/demoChartLayout';
import { TONE_FILL, TONE_STROKE } from '@/views/guide/ui/guideChartStyles';

/** 꼬리 굵기 상한(viewBox 단위) — 봉이 넓어져도 꼬리가 몸통처럼 두꺼워 보이지 않게 한다. */
const WICK_MAX_WIDTH = 1.4;
/** 꼬리 굵기 하한(viewBox 단위) — 봉이 촘촘해도 꼬리가 가늘어져 사라지지 않게 한다. */
const WICK_MIN_WIDTH = 0.9;
/** 꼬리 굵기는 몸통 폭의 이 비율이다(상·하한 안에서) — 봉 폭이 바뀌어도 꼬리와 몸통의 비례가 유지된다. */
const WICK_BODY_RATIO = 0.12;
/** 몸통 최소 높이(viewBox 단위) — 시가와 종가가 같은 봉(도지)도 몸통이 선으로 보이게 한다. */
const MIN_BODY_HEIGHT = 1.2;

interface DemoCandlesProps {
    readonly bars: readonly DemoBar[];
    readonly frame: DemoChartFrame;
}

/** 봉 색은 `tone`이 있으면 그 의미색, 없으면 종가 ≥ 시가로 상승/하락색이다. */
export function DemoCandles({ bars, frame }: DemoCandlesProps) {
    const { xOf, yOf, bodyWidth } = frame;
    const wickWidth = Math.min(
        WICK_MAX_WIDTH,
        Math.max(WICK_MIN_WIDTH, bodyWidth * WICK_BODY_RATIO)
    );
    return bars.map((bar, index) => {
        const tone = bar.tone ?? (bar.close >= bar.open ? 'bull' : 'bear');
        const x = xOf(index);
        const top = yOf(Math.max(bar.open, bar.close));
        const bottom = yOf(Math.min(bar.open, bar.close));
        return (
            <g key={bar.time}>
                <line
                    className={TONE_STROKE[tone]}
                    shapeRendering="crispEdges"
                    strokeWidth={wickWidth}
                    x1={x}
                    x2={x}
                    y1={yOf(bar.high)}
                    y2={yOf(bar.low)}
                />
                <rect
                    className={TONE_FILL[tone]}
                    height={Math.max(MIN_BODY_HEIGHT, bottom - top)}
                    width={bodyWidth}
                    x={x - bodyWidth / 2}
                    y={top}
                />
            </g>
        );
    });
}
