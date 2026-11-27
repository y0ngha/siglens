'use client';

/**
 * 차트 타임프레임 선택 컨트롤(무료 티어 제한 반영).
 */

import type { Timeframe } from '@y0ngha/siglens-core';
import { useTranslations } from 'next-intl';
import { TIMEFRAMES } from '@/shared/config/market';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { timeframeLabel } from '@/shared/lib/timeframeLabel';

interface TimeframeSelectorProps {
    value: Timeframe;
    onChange: (timeframe: Timeframe) => void;
    isFreeTier?: boolean;
    isTierHydrated?: boolean;
    /**
     * 버튼으로 보여줄 타임프레임 — 종목의 시장 프로필 `allowedTimeframes`를 넘긴다(한국 종목에는
     * 4시간, 크립토에는 15·30분·4시간처럼 제공처가 못 주는 프레임이 없어야 빈 차트가 안 나온다).
     * 생략하면 전체(`TIMEFRAMES`).
     */
    timeframes?: readonly Timeframe[];
    /**
     * 잠긴 프레임을 눌렀을 때 부른다(가입 안내 모달을 여는 쪽). 터치 기기에는 `title` 툴팁이
     * 뜨지 않아 왜 바뀌지 않는지 알릴 수단이 이것뿐이다. 선택 값인 이유: 모달을 가진 provider 밖에서도
     * 셀렉터를 쓸 수 있게 — 없으면 퍼널 이벤트만 남는다.
     */
    onLockedClick?: () => void;
}

export function TimeframeSelector({
    value,
    onChange,
    isFreeTier = false,
    isTierHydrated = true,
    timeframes = TIMEFRAMES,
    onLockedClick,
}: TimeframeSelectorProps) {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    // 티어를 아직 모르는 동안은 진짜 비활성(네이티브 disabled) — 아무 일도 일어나면 안 된다.
    const isPending = !isTierHydrated;
    return (
        <div className="flex w-full items-center gap-1 sm:w-auto">
            {timeframes.map(timeframe => {
                // 무료 등급의 잠긴 프레임. `disabled`가 아니라 `aria-disabled`다 — 네이티브
                // disabled는 클릭 이벤트를 삼켜 "잠긴 프레임을 눌렀다"(가입 퍼널
                // `gate_clicked{timeframe}`)를 셀 수 없다. 보조기술에는 여전히 비활성으로
                // 읽히고, 눌러도 프레임은 바뀌지 않으며 툴팁(회원 전용)은 그대로다. 터치
                // 기기에는 `title` 툴팁이 뜨지 않으므로 `onLockedClick`이 여는 가입 안내가
                // "왜 안 바뀌는지"를 알리는 유일한 피드백이다.
                const isLocked =
                    !isPending && isFreeTier && timeframe !== '1Day';
                const titleOf = (): string | undefined => {
                    if (isPending) return t('TimeframeSelector.fd0418');
                    return isLocked ? t('TimeframeSelector.a4632e') : undefined;
                };
                const handleClick = (): void => {
                    if (isLocked) {
                        trackFunnelEvent('gate_clicked', { gate: 'timeframe' });
                        onLockedClick?.();
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
                        title={titleOf()}
                        onClick={handleClick}
                        className={cn(
                            'focus-visible:ring-primary-500 flex-1 touch-manipulation rounded border px-2 py-1 text-center text-sm font-medium transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:text-secondary-500 aria-disabled:cursor-not-allowed aria-disabled:text-secondary-500 sm:flex-none sm:px-3',
                            timeframe === value &&
                                'border-primary-400 text-primary-400',
                            timeframe !== value &&
                                isLocked &&
                                'border-transparent',
                            timeframe !== value &&
                                !isLocked &&
                                'text-secondary-400 hover:text-secondary-200 border-transparent'
                        )}
                    >
                        {timeframeLabel(timeframe, locale)}
                    </button>
                );
            })}
        </div>
    );
}
