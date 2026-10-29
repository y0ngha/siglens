/** 데모 차트의 봉(꼬리 + 몸통). */
import type { DemoBar } from '@/views/guide/demos/types';
import type { DemoChartFrame } from '@/views/guide/lib/demoChartLayout';
import { TONE_FILL, TONE_STROKE } from '@/views/guide/ui/guideChartStyles';

interface DemoCandlesProps {
    readonly bars: readonly DemoBar[];
    readonly frame: DemoChartFrame;
}

/** 봉 색은 `tone`이 있으면 그 의미색, 없으면 종가 ≥ 시가로 상승/하락색이다. */
export function DemoCandles({ bars, frame }: DemoCandlesProps) {
    const { xOf, yOf, bodyWidth } = frame;
    const wickWidth = Math.min(1.4, Math.max(0.9, bodyWidth * 0.12));
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
                    height={Math.max(1.2, bottom - top)}
                    width={bodyWidth}
                    x={x - bodyWidth / 2}
                    y={top}
                />
            </g>
        );
    });
}
