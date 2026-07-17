'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

interface SymbolPageContextValue {
    indicatorCount: number;
    /** 회원이 적용받는 전체 차트 패턴 + 전략 스킬 카탈로그 수(가입 유도 카드용). */
    skillCount: number;
}

const SymbolPageContext = createContext<SymbolPageContextValue | null>(null);

interface SymbolPageProviderProps {
    indicatorCount: number;
    skillCount: number;
    children: ReactNode;
}

export function SymbolPageProvider({
    indicatorCount,
    skillCount,
    children,
}: SymbolPageProviderProps) {
    return (
        <SymbolPageContext.Provider value={{ indicatorCount, skillCount }}>
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
