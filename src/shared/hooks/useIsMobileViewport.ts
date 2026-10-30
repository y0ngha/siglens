'use client';

import { useEffect, useState } from 'react';
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/config/viewport';

/**
 * 뷰포트가 모바일 폭(`MOBILE_VIEWPORT_MEDIA_QUERY`)인지. 서버와 첫 렌더는 `false`이고
 * 마운트 뒤에 실제 값으로 바뀐다.
 */
export function useIsMobileViewport(): boolean {
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    useEffect(() => {
        const mediaQueryList = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);
        const syncViewport = () => setIsMobileViewport(mediaQueryList.matches);

        syncViewport();
        mediaQueryList.addEventListener('change', syncViewport);

        return () => {
            mediaQueryList.removeEventListener('change', syncViewport);
        };
    }, []);

    return isMobileViewport;
}
