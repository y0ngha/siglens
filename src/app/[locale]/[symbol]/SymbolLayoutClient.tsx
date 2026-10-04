'use client';

import { type ReactNode } from 'react';
import { SymbolModelProvider } from '@/features/symbol-model/model/SymbolModelContext';
import { ShareableAnalysisProvider } from '@/features/share/model/ShareableAnalysisContext';

interface SymbolLayoutProvidersProps {
    children: ReactNode;
}

/**
 * Client provider subtree shared by every `/[symbol]/*` page. Keeps the model
 * context alive across symbol tab navigation.
 */
export function SymbolLayoutProviders({
    children,
}: SymbolLayoutProvidersProps) {
    return (
        <SymbolModelProvider>
            <ShareableAnalysisProvider>{children}</ShareableAnalysisProvider>
        </SymbolModelProvider>
    );
}
