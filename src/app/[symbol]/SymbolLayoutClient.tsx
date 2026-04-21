'use client';

import { useBodyScrollLock } from '@/components/hooks/useBodyScrollLock';
import type { ReactNode } from 'react';

interface SymbolLayoutClientProps {
    children: ReactNode;
}

export function SymbolLayoutClient({ children }: SymbolLayoutClientProps) {
    useBodyScrollLock();
    return <>{children}</>;
}
