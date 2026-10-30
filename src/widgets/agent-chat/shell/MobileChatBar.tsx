'use client';

/**
 * `lg` 미만 대화 바 — 대화 목록 서랍 트리거와 열린 대화 제목. 아래로 스크롤하면 사이트 헤더와
 * 함께 위로 숨는다.
 */
import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import { cn } from '@/shared/lib/cn';
import { MenuIcon } from '@/shared/ui/StrokeIcons';

interface MobileChatBarProps {
    readonly title: string;
    readonly drawerOpen: boolean;
    /** 헤더와 같이 숨었는가(`useHideOnScrollDown` — `lg` 미만에서만 참이 된다). */
    readonly hidden: boolean;
    readonly triggerRef: RefObject<HTMLButtonElement | null>;
    readonly onOpenDrawer: () => void;
}

/** 서랍 트리거 버튼과 제목 한 줄을 그린다. */
export function MobileChatBar({
    title,
    drawerOpen,
    hidden,
    triggerRef,
    onOpenDrawer,
}: MobileChatBarProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <div
            data-scroll-chrome=""
            // globals.css reads this to drop the top install banner below the bar.
            data-agent-chat-bar=""
            // `hidden`은 `lg` 미만에서만 참이라 데스크톱에서는 `inert`가 걸리지 않는다
            // (거기서는 이 바가 `lg:hidden`이기도 하다). Header.tsx와 같은 패턴.
            inert={hidden}
            className={cn(
                // 사이트 헤더 아래 고정 — 대화 중에도 서랍 트리거에 닿는다. 아래로 스크롤하면
                // 헤더와 함께 위로 미끄러진다(헤더 + 바 높이만큼). 높이는 PWA 배너도 읽는
                // globals.css 크롬 변수다.
                'surface-bar sticky top-(--header-h) z-40 flex h-(--agent-chat-bar-h) items-center gap-2 bg-secondary-900 px-2 transition-transform duration-200 motion-reduce:transition-none lg:hidden',
                hidden &&
                    '-translate-y-[calc(var(--header-h)+var(--agent-chat-bar-h))]'
            )}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={onOpenDrawer}
                // vaul은 닫힌 동안 서랍 내용을 언마운트해 id가 열렸을 때만 있다 — 없는
                // 요소를 가리키는 참조는 잘못된 ARIA다.
                aria-controls={
                    drawerOpen ? 'agent-chat-sidebar-drawer' : undefined
                }
                aria-expanded={drawerOpen}
                // 긴 제목 옆에서 이 버튼까지 줄어 "대화 목록"이 두 줄로 꺾였다 — 줄어드는 쪽은 제목이다.
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded px-2 text-sm whitespace-nowrap text-secondary-200 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <MenuIcon className="size-4" />
                {t('ChatShell.openConversations')}
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-secondary-300">
                {title}
            </span>
        </div>
    );
}
