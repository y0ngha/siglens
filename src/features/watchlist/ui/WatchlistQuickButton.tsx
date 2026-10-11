'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { useWatchlist } from '../hooks/useWatchlist';
import { WatchlistPreviewPanel } from './WatchlistPreviewPanel';

/** vaul 시트는 모바일에서 처음 열 때만 불러온다(데스크톱 첫 로드 JS에서 뺀다). */
const WatchlistQuickSheet = dynamic(
    () => import('./WatchlistQuickSheet').then(mod => mod.WatchlistQuickSheet),
    { ssr: false }
);

type OpenMode = 'closed' | 'popover' | 'sheet';

/**
 * 헤더의 관심종목 상시 진입점(회원·비회원 공통). PC(`lg` 이상)는 버튼 아래 팝오버, 그 밖은
 * 바텀시트로 같은 미리보기(`WatchlistPreviewPanel`)를 연다. 어느 쪽으로 열지는 **누르는 순간의**
 * 뷰포트로 정한다 — 렌더 시점에 미디어 쿼리를 읽지 않으므로 서버·클라 마크업이 같다.
 *
 * 폭: PC는 `관심 50`까지 들어가는 최소 폭을 미리 잡아 하이드레이션 뒤 개수가 붙어도 옆의
 * 검색창이 밀리지 않는다. 모바일 배지는 아이콘 위에 절대 배치라 폭이 변하지 않는다.
 */
export function WatchlistQuickButton() {
    const t = useTranslations('features.watchlist');
    const popoverId = useId();
    const [mode, setMode] = useState<OpenMode>('closed');
    // 시트 청크는 한 번 열린 뒤로 계속 마운트해 둔다 — 닫힘 애니메이션이 끝까지 돌게.
    const [sheetMounted, setSheetMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const { items, isHydrated } = useWatchlist();
    const count = isHydrated ? items.length : null;

    // 아래 두 훅(바깥 클릭·Esc)이 이 핸들러를 입력으로 받으므로 그 앞에 선언한다.
    const closeAndRestoreFocus = (): void => {
        setMode('closed');
        buttonRef.current?.focus();
    };
    useOnClickOutside(containerRef, () => setMode('closed'), {
        enabled: mode === 'popover',
    });
    useEscapeKey(closeAndRestoreFocus, mode === 'popover');

    // 열리면 포커스를 대화상자 안(선택된 탭)으로 옮긴다 — `role="dialog"`를 연 버튼의 약속이다.
    // 닫힐 때는 `closeAndRestoreFocus`가 버튼으로 돌려준다. DOM 포커스라 effect다.
    useEffect(() => {
        if (mode !== 'popover') return;
        popoverRef.current
            ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
            ?.focus();
    }, [mode]);

    const handleClick = () => {
        if (mode !== 'closed') {
            setMode('closed');
            return;
        }
        if (window.matchMedia(BELOW_LG_MEDIA_QUERY).matches) {
            setSheetMounted(true);
            setMode('sheet');
        } else {
            setMode('popover');
        }
    };

    const label =
        count === null || count === 0
            ? t('quick.open')
            : t('quick.openWithCount', { v0: count });

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleClick}
                aria-label={label}
                aria-expanded={mode !== 'closed'}
                aria-controls={mode === 'popover' ? popoverId : undefined}
                aria-haspopup="dialog"
                className={cn(
                    'relative inline-flex size-10 touch-manipulation items-center justify-center rounded-lg text-secondary-300 transition-colors hover:bg-secondary-800 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                    'lg:w-auto lg:min-w-[4.75rem] lg:gap-1.5 lg:border lg:border-border-control lg:px-3 lg:text-sm lg:font-semibold',
                    mode !== 'closed' &&
                        'bg-secondary-800 text-secondary-100 lg:border-primary-500'
                )}
            >
                <StarIcon
                    filled={count !== null && count > 0}
                    className={cn(
                        'size-5 lg:size-4',
                        count !== null && count > 0 && 'text-primary-400'
                    )}
                />
                <span aria-hidden="true" className="hidden lg:inline">
                    {t('quick.label')}
                </span>
                {count !== null && count > 0 && (
                    <span
                        aria-hidden="true"
                        className={cn(
                            'rounded-full bg-primary-600 font-semibold text-white tabular-nums',
                            'absolute top-1 right-0.5 min-w-4 px-1 text-[10px] leading-4',
                            'lg:static lg:min-w-5 lg:px-1.5 lg:text-xs lg:leading-5'
                        )}
                    >
                        {count}
                    </span>
                )}
            </button>
            {mode === 'popover' && (
                <div
                    ref={popoverRef}
                    id={popoverId}
                    role="dialog"
                    aria-label={t('preview.title')}
                    className="absolute top-full right-0 z-50 mt-2 w-[23rem] overflow-hidden rounded-lg border border-secondary-600 bg-secondary-800 shadow-2xl"
                >
                    <WatchlistPreviewPanel
                        variant="popover"
                        quotesEnabled
                        onNavigate={() => setMode('closed')}
                    />
                </div>
            )}
            {sheetMounted && (
                <WatchlistQuickSheet
                    open={mode === 'sheet'}
                    onOpenChange={open => {
                        // 시트는 Trigger 없이 열어 Radix가 포커스를 돌려줄 곳을 모른다 — 직접 돌린다.
                        if (!open) closeAndRestoreFocus();
                    }}
                />
            )}
        </div>
    );
}
