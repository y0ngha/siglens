'use client';

import { useEffect, useState } from 'react';
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/config/viewport';

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
