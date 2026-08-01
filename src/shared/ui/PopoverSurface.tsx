'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';

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
 */
interface PopoverSurfaceProps {
    children: ReactNode;
}

export function PopoverSurface({ children }: PopoverSurfaceProps) {
    const isMobileViewport = useIsMobileViewport();

    if (!isMobileViewport) return <>{children}</>;

    return createPortal(
        <div
            data-testid="popover-backdrop"
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
