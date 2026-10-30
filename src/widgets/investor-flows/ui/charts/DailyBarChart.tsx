/**
 * 한 방향 막대 그래프 — 결제 불이행처럼 날짜별 양을 막대로 보인다.
 */
import type { CSSProperties } from 'react';
import { barHeightPercent } from '../../utils/barChart';
import { AxisEndLabels, ScaleTicks } from './ChartScaleParts';

/** 막대 하나 — 날짜와 값. */
export interface DailyBar {
    /** React key와 툴팁용 날짜(`YYYY-MM-DD`). */
    readonly date: string;
    /** 0 이상. */
    readonly value: number;
}

interface DailyBarChartProps {
    /** 오래된 → 최신. */
    readonly bars: readonly DailyBar[];
    /** 막대 높이의 기준(가장 큰 값). 0이면 그리지 않는다. */
    readonly max: number;
    /** 스크린리더용 한 줄 요약(그래프 자체는 `role="img"`로 이름만 읽힌다). */
    readonly ariaLabel: string;
    /** 위 눈금 라벨(이미 포맷된 문자열). 아래는 0이다. */
    readonly maxLabel: string;
    readonly zeroLabel: string;
    /** 가로축 양끝 라벨. */
    readonly startLabel: string;
    readonly endLabel: string;
}

/**
 * `TrendLineChart`와 같은 틀(왼쪽 눈금 열 · 테두리 상자 · 아래 양끝 라벨, 높이 고정)에 선 대신 막대를 세운다. 막대는 HTML이고
 * 높이는 CSS 변수로 준다(TW-1). 막대 하나가 값 하나라 행이 없는 날(실패가 없던 결제일)은 칸도 없다 — 날짜 간격을 재현하지
 * 않으므로 양끝 라벨로 구간만 밝힌다. 높이가 고정이라 데이터가 바뀌어도 레이아웃이 움직이지 않는다.
 */
export function DailyBarChart({
    bars,
    max,
    ariaLabel,
    maxLabel,
    zeroLabel,
    startLabel,
    endLabel,
}: DailyBarChartProps) {
    if (bars.length === 0 || max <= 0) return null;
    return (
        <div>
            <div className="flex gap-2">
                <ScaleTicks top={maxLabel} bottom={zeroLabel} />
                <div
                    role="img"
                    aria-label={ariaLabel}
                    className="flex h-32 min-w-0 flex-1 items-end gap-px rounded border border-secondary-700 px-1 pt-1"
                >
                    {bars.map(bar => (
                        <span
                            key={bar.date}
                            aria-hidden="true"
                            // 안전한 캐스트: 값은 `%` 문자열 하나뿐이다.
                            style={
                                {
                                    '--bar-h': `${barHeightPercent(bar.value, max)}%`,
                                } as CSSProperties
                            }
                            className="h-(--bar-h) min-w-0 flex-1 rounded-t-sm bg-primary-400"
                        />
                    ))}
                </div>
            </div>
            <AxisEndLabels start={startLabel} end={endLabel} />
        </div>
    );
}
