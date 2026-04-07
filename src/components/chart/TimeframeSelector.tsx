'use client';

import type { Timeframe } from '@/domain/types';
import { cn } from '@/lib/cn';

// TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
export const TIMEFRAME_OPTIONS: Timeframe[] = [
    // '1Min',
    // '5Min',
    // '15Min',
    // '1Hour',
    '1Day',
];

// TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
const TIMEFRAME_LABEL: Record<Timeframe, string> = {
    // '1Min': '1분',
    // '5Min': '5분',
    // '15Min': '15분',
    // '1Hour': '1시간',
    '1Day': '1일',
};

interface TimeframeSelectorProps {
    value: Timeframe;
    onChange: (timeframe: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
    return (
        <div className="flex items-center gap-1">
            {TIMEFRAME_OPTIONS.map(timeframe => (
                <button
                    key={timeframe}
                    type="button"
                    onClick={() => onChange(timeframe)}
                    className={cn(
                        'focus-visible:ring-primary-500 rounded border px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-1',
                        timeframe === value
                            ? 'border-primary-400 text-primary-400'
                            : 'text-secondary-400 hover:text-secondary-200 border-transparent'
                    )}
                >
                    {TIMEFRAME_LABEL[timeframe]}
                </button>
            ))}
        </div>
    );
}
