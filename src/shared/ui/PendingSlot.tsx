'use client';

import type { ReactNode } from 'react';

interface PendingSlotProps {
    isPending: boolean;
    fallback: ReactNode;
    children: ReactNode;
}

/**
 * 진행 중인 내비게이션 슬롯의 공통 뼈대.
 *
 * pending이면 이전 화면 대신 `fallback`(골격)을 보여준다. 이전 화면은
 * 언마운트하지 않고 숨기기만 한다 — 이동이 취소돼도(같은 경로 유지) 상태를
 * 잃지 않는다. `contents`라 평소엔 부모의 flex/레이아웃 배치를 바꾸지 않는다.
 *
 * `RoutePendingSlot`(루트 page slot)과 `SymbolTabPendingContext`의
 * `SymbolTabPendingSlot`(`[symbol]` layout page slot)이 이 뼈대를 공유한다 —
 * 판정 기준(어떤 이동을 pending으로 볼지)만 다르다.
 */
export function PendingSlot({
    isPending,
    fallback,
    children,
}: PendingSlotProps) {
    return (
        <>
            {isPending && fallback}
            <div className={isPending ? 'hidden' : 'contents'}>{children}</div>
        </>
    );
}
