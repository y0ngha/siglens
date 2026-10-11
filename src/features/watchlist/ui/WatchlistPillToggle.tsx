'use client';

import { useTranslations } from 'next-intl';
import type { WatchlistSource } from '@/entities/watchlist/model';
import { cn } from '@/shared/lib/cn';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { useWatchlist } from '../hooks/useWatchlist';

interface WatchlistPillToggleProps {
    symbol: string;
    /** 담을 때 저장되는 표시명. */
    label: string;
    source: WatchlistSource;
}

/**
 * 종목 알약(`CategoryCardGrid`) 오른쪽 끝의 작은 ★. 알약의 링크와 형제라 누르면 담기만 하고
 * 이동하지 않는다. 링크 목록은 서버 렌더 그대로(크롤러가 따라가는 내부 링크)이고 이 버튼만
 * 클라이언트에서 붙는다 — 하이드레이션 전에도 같은 크기로 그려 알약 폭이 변하지 않는다.
 *
 * 상한에 걸리면 `useWatchlist`가 토스트로 알리므로 여기서는 따로 막지 않는다.
 */
export function WatchlistPillToggle({
    symbol,
    label,
    source,
}: WatchlistPillToggleProps) {
    const t = useTranslations('features.watchlist');
    const { has, toggle, isHydrated } = useWatchlist();
    const pressed = isHydrated && has(symbol);
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={t('toggle.label', { v0: label })}
            disabled={!isHydrated}
            onClick={() => void toggle({ symbol, label }, source)}
            className={cn(
                // 보이는 원은 28px로 알약 높이에 맞추고, 누르는 영역만 가상 요소로 40px까지 넓힌다
                // (옆의 검색 ★·시트 행과 비슷한 터치 목표).
                'relative inline-flex size-7 shrink-0 touch-manipulation items-center justify-center rounded-full transition-colors before:absolute before:-inset-1.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:cursor-default',
                pressed
                    ? 'text-primary-400 hover:text-primary-300'
                    : 'text-secondary-500 hover:text-secondary-200'
            )}
        >
            <StarIcon filled={pressed} className="size-3.5" />
        </button>
    );
}
