'use client';

import { TIMEFRAMES } from '@/domain/constants/market';
import type { Timeframe } from '@/domain/types';
import { cn } from '@/lib/cn';

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
    '5Min': '5분',
    '15Min': '15분',
    '30Min': '30분',
    '1Hour': '1시간',
    '4Hour': '4시간',
    '1Day': '1일',
};

interface TimeframeSelectorProps {
    value: Timeframe;
    onChange: (timeframe: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
    return (
        <div className="flex items-center gap-1">
            {TIMEFRAMES.map(timeframe => (
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
