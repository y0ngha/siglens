'use client';

import type { ReactNode, Ref } from 'react';
import { Drawer } from 'vaul';

interface SidebarDrawerProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /** 바깥 누르기 닫기(`ChatShell`의 `useOnClickOutside`)가 서랍 본문을 알아야 한다. */
    readonly contentRef: Ref<HTMLDivElement>;
    /** 화면 낭독기용 서랍 제목. */
    readonly title: string;
    readonly children: ReactNode;
}

/**
 * 모바일(`lg` 미만) 대화 목록 서랍. `vaul`을 이 파일에만 두는 이유는 번들이다 —
 * `ChatShell`이 `next/dynamic`으로 **모바일 뷰포트에서만** 불러오므로, 데스크톱과
 * 첫 로드 JS에는 vaul이 실리지 않는다. 닫힌 서랍은 아무것도 그리지 않으므로(vaul은 닫히면
 * 본문을 언마운트한다) 늦게 붙어도 레이아웃이 밀리지 않는다.
 *
 * 비모달인 이유: 모달 vaul 서랍이 모바일 입력창의 포커스를 가둬 버렸다. 비모달 vaul은
 * 바깥 누르기를 무시하므로 닫기는 `ChatShell`이 직접 처리한다.
 */
export function SidebarDrawer({
    open,
    onOpenChange,
    contentRef,
    title,
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
                    className="fixed inset-y-0 left-0 z-[60] w-72 border-r border-secondary-700 bg-secondary-950"
                >
                    <Drawer.Title className="sr-only">{title}</Drawer.Title>
                    {children}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
