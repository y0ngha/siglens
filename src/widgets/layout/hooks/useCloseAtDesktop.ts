'use client';

import { useEffect, useEffectEvent } from 'react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';

/**
 * 열려 있는 동안 뷰포트가 `lg` 이상으로 넘어가면 `onDesktop`을 부른다.
 *
 * 모바일 드로어는 `document.body`로 포털되어 트리거 래퍼의 `lg:hidden`이 닿지 않는다.
 * 닫지 않으면 데스크톱 폭에서 닫을 수단(숨겨진 햄버거)이 없는 오버레이와 body 스크롤
 * 잠금이 남는다. 경계는 데스크톱 내비의 `hidden lg:flex`와 같은 `BELOW_LG_MEDIA_QUERY`다.
 */
export function useCloseAtDesktop(
    isOpen: boolean,
    onDesktop: () => void
): void {
    const handleDesktop = useEffectEvent(onDesktop);

    useEffect(() => {
        if (!isOpen) return;
        const mediaQueryList = window.matchMedia(BELOW_LG_MEDIA_QUERY);
        const onChange = (event: MediaQueryListEvent) => {
            if (!event.matches) handleDesktop();
        };
        mediaQueryList.addEventListener('change', onChange);
        return () => mediaQueryList.removeEventListener('change', onChange);
    }, [isOpen]);
}
