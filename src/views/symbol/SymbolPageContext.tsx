'use client';

/**
 * 차트 탭 하위 트리가 공유하는 페이지 상수(지표 수·스킬 수) 컨텍스트.
 */
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

/** 차트 탭 페이지 상수를 하위 트리에 공급한다. */
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

/** 페이지 상수를 읽는다. `SymbolPageProvider` 밖에서 부르면 throw한다. */
export function useSymbolPageContext(): SymbolPageContextValue {
    const ctx = useContext(SymbolPageContext);
    if (!ctx)
        throw new Error(
            'useSymbolPageContext must be used inside SymbolPageProvider'
        );
    return ctx;
}
