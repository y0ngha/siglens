'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 헤더 앵커드 팝오버를 모바일에서 화면 중앙 모달로 승격시키는 공유 표면.
 *
 * 왜 포털이 필요한가: `SymbolLayoutHeader`가 `relative z-40`이라 **스택 컨텍스트를
 * 생성**한다. 그 안의 팝오버는 z-index를 아무리 올려도 루트 컨텍스트에서는 40레벨로
 * 합성되므로, `document.body`에 포털된 분석 시트(z-50)에 덮인다. 실측에서 평단
 * 팝오버와 분석 설정 메뉴가 둘 다 시트에 가려졌다. body로 포털해야 z-60이 유효하다.
 *
 * 가로 오버플로우도 같이 해결된다 — 앵커(칩) 기준 `right-0` 정렬이 좁은 화면에서
 * 왼쪽으로 넘치던 문제(iPhone SE에서 x=−88px)가, 뷰포트 중앙 정렬로 원천 차단된다.
 *
 * 데스크탑에서는 아무것도 하지 않고 children을 제자리에 렌더한다.
 *
 * `isMobile`은 반드시 호출자가 프롭으로 넘겨야 한다 — 이전에는 이 컴포넌트가
 * 내부에서 `useIsMobileViewport()`를 직접 호출했는데, 그 훅은 `false`로
 * 시작해 effect에서 동기화된다. 그러면 마운트 첫 렌더는 Fragment(`<>{children}</>`)를
 * 반환하고, effect가 돌고 난 다음 렌더는 `createPortal(...)`을 반환한다 — 같은
 * 위치에서 Fragment와 Portal은 서로 다른 fiber 타입이라 React가 그 사이에서
 * **패널 서브트리 전체를 unmount 후 remount**한다. 이 remount는 두 가지를
 * 조용히 깨뜨린다: (1) `useFocusTrap`의 effect deps(`[active, ref]`)가 둘 다
 *안정적이라 remount 후 재무장되지 않아 포커스 트랩이 죽는다(Tab이 다이얼로그
 * 밖으로 새 나간다) — 실측: 데스크탑은 `activeElement`가 input, 모바일은
 * `BODY`. (2) 포털 이전의 첫 커밋이 앵커드(화면 밖일 수 있는) 레이아웃 클래스로
 * 페인트된다 — `next/dynamic({ssr:false})`로 열 때마다 새로 마운트되는
 * 컴포넌트(`PortfolioChipPopover`)에서는 매번 재현된다. 호출자는 뷰포트를
 * 첫 렌더 시점부터 이미 알고 있어야 하므로(자신도 같은 값을 배치 클래스에 쓴다),
 * 이 프롭으로 값을 받으면 PopoverSurface의 return 위치가 처음부터 고정돼
 * remount 자체가 발생하지 않는다.
 */
interface PopoverSurfaceProps {
    children: ReactNode;
    isMobile: boolean;
}

export function PopoverSurface({ children, isMobile }: PopoverSurfaceProps) {
    if (!isMobile) return <>{children}</>;

    return createPortal(
        <div
            data-testid="popover-backdrop"
            role="presentation"
            className="bg-secondary-950/80 fixed inset-0 z-60 flex items-center justify-center overscroll-contain p-4 backdrop-blur-sm"
        >
            {children}
        </div>,
        document.body
    );
}

/** 모바일(포털) 경로에서 패널이 쓰는 배치 클래스. 뷰포트 중앙, 화면 밖으로 나갈 수 없다. */
export const POPOVER_PANEL_MOBILE = 'w-full max-w-sm';

/** 데스크탑에서 트리거에 앵커되는 기존 배치 클래스. */
export const POPOVER_PANEL_DESKTOP =
    'absolute top-full right-0 z-50 w-72 max-w-[calc(100vw-2rem)]';
