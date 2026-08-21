'use client';

import { useTranslations } from 'next-intl';
import { TIMEFRAMES } from '@/shared/config/market';
import type { Timeframe } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { timeframeLabel } from '@/shared/lib/timeframeLabel';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';

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
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
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
                                ? t('TimeframeSelector.fd0418')
                                : isLocked
                                  ? t('TimeframeSelector.a4632e')
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
                        {timeframeLabel(timeframe, locale)}
                    </button>
                );
            })}
        </div>
    );
}
