'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { deriveLabel } from '@/domain/chat/derivePageContextLabel';

/** Korean page-context label for the current pathname; `null` on non-symbol pages. */
export function usePageContextLabel(): string | null {
    const pathname = usePathname();
    return useMemo(() => deriveLabel(pathname), [pathname]);
}
