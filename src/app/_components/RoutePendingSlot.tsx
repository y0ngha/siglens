'use client';

import type { ReactNode } from 'react';
import { routeKindOf } from '@/shared/config/routeKind';
import { usePendingRouteEntry } from '@/shared/model/NavigationPendingContext';
import { PendingSlot } from '@/shared/ui/PendingSlot';
import { RouteSkeleton } from '@/widgets/route-skeleton/RouteSkeleton';
import { SymbolEntrySkeleton } from '@/app/[locale]/[symbol]/SymbolEntrySkeleton';

/**
 * 루트 page slot. 다른 라우트로 가는 중이면 떠나온 페이지 대신 **목적지 모양의 골격**을
 * 보여준다 — 클릭 직후, 목적지 RSC가 오기 전이다.
 *
 * 왜 서버 경계(`loading.tsx`)가 아닌가는 `NavigationPendingContext` JSDoc 참고. 요약하면
 * 링크가 `prefetch={false}`라 `loading.tsx`는 클릭 즉시 뜨지 않고, 대신 ISR HTML의
 * 본문을 숨김 청크로 밀어 넣으며 페이지의 `notFound()`를 200으로 만든다. 이 슬롯은
 * 클라이언트 상태라 직접 접속·SSR·상태 코드에 관여하지 않는다.
 *
 * 같은 종목 안의 탭 이동은 여기서 다루지 않는다(`[symbol]` 레이아웃의 탭 슬롯 몫).
 */
export function RoutePendingSlot({ children }: { children: ReactNode }) {
    const pendingHref = usePendingRouteEntry();
    return (
        <PendingSlot
            isPending={pendingHref !== null}
            fallback={
                pendingHref !== null && (
                    <PendingRouteSkeleton href={pendingHref} />
                )
            }
        >
            {children}
        </PendingSlot>
    );
}

function PendingRouteSkeleton({ href }: { href: string }) {
    const kind = routeKindOf(href);
    return (
        // 떠나온 페이지가 띄운 포털(모바일 분석 시트)은 `PendingSlot`의 `hidden`으로
        // 가려지지 않는다. 이 표식을 보고 CSS가 골격 위에 남지 않게 숨긴다(globals.css).
        <div data-route-pending className="contents">
            {kind === 'symbol' ? (
                <SymbolEntrySkeleton />
            ) : (
                <RouteSkeleton kind={kind} />
            )}
        </div>
    );
}
