'use client';

import type { ReactNode } from 'react';
import { Drawer } from 'vaul';

export type SnapPoint = number | string | null;

export const SNAP_PEEK = 0.15; // 15% — 기본 접힘
export const SNAP_HALF = 0.60; // 60% — 분석 중 배너 노출
export const SNAP_FULL = 0.92; // 92% — 전체 열림

export const MOBILE_SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const;

// Vaul의 snapPoints prop은 readonly 배열을 허용하지 않아 mutable 사본을 사용한다
const SNAP_POINTS_MUTABLE = [...MOBILE_SNAP_POINTS] as number[];

interface MobileAnalysisSheetProps {
    activeSnap: SnapPoint;
    onActiveSnapChange: (snap: SnapPoint) => void;
    children: ReactNode;
}

export function MobileAnalysisSheet({
    activeSnap,
    onActiveSnapChange,
    children,
}: MobileAnalysisSheetProps) {
    return (
        <Drawer.Root
            open
            modal={false}
            dismissible={false}
            snapPoints={SNAP_POINTS_MUTABLE}
            activeSnapPoint={activeSnap}
            setActiveSnapPoint={onActiveSnapChange}
        >
            <Drawer.Portal>
                <Drawer.Content
                    className="bg-secondary-900 border-secondary-700 fixed inset-x-0 bottom-0 z-40 flex max-h-[92svh] flex-col overflow-hidden [overscroll-behavior:contain] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.6)] md:hidden"
                    aria-live="polite"
                >
                    <Drawer.Handle
                        className="bg-secondary-600 mx-auto mt-3 mb-1 h-1 w-10 rounded-full"
                        aria-label="AI 분석 패널 크기 조절"
                    />
                    <Drawer.Title className="sr-only">
                        AI 분석 패널
                    </Drawer.Title>
                    <Drawer.Description className="sr-only">
                        위로 드래그하여 분석 내용을 확인하세요
                    </Drawer.Description>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
