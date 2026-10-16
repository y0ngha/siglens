import type { CSSProperties } from 'react';

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

/** 막대가 너무 얇아져 사라지지 않게 하는 최소 높이(%). 0이 아닌 값에만 적용된다. */
const MIN_BAR_PCT = 3;

/**
 * 한 방향 막대 그래프 — `TrendLineChart`와 같은 틀(왼쪽 눈금 열 · 테두리 상자 · 아래 양끝 라벨, 높이 고정)에 선 대신 막대를
 * 세운다. 막대는 HTML이고 높이는 CSS 변수로 준다(TW-1). 막대 하나가 값 하나라 행이 없는 날(실패가 없던 결제일)은 칸도 없다 —
 * 날짜 간격을 재현하지 않으므로 양끝 라벨로 구간만 밝힌다. 높이가 고정이라 데이터가 바뀌어도 레이아웃이 움직이지 않는다.
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
                <div
                    aria-hidden="true"
                    className="flex h-32 w-14 shrink-0 flex-col justify-between text-right text-xs text-secondary-400 tabular-nums"
                >
                    <span>{maxLabel}</span>
                    <span>{zeroLabel}</span>
                </div>
                <div
                    role="img"
                    aria-label={ariaLabel}
                    className="flex h-32 min-w-0 flex-1 items-end gap-px rounded border border-secondary-700 px-1 pt-1"
                >
                    {bars.map(bar => {
                        const pct =
                            bar.value <= 0
                                ? 0
                                : Math.max(
                                      MIN_BAR_PCT,
                                      Math.round((bar.value / max) * 100)
                                  );
                        // 안전한 캐스트: 값은 이 파일이 만든 `%` 문자열 하나뿐이다.
                        const style = { '--bar-h': `${pct}%` } as CSSProperties;
                        return (
                            <span
                                key={bar.date}
                                aria-hidden="true"
                                style={style}
                                className="h-(--bar-h) min-w-0 flex-1 rounded-t-sm bg-primary-400"
                            />
                        );
                    })}
                </div>
            </div>
            <div
                aria-hidden="true"
                className="mt-1 flex justify-between pl-16 font-mono text-xs text-secondary-400 tabular-nums"
            >
                <span>{startLabel}</span>
                <span>{endLabel}</span>
            </div>
        </div>
    );
}
