'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { useNavMenuDisclosure } from './hooks/useNavMenuDisclosure';
import { NavMenuPanel } from './ui/nav/NavMenuPanel';
import { NavMenuTrigger } from './ui/nav/NavMenuTrigger';
import type { NavVerticalNode } from './utils/headerNavTree';
import { isVerticalActive } from './utils/navActiveState';

interface HeaderNavMenuProps {
    readonly vertical: NavVerticalNode;
    /** 현재 경로. `null`이면 활성 표시를 끈다. */
    readonly pathname: string | null;
    /**
     * 패널 id의 네임스페이스. **호출부마다 달라야 한다.**
     *
     * 같은 트리 위치에서 이 메뉴를 두 번 렌더하면(예: Suspense fallback과 본체)
     * `useId()`가 **같은 값**을 발급한다. 둘 다 서빙 HTML에 남으면 같은 id가 두 번
     * 나오고 `getElementById`는 첫 매치를 돌려주어, 보이는 메뉴의 `aria-controls`가
     * 숨겨진 쪽 패널을 가리킨다. 지금 호출부는 `HeaderNav` 하나뿐이지만
     * (`navPanelIdUniqueness.test.tsx`가 고정), 호출부가 늘면 이 값으로 가른다.
     */
    readonly idScope: string;
}

/**
 * 데스크톱 헤더의 버티컬 1개 = 트리거 버튼 + 지역/목적지 패널.
 *
 * 열림 규칙(호버·클릭·포커스 이탈·Escape)은 `useNavMenuDisclosure`가 소유한다. 호버는
 * 컨테이너에 걸려 트리거와 패널 사이에 빈틈이 없으므로 닫힘 지연 타이머가 필요 없다.
 */
export function HeaderNavMenu({
    vertical,
    pathname,
    idScope,
}: HeaderNavMenuProps) {
    const tNav = useTranslations();
    const generatedId = useId();
    const panelId = `${idScope}-${generatedId}`;
    const {
        isOpen,
        close,
        containerRef,
        triggerRef,
        onTriggerClick,
        onPointerEnter,
        onPointerLeave,
        onBlur,
    } = useNavMenuDisclosure();

    return (
        <div
            ref={containerRef}
            className="relative"
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onBlur={onBlur}
        >
            <NavMenuTrigger
                ref={triggerRef}
                isOpen={isOpen}
                active={isVerticalActive(vertical, pathname)}
                panelId={panelId}
                onClick={onTriggerClick}
            >
                {tNav(vertical.labelKey)}
            </NavMenuTrigger>
            <NavMenuPanel
                id={panelId}
                vertical={vertical}
                pathname={pathname}
                isOpen={isOpen}
                onNavigate={close}
            />
        </div>
    );
}
