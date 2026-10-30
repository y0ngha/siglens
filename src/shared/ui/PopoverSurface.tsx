'use client';

import { type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';

interface PopoverSurfaceProps {
    children: ReactNode;
    isMobile: boolean;
    /** 패널 `<div>`의 ref — `useFocusTrap`/`useOnClickOutside`가 참조한다. */
    dialogRef: RefObject<HTMLDivElement | null>;
    /** 패널 제목 `<h2>`의 id. `aria-labelledby`에 그대로 연결된다. */
    titleId: string;
    /** 배치 클래스 뒤에 병합되는 호출부별 스타일(배경·보더·padding 등). */
    className?: string;
    /**
     * 데스크탑 배치에만 추가되는 클래스(예: 트리거와의 간격을 위한
     * `mt-2`/`mt-1`). 모바일은 뷰포트 중앙 정렬이라 이 여백이 필요 없다.
     */
    desktopClassName?: string;
}

/**
 * 모바일(포털) 경로에서 패널이 쓰는 배치 클래스. 뷰포트 중앙, 화면 밖으로 나갈 수 없다.
 *
 * `my-auto`가 필수다 — 백드롭이 `items-start`(아래 참고)로 바뀌면서 패널이 기본적으로
 * 백드롭 상단에 붙는다. `my-auto`는 패널이 백드롭보다 짧을 때(대부분의 경우) 위아래
 * 여백을 균등 분배해 중앙 정렬을 되돌리고, 패널이 백드롭보다 길 때는 auto margin이
 * 0으로 수렴해 백드롭 스크롤에 그대로 맡긴다 — 두 케이스 모두 이 한 줄로 해결된다.
 */
const POPOVER_PANEL_MOBILE = 'w-full max-w-sm my-auto';

/** 데스크탑에서 트리거에 앵커되는 배치 클래스. */
const POPOVER_PANEL_DESKTOP =
    'absolute top-full right-0 z-50 w-72 max-w-[calc(100vw-2rem)]';

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
 * 데스크탑에서는 포털하지 않고 패널을 제자리에 렌더한다.
 *
 * `isMobile`은 반드시 호출자가 프롭으로 넘겨야 한다. 이 컴포넌트가 내부에서
 * `useIsMobileViewport()`를 부르면 그 훅은 `false`로 시작해 effect에서 동기화되므로,
 * 마운트 첫 렌더는 Fragment(`<>{children}</>`)를, effect 뒤 렌더는 `createPortal(...)`을
 * 반환한다. 같은 위치의 Fragment와 Portal은 서로 다른 fiber 타입이라 React가 그 사이에서
 * **패널 서브트리 전체를 unmount 후 remount**한다. 이 remount는 두 가지를 조용히 깨뜨린다:
 * (1) `useFocusTrap`의 effect deps(`[active, ref]`)가 둘 다 안정적이라 remount 후
 * 재무장되지 않아 포커스 트랩이 죽는다(Tab이 다이얼로그 밖으로 샌다) — 실측: 데스크탑은
 * `activeElement`가 input, 모바일은 `BODY`. (2) 포털 이전의 첫 커밋이 앵커드(화면 밖일 수
 * 있는) 레이아웃 클래스로 페인트된다 — `next/dynamic({ssr:false})`로 열 때마다 새로
 * 마운트되는 컴포넌트(`PortfolioChipPopover`)에서는 매번 재현된다. 호출자는 뷰포트를
 * 첫 렌더 시점부터 알고 있으므로(자신도 같은 값을 배치 클래스에 쓴다) 프롭으로 받으면
 * 반환 위치가 처음부터 고정돼 remount 자체가 일어나지 않는다.
 *
 * 패널 `<div>`(dialog role, aria-labelledby, tabIndex, 배치 클래스, `aria-modal`)는 이
 * 컴포넌트가 직접 소유한다. 포털 여부와 배치 클래스가 서로 다른 파일에서 따로 분기되면 둘이
 * 어긋나도 타입도 lint도 못 잡는다(`fixed inset-0 flex` 백드롭 안에 `absolute top-full
 * right-0`가 에러 없이 렌더된다). 그래서 단일 `isMobile` 값에서 포털 여부·배치 클래스·
 * `aria-modal`을 모두 이 파일이 결정한다.
 *
 * 모바일에서만 `aria-modal="true"`를 단다 — 모바일 패널은 `fixed inset-0` 백드롭 뒤에
 * 포털된 실질적 모달 다이얼로그라 스크린리더 사용자가 시각적으로는 백드롭에 가려진 바깥
 * 콘텐츠로 스와이프해 나갈 수 있으면 안 된다. 데스크탑 앵커드 팝오버는 백드롭이 없고
 * 페이지 나머지가 여전히 상호작용 가능한 비모달이므로 달지 않는다.
 *
 * 차트 헤더 띠 메뉴(`ChartOverlayMenu`·`IndicatorMenu`·`ChartSettingsMenu`)는 이 표면을
 * 쓰지 않는다 — 모바일에서도 중앙 모달이 아니라 트리거 아래에 열려야 해서, 같은 "body
 * 포털" 아이디어를 `ChartPopoverPanel`(뷰포트 좌표 + clamp)로 따로 구현한다.
 */
export function PopoverSurface({
    children,
    isMobile,
    dialogRef,
    titleId,
    className,
    desktopClassName,
}: PopoverSurfaceProps) {
    const panel = (
        <div
            ref={dialogRef}
            // 데스크톱 팝오버/모바일 바텀시트(vaul) 겸용 표면이다. 네이티브 <dialog> 이전은 동작 변경이라 하지 않는다.
            // react-doctor-disable-next-line react-doctor/prefer-html-dialog
            role="dialog"
            aria-modal={isMobile ? true : undefined}
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
                isMobile ? POPOVER_PANEL_MOBILE : POPOVER_PANEL_DESKTOP,
                !isMobile && desktopClassName,
                className
            )}
        >
            {children}
        </div>
    );

    // SSR 중에는 `document`가 없다. 소비자가 전부 `next/dynamic({ssr:false})`이거나 열림
    // 상태에서만 렌더되는 것에 기대지 않도록 이 파일 안에서 가드한다. 데스크탑과 동일하게
    // 포털하지 않고 패널을 그대로 반환한다.
    if (!isMobile || typeof document === 'undefined') return panel;

    // 짧은 뷰포트에서 패널이 넘칠 수 있다 — `items-center`인 채로 스크롤이 없으면
    // fixed 컨테이너는 위아래로 똑같이 넘쳐서 넘친 만큼이 그냥 도달 불가능해진다
    // (예: iPhone SE 가로모드 375×667, 크롬 UI 제외 후 ~285~320px인데 평단
    // 팝오버는 ~312px가 필요 — 저장/취소 버튼 줄이 화면 밖으로 밀린다). `items-start`
    // + `overflow-y-auto`로 백드롭 자체를 스크롤 컨테이너로 만들고, 짧은 패널의
    // 중앙 정렬은 패널 쪽 `my-auto`(위)가 대신 담당한다.
    return createPortal(
        <div
            data-testid="popover-backdrop"
            role="presentation"
            className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto overscroll-contain bg-secondary-950/80 p-4 backdrop-blur-sm"
        >
            {panel}
        </div>,
        document.body
    );
}
