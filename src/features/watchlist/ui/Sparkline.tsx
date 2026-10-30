import { cn } from '@/shared/lib/cn';
import {
    SPARKLINE_HEIGHT,
    SPARKLINE_WIDTH,
    sparklinePoints,
} from '../lib/sparklinePoints';

interface SparklineProps {
    /** 오래된 것부터의 종가. 2개 미만이면 아무것도 그리지 않는다. */
    values: readonly number[];
    className?: string;
}

/** 선 굵기(px). `non-scaling-stroke`라 카드 크기와 무관하게 이 굵기다. */
const STROKE_WIDTH = 1.5;

/**
 * 관심종목 행의 "5일 흐름" 미니 차트. 장식이다 — 수치는 옆의 가격·등락률이 전달하므로
 * 보조기술에는 숨긴다. 색은 `currentColor`라 부모가 등락 색 클래스를 준다.
 */
export function Sparkline({ values, className }: SparklineProps) {
    if (values.length < 2) return null;
    return (
        <svg
            aria-hidden="true"
            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
            preserveAspectRatio="none"
            className={cn('h-6 w-16 shrink-0', className)}
        >
            <polyline
                points={sparklinePoints(values)}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
