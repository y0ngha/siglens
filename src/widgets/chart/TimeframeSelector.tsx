'use client';

import { useTranslations } from 'next-intl';
import { TIMEFRAMES } from '@/shared/config/market';
import type { Timeframe } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
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
    // 티어를 아직 모르는 동안은 진짜 비활성(네이티브 disabled) — 아무 일도 일어나면 안 된다.
    const isPending = !isTierHydrated;
    return (
        <div className="flex w-full items-center gap-1 sm:w-auto">
            {TIMEFRAMES.map(timeframe => {
                // 무료 등급의 잠긴 프레임. `disabled`가 아니라 `aria-disabled`다 — 네이티브
                // disabled는 클릭 이벤트를 삼켜 "잠긴 프레임을 눌렀다"(가입 퍼널
                // `gate_clicked{timeframe}`)를 셀 수 없다. 보조기술에는 여전히 비활성으로
                // 읽히고, 눌러도 프레임은 바뀌지 않으며 툴팁(회원 전용)은 그대로다.
                const isLocked =
                    !isPending && isFreeTier && timeframe !== '1Day';
                const handleClick = (): void => {
                    if (isLocked) {
                        trackFunnelEvent('gate_clicked', { gate: 'timeframe' });
                        return;
                    }
                    onChange(timeframe);
                };

                return (
                    <button
                        key={timeframe}
                        type="button"
                        disabled={isPending}
                        aria-disabled={isLocked || undefined}
                        title={
                            isPending
                                ? t('TimeframeSelector.fd0418')
                                : isLocked
                                  ? t('TimeframeSelector.a4632e')
                                  : undefined
                        }
                        onClick={handleClick}
                        className={cn(
                            'focus-visible:ring-primary-500 flex-1 touch-manipulation rounded border px-2 py-1 text-center text-sm font-medium transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:text-secondary-500 aria-disabled:cursor-not-allowed aria-disabled:text-secondary-500 sm:flex-none sm:px-3',
                            timeframe === value
                                ? 'border-primary-400 text-primary-400'
                                : isLocked
                                  ? 'border-transparent'
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
