'use client';

import { TIMEFRAMES } from '@/shared/config/market';
import type { Timeframe } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

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
        <div className="flex w-full items-center gap-1 sm:w-auto">
            {TIMEFRAMES.map(timeframe => (
                <button
                    key={timeframe}
                    type="button"
                    onClick={() => onChange(timeframe)}
                    className={cn(
                        'focus-visible:ring-primary-500 flex-1 touch-manipulation rounded border px-2 py-1 text-center text-sm font-medium transition-colors focus-visible:ring-1 sm:flex-none sm:px-3',
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
