'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { useToast } from '@/shared/ui/ToastProvider';
import { useWatchlist } from '../hooks/useWatchlist';

interface SearchWatchlistStarProps {
    symbol: string;
    /** 담을 때 저장되는 표시명(검색 결과의 주 이름). */
    label: string;
    /**
     * Tab 정지점으로 둘지. 오버레이(버튼 목록)는 true. 데스크톱 자동완성은 false — combobox
     * 옵션 안에는 상호작용 요소를 둘 수 없어 포인터 전용 보조 컨트롤로 두고, 화살표·Enter
     * 흐름은 그대로 둔다. 키보드 사용자는 종목 페이지 헤더 ☆로 담는다.
     */
    focusable: boolean;
    className?: string;
}

/**
 * 검색 결과 행의 ★. 누르면 페이지로 이동하지 않고 담는다. 담았으면
 * "되돌리기" 토스트를 띄워 잘못 누른 담기를 바로 무를 수 있게 한다.
 */
export function SearchWatchlistStar({
    symbol,
    label,
    focusable,
    className,
}: SearchWatchlistStarProps) {
    const t = useTranslations('features.watchlist');
    const { has, toggle, remove, isHydrated } = useWatchlist();
    const { showToast } = useToast();
    const pressed = isHydrated && has(symbol);

    const handleClick = async (): Promise<void> => {
        const outcome = await toggle({ symbol, label }, 'search');
        if (outcome === 'added') {
            showToast({
                message: t('toast.added'),
                action: {
                    label: t('toast.undo'),
                    onAction: () => void remove(symbol),
                },
            });
        }
    };

    return (
        <button
            type="button"
            tabIndex={focusable ? undefined : -1}
            aria-pressed={pressed}
            aria-label={t('toggle.label', { v0: label })}
            disabled={!isHydrated}
            // 입력의 포커스를 뺏지 않는다 — 자동완성에서 누른 뒤에도 계속 타이핑할 수 있게.
            onMouseDown={event => event.preventDefault()}
            onClick={() => void handleClick()}
            className={cn(
                'inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:cursor-default',
                pressed
                    ? 'text-primary-400 hover:text-primary-300'
                    : 'text-secondary-400 hover:text-secondary-100',
                className
            )}
        >
            <StarIcon filled={pressed} className="size-4" />
        </button>
    );
}
