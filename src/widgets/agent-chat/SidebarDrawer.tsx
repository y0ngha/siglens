'use client';

import type { ReactNode, Ref } from 'react';
import { Drawer } from 'vaul';
import { CloseIcon, HomeIcon } from '@/shared/ui/StrokeIcons';

interface SidebarDrawerProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /** 바깥 누르기 닫기(`ChatShell`의 `useOnClickOutside`)가 서랍 본문을 알아야 한다. */
    readonly contentRef: Ref<HTMLDivElement>;
    /** 화면 낭독기용 서랍 제목. */
    readonly title: string;
    /** 서랍 맨 위 "시그렌즈 홈" 링크(siglens.io). */
    readonly homeHref: string;
    readonly homeLabel: string;
    readonly closeLabel: string;
    readonly children: ReactNode;
}

const HEADER_ACTION =
    'inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-sm text-secondary-200 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 모바일(`lg` 미만) 대화 목록 서랍. `vaul`을 이 파일에만 두는 이유는 번들이다 —
 * `ChatShell`이 `next/dynamic`으로 **모바일 뷰포트에서만** 불러오므로, 데스크톱과
 * 첫 로드 JS에는 vaul이 실리지 않는다. 닫힌 서랍은 아무것도 그리지 않으므로(vaul은 닫히면
 * 본문을 언마운트한다) 늦게 붙어도 레이아웃이 밀리지 않는다.
 *
 * 비모달인 이유: 모달 vaul 서랍이 모바일 입력창의 포커스를 가둬 버렸다. 비모달 vaul은
 * 바깥 누르기를 무시하므로 닫기는 `ChatShell`이 직접 처리한다.
 *
 * 서랍은 화면 높이 전체를 덮어 사이트 헤더(로고·메뉴)까지 가린다. 그래서 맨 위에 홈 링크와
 * 닫기 버튼을 따로 둔다 — 대화 목록 맨 아래의 "시그렌즈 홈으로"는 목록이 길면 보이지 않는다.
 */
export function SidebarDrawer({
    open,
    onOpenChange,
    contentRef,
    title,
    homeHref,
    homeLabel,
    closeLabel,
    children,
}: SidebarDrawerProps) {
    return (
        <Drawer.Root
            open={open}
            onOpenChange={onOpenChange}
            direction="left"
            modal={false}
        >
            <Drawer.Portal>
                <Drawer.Content
                    ref={contentRef}
                    id="agent-chat-sidebar-drawer"
                    className="ai-rail fixed inset-y-0 left-0 z-[60] flex w-72 flex-col bg-secondary-950"
                >
                    <Drawer.Title className="sr-only">{title}</Drawer.Title>
                    <div className="flex h-11 shrink-0 items-center justify-between px-2">
                        <a href={homeHref} className={HEADER_ACTION}>
                            <HomeIcon className="size-4" />
                            {homeLabel}
                        </a>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            aria-label={closeLabel}
                            className={HEADER_ACTION}
                        >
                            <CloseIcon className="size-4" />
                        </button>
                    </div>
                    <div className="min-h-0 flex-1">{children}</div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
