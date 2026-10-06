'use client';

import type { ReactNode } from 'react';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { symbolOfAppPath } from '@/shared/config/reservedFirstSegments';
import { usePendingHref } from '@/shared/model/NavigationPendingContext';
import { PendingSlot } from '@/shared/ui/PendingSlot';

/**
 * 같은 종목 안의 다른 탭으로 가는 중이면 그 탭 경로 — 아니면 null.
 *
 * 탭 링크는 `prefetch={false}`(CDN_CACHING.md §1)라, 클릭 뒤 라우터가 그 탭의 RSC
 * 페이로드(0.9~2.7MB)를 다 받기 전까지는 아무것도 커밋하지 못한다. `loading.tsx`는
 * 새 세그먼트가 커밋된 **뒤에야** 보이므로 이 공백을 못 메운다. 클릭 순간은
 * `LocaleLink`가 전역 `NavigationPendingContext`에 세우고, 여기서는 그중 "같은
 * 종목의 탭 이동"만 골라낸다(다른 종목으로 가는 이동은 루트의 종목 진입 슬롯 몫).
 */
export function usePendingSymbolTab(): string | null {
    const pendingHref = usePendingHref();
    const current = useAppPathname();
    if (pendingHref === null) return null;
    const symbol = symbolOfAppPath(current);
    return symbol !== null && symbolOfAppPath(pendingHref) === symbol
        ? pendingHref
        : null;
}

/**
 * `[symbol]` 레이아웃의 page slot. 탭 이동이 진행 중이면 이전 탭 대신 `fallback`을
 * 보여준다. 뼈대는 `PendingSlot` 참고 — 여기서는 "같은 종목의 탭 이동 중인가"만
 * 판정한다.
 */
export function SymbolTabPendingSlot({
    children,
    fallback,
}: {
    children: ReactNode;
    fallback: ReactNode;
}) {
    const isPending = usePendingSymbolTab() !== null;
    return (
        <PendingSlot isPending={isPending} fallback={fallback}>
            {children}
        </PendingSlot>
    );
}
