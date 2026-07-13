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
    isFreeTier?: boolean;
    isTierHydrated?: boolean;
}

export function TimeframeSelector({
    value,
    onChange,
    isFreeTier = false,
    isTierHydrated = true,
}: TimeframeSelectorProps) {
    return (
        <div className="flex w-full items-center gap-1 sm:w-auto">
            {TIMEFRAMES.map(timeframe => {
                const isLocked =
                    !isTierHydrated || (isFreeTier && timeframe !== '1Day');

                return (
                    <button
                        key={timeframe}
                        type="button"
                        disabled={isLocked}
                        title={
                            !isTierHydrated
                                ? '권한을 확인하는 중입니다.'
                                : isLocked
                                  ? '회원 전용 시간 프레임입니다.'
                                  : undefined
                        }
                        onClick={() => onChange(timeframe)}
                        className={cn(
                            'focus-visible:ring-primary-500 flex-1 touch-manipulation rounded border px-2 py-1 text-center text-sm font-medium transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-3',
                            timeframe === value
                                ? 'border-primary-400 text-primary-400'
                                : 'text-secondary-400 hover:text-secondary-200 border-transparent'
                        )}
                    >
                        {TIMEFRAME_LABEL[timeframe]}
                    </button>
                );
            })}
        </div>
    );
}
