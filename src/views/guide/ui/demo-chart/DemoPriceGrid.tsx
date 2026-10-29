/** 데모 차트 가격 영역의 가로 눈금선과 오른쪽 가격 라벨. */
import { formatTick } from '@/views/guide/lib/chartLayout';
import {
    DEMO_AXIS_TEXT_GAP,
    DEMO_CHART_FONT,
    type DemoChartFrame,
} from '@/views/guide/lib/demoChartLayout';

interface DemoPriceGridProps {
    readonly frame: DemoChartFrame;
}

/** 눈금마다 선 하나와 가격 하나. 소수 자릿수는 눈금 간격을 따른다(`formatTick`). */
export function DemoPriceGrid({ frame }: DemoPriceGridProps) {
    const { plot, yOf } = frame;
    return frame.ticks.map(tick => (
        <g key={tick}>
            <line
                className="stroke-secondary-700"
                strokeWidth={0.75}
                x1={plot.left}
                x2={plot.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
            />
            <text
                className="fill-secondary-400"
                dominantBaseline="central"
                fontSize={DEMO_CHART_FONT - 1}
                x={plot.right + DEMO_AXIS_TEXT_GAP}
                y={yOf(tick)}
            >
                {formatTick(tick, frame.tickStep)}
            </text>
        </g>
    ));
}
