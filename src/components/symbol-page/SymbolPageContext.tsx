'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface SymbolPageContextValue {
    indicatorCount: number;
}

const SymbolPageContext = createContext<SymbolPageContextValue | null>(null);

interface SymbolPageProviderProps {
    indicatorCount: number;
    children: ReactNode;
}

export function SymbolPageProvider({
    indicatorCount,
    children,
}: SymbolPageProviderProps) {
    return (
        <SymbolPageContext.Provider value={{ indicatorCount }}>
            {children}
        </SymbolPageContext.Provider>
    );
}

export function useSymbolPageContext(): SymbolPageContextValue {
    const ctx = useContext(SymbolPageContext);
    if (!ctx)
        throw new Error(
            'useSymbolPageContext must be used inside SymbolPageProvider'
        );
    return ctx;
}
