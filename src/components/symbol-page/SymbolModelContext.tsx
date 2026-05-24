'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getAllowedModels, type ModelId } from '@y0ngha/siglens-core';
import { useSelectedModel } from '@/components/symbol-page/hooks/useSelectedModel';
import { useModelGate, type ModelGateState } from '@/features/premium-gate';
import { useUserTier } from '@/components/symbol-page/hooks/useUserTier';

interface SymbolModelContextValue {
    modelId: ModelId;
    allowedModels: readonly ModelId[];
    isHydrated: boolean;
    gateModal: ModelGateState | null;
    dismissGate: () => void;
    handleModelChange: (model: ModelId) => void;
}

const SymbolModelContext = createContext<SymbolModelContextValue | null>(null);

interface SymbolModelProviderProps {
    children: ReactNode;
}

export function SymbolModelProvider({ children }: SymbolModelProviderProps) {
    const { tier } = useUserTier();
    const allowedModels = useMemo(() => getAllowedModels(tier), [tier]);
    const [modelId, setModelId, isHydrated] = useSelectedModel(allowedModels);
    const { gateModal, dismissGate, handleModelChange } = useModelGate({
        onAllow: setModelId,
    });

    const value = useMemo(
        () => ({
            modelId,
            allowedModels,
            isHydrated,
            gateModal,
            dismissGate,
            handleModelChange,
        }),
        [
            modelId,
            allowedModels,
            isHydrated,
            gateModal,
            dismissGate,
            handleModelChange,
        ]
    );

    return (
        <SymbolModelContext.Provider value={value}>
            {children}
        </SymbolModelContext.Provider>
    );
}

export function useSymbolModel(): SymbolModelContextValue {
    const ctx = useContext(SymbolModelContext);
    if (!ctx)
        throw new Error(
            'useSymbolModel must be used inside SymbolModelProvider'
        );
    return ctx;
}
