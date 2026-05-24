'use client';

import { startTransition, useEffect, useState } from 'react';

// SSR→CSR 하이드레이션이 끝났는지 감지한다. 초기 render(false) 이후 useEffect로 true 전환.
export function useHydrated(): boolean {
    const [isHydrated, setIsHydrated] = useState(false);
    useEffect(() => {
        startTransition(() => setIsHydrated(true));
    }, []);
    return isHydrated;
}
