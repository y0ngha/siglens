'use client';

/**
 * 실적 비교의 막대 한 줄 — 라벨, 막대, 값을 3열 그리드로 놓는다.
 */
import { getBarStyle, getBarWidth } from '../../utils/earningsBars';

interface MetricBarProps {
    label: string;
    value: number | null;
    maxValue: number;
    format: (value: number | null) => string;
    className: string;
    signed: boolean;
}

/** 값이 음수면 위험색, 아니면 `className` 색으로 그린다. 값이 없으면 막대 없이 대시만 보인다. */
export function MetricBar({
    label,
    value,
    maxValue,
    format,
    className,
    signed,
}: MetricBarProps) {
    const width = getBarWidth(value, maxValue, signed);
    const isNegative = value !== null && value < 0;
    const barClassName = isNegative ? 'bg-ui-danger' : className;

    return (
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2">
            <span className="text-xs text-secondary-500">{label}</span>
            <div className="relative h-2 rounded-full bg-secondary-900">
                {signed ? (
                    <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px bg-secondary-600" />
                ) : null}
                {value !== null ? (
                    <div
                        className={`absolute top-0 h-2 rounded-full ${barClassName}`}
                        style={getBarStyle(value, width, signed)}
                        aria-label={`${label}: ${format(value)}`}
                    />
                ) : null}
            </div>
            <span className="text-right text-xs text-secondary-400 tabular-nums">
                {format(value)}
            </span>
        </div>
    );
}
