import { cn } from '@/shared/lib/cn';

interface SparklineProps {
    /** 오래된 것부터의 종가. 2개 미만이면 아무것도 그리지 않는다. */
    values: readonly number[];
    className?: string;
}

const WIDTH = 64;
const HEIGHT = 24;
/** 선이 위아래 가장자리에 붙어 잘리지 않게 두는 여백(viewBox 단위). */
const PAD = 2;
/** 값이 모두 같을 때(변동 0) 선을 그릴 높이 비율 — 가운데 수평선. */
const FLAT_RATIO = 0.5;
/** 선 굵기(px). `non-scaling-stroke`라 카드 크기와 무관하게 이 굵기다. */
const STROKE_WIDTH = 1.5;

/** `values`를 viewBox 좌표의 polyline `points`로 바꾼다. 값이 모두 같으면 가운데 수평선이다. */
export function sparklinePoints(values: readonly number[]): string {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const step = WIDTH / (values.length - 1);
    return values
        .map((value, index) => {
            const ratio = range === 0 ? FLAT_RATIO : (value - min) / range;
            const y = HEIGHT - PAD - ratio * (HEIGHT - PAD * 2);
            return `${(index * step).toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
}

/**
 * 관심종목 행의 "5일 흐름" 미니 차트. 장식이다 — 수치는 옆의 가격·등락률이 전달하므로
 * 보조기술에는 숨긴다. 색은 `currentColor`라 부모가 등락 색 클래스를 준다.
 */
export function Sparkline({ values, className }: SparklineProps) {
    if (values.length < 2) return null;
    return (
        <svg
            aria-hidden="true"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
