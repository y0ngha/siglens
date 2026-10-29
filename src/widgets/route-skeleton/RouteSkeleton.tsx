'use client';

import { cn } from '@/shared/lib/cn';
import { ROUTE_SKELETON_LAYOUTS } from './model/layouts';
import type { SkeletonRouteKind } from './types';
import { SkeletonBlockView } from './ui/blocks/SkeletonBlockView';

/**
 * 종목 밖 라우트로 들어가는 순간 루트 page slot에 그리는 골격.
 *
 * 클릭 직후, 목적지 RSC가 오기 전에 보인다(`NavigationPendingContext` JSDoc). 그래서
 * 목적지에 대해 아는 것은 경로뿐이다 — 데이터도, 그 라우트의 번역 메시지도 아직 없다.
 *
 * - **번역 문구를 쓰지 않는다.** 루트의 클라이언트 메시지는 크롬 네임스페이스만 싣는다
 *   (`CHROME_CLIENT_PATHS`). 전부 `aria-hidden` 장식이고, 진행 상태는 상단 진행 바의
 *   sr-only 문구가 알린다.
 * - **`'use client'`다.** 루트 레이아웃이 모든 라우트에서 이 요소를 슬롯에 넘기므로,
 *   서버 컴포넌트면 골격 마크업이 전 라우트 RSC 페이로드에 직렬화된다.
 * - **컴포넌트를 종류마다 만들지 않는다.** 전 라우트 공용 번들에 실리므로 블록 네 종의
 *   배열 설정(`ROUTE_SKELETON_LAYOUTS`)으로만 그린다.
 *
 * 종목 라우트는 여기서 그리지 않는다 — 헤더·탭까지 같은 틀인 `SymbolEntrySkeleton`이 맡는다.
 */

interface RouteSkeletonProps {
    readonly kind: SkeletonRouteKind;
}

/** 목적지 라우트 종류(`kind`)에 맞는 글자 없는 장식 골격. */
export function RouteSkeleton({ kind }: RouteSkeletonProps) {
    const layout = ROUTE_SKELETON_LAYOUTS[kind];
    const blocks = layout.blocks.map((block, i) => (
        // 정적 스켈레톤 블록 목록이라 정체성이 없다.
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
        <SkeletonBlockView key={i} block={block} />
    ));
    return (
        // 첫 화면을 채워 푸터가 골격 바로 아래로 끌려 올라오지 않게 한다.
        <div
            aria-hidden="true"
            data-route-skeleton={kind}
            className={cn(
                'min-h-[calc(100dvh-var(--header-h))] flex-1',
                layout.outer
            )}
        >
            {layout.inner === undefined ? (
                blocks
            ) : (
                <div className={layout.inner}>{blocks}</div>
            )}
        </div>
    );
}
