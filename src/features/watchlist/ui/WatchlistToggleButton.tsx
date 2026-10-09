'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { WatchlistSource } from '@/entities/watchlist/model';
import { cn } from '@/shared/lib/cn';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { useToast } from '@/shared/ui/ToastProvider';
import { useWatchlist } from '../hooks/useWatchlist';
import { useWatchlistCoachMark } from '../hooks/useWatchlistCoachMark';
import { WatchlistCoachMark } from './WatchlistCoachMark';

interface WatchlistToggleButtonProps {
    symbol: string;
    /** 표시명(회사명). 담을 때 저장되는 라벨이다. 모르면 심볼을 넘긴다. */
    label: string;
    source: WatchlistSource;
    /** 담기 성공에 "관심종목에 담았어요 · 내 종목 보기" 토스트(종목 헤더만). */
    successToast?: boolean;
    /** 관심종목 0개인 첫 방문자에게 1회 코치 마크(종목 헤더만). */
    showCoachMark?: boolean;
    className?: string;
}

/*
 * 헤더 컨트롤 클러스터(공유·설정 기어)와 같은 `size-11 rounded-lg border` 언어. 하이드레이션
 * 전에도 같은 크기로 그려 자리를 고정한다(레이아웃 시프트 0). 비활성은 opacity가 아니라
 * 색 토큰으로(DS-3).
 */
const CONTROL = cn(
    'relative inline-flex size-11 touch-manipulation items-center justify-center rounded-lg border transition-colors',
    'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
    'disabled:cursor-not-allowed disabled:border-border-control disabled:text-secondary-500',
    'aria-disabled:cursor-not-allowed aria-disabled:border-border-control aria-disabled:text-secondary-500'
);
const IDLE =
    'border-border-control text-secondary-300 hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100';
const PRESSED =
    'border-primary-500 bg-primary-900/10 text-primary-300 hover:bg-primary-900/20';

export function WatchlistToggleButton({
    symbol,
    label,
    source,
    successToast = false,
    showCoachMark = false,
    className,
}: WatchlistToggleButtonProps) {
    const t = useTranslations('features.watchlist');
    const limitId = useId();
    const coachId = useId();
    const { has, toggle, isHydrated, isAtLimit, limit, items } = useWatchlist();
    const { showToast } = useToast();
    const coach = useWatchlistCoachMark({
        enabled: showCoachMark && isHydrated && items.length === 0,
    });

    const pressed = isHydrated && has(symbol);
    const blockedByLimit = !pressed && isAtLimit;
    const preHydration = !isHydrated;
    const describedBy =
        [blockedByLimit ? limitId : null, coach.visible ? coachId : null]
            .filter(Boolean)
            .join(' ') || undefined;

    const handleClick = async (): Promise<void> => {
        // 상한은 aria-disabled라 포커스는 받는다 — 클릭만 막는다.
        if (blockedByLimit) return;
        if (coach.visible) coach.dismiss();
        const outcome = await toggle({ symbol, label }, source);
        if (outcome === 'added' && successToast) {
            showToast({
                message: t('toast.added'),
                link: { href: '/portfolio', label: t('toast.viewMine') },
            });
        }
    };

    return (
        <div className={cn('relative inline-block', className)}>
            <button
                type="button"
                aria-pressed={pressed}
                aria-label={t('toggle.label', { v0: label })}
                aria-describedby={describedBy}
                disabled={preHydration}
                aria-disabled={blockedByLimit || undefined}
                onClick={handleClick}
                className={cn(
                    CONTROL,
                    blockedByLimit ? null : pressed ? PRESSED : IDLE
                )}
            >
                <StarIcon filled={pressed} className="size-5" />
            </button>
            {blockedByLimit && (
                <span id={limitId} className="sr-only">
                    {t('toggle.limit', { v0: limit })}
                </span>
            )}
            {coach.visible && (
                <WatchlistCoachMark id={coachId} onDismiss={coach.dismiss} />
            )}
        </div>
    );
}
