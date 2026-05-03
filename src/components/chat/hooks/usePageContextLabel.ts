'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { deriveLabel } from '@/lib/chat/derivePageContextLabel';

/**
 * Returns the Korean page-context label for the current pathname.
 *
 * Returns `null` when the current page is not a symbol detail page
 * (e.g. `/account`, `/login`).
 */
export function usePageContextLabel(): string | null {
    const pathname = usePathname();
    return useMemo(() => deriveLabel(pathname), [pathname]);
}
