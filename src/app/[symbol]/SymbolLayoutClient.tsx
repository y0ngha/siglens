'use client';

import { useBodyScrollLock } from '@/components/hooks/useBodyScrollLock';
import React, { ReactNode } from 'react';

export function SymbolLayoutClient({ children }: { children: ReactNode }) {
    useBodyScrollLock();
    return <>{children}</>;
}
