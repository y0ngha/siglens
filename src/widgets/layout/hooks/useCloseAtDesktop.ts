'use client';

import { useEffect, useEffectEvent } from 'react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';

/**
 * `lg` 미만 여부가 바뀔 때 `onChange`를 부르는 구독. 해제 함수를 돌려준다.
 *
 * 리스너 등록·해제는 훅 본문이 아니라 모듈 수준 함수에 둔다(REACT.md#EF-3).
 */
function subscribeBelowLg(
    onChange: (event: MediaQueryListEvent) => void
): () => void {
    const mediaQueryList = window.matchMedia(BELOW_LG_MEDIA_QUERY);
    mediaQueryList.addEventListener('change', onChange);
    return () => mediaQueryList.removeEventListener('change', onChange);
}

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
        return subscribeBelowLg(event => {
            if (!event.matches) handleDesktop();
        });
    }, [isOpen]);
}
