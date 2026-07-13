'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
    getAllowedModels,
    type ModelId,
    type Tier,
} from '@y0ngha/siglens-core';
import { useSelectedModel } from '../hooks/useSelectedModel';
import { useModelGate, type ModelGateState } from '@/features/premium-gate';
import { useUserTier } from '../hooks/useUserTier';
import { useReasoningToggle } from '@/features/reasoning-toggle';

interface SymbolModelContextValue {
    modelId: ModelId;
    allowedModels: readonly ModelId[];
    isHydrated: boolean;
    tier: Tier;
    isTierHydrated: boolean;
    gateModal: ModelGateState | null;
    dismissGate: () => void;
    handleModelChange: (model: ModelId) => void;
    /**
     * Effective "깊은 생각" (reasoning) value — member-reasoning-toggle spec
     * Part A. Already tier-gated: `false` for anonymous/free regardless of
     * the member's stored preference. Server-side `resolveReasoning` is the
     * authoritative enforcement; this client-side gate only prevents a
     * stale/stray `true` from a downgraded session from being sent at all.
     */
    reasoning: boolean;
    /** Persists the member's raw toggle preference (member-only UI writes this). */
    setReasoning: (value: boolean) => void;
    /** Whether the current tier is allowed to see/use the reasoning toggle (member/pro). */
    canUseReasoning: boolean;
    /**
     * Whether the reasoning toggle's localStorage read has completed (mirrors
     * `isHydrated` for `modelId`). Consumers that restart analysis on
     * reasoning change (e.g. `useAnalysis`) gate on this the same way they
     * gate on model hydration, to avoid a spurious extra fetch mid-hydration.
     */
    isReasoningHydrated: boolean;
}

const SymbolModelContext = createContext<SymbolModelContextValue | null>(null);

interface SymbolModelProviderProps {
    children: ReactNode;
}

export function SymbolModelProvider({ children }: SymbolModelProviderProps) {
    const { tier, isLoading: isTierLoading } = useUserTier();
    const allowedModels = useMemo(() => getAllowedModels(tier), [tier]);
    const [modelId, setModelId, isHydrated] = useSelectedModel(allowedModels);
    const { gateModal, dismissGate, handleModelChange } = useModelGate({
        onAllow: setModelId,
    });
    const [storedReasoning, setReasoning, isReasoningHydrated] =
        useReasoningToggle();
    // free(익명 포함) tier는 서버에서도 강제되지만(resolveReasoning), 클라에서도
    // 미리 false로 접어 두면 downgrade(로그아웃/등급 하락) 직후 stale true 값이
    // 한 프레임이라도 실제 submit에 실려 나가는 것을 방지한다.
    const canUseReasoning = tier !== 'free';
    const reasoning = canUseReasoning && storedReasoning;

    const value = useMemo(
        () => ({
            modelId,
            allowedModels,
            isHydrated,
            tier,
            isTierHydrated: !isTierLoading,
            gateModal,
            dismissGate,
            handleModelChange,
            reasoning,
            setReasoning,
            canUseReasoning,
            isReasoningHydrated,
        }),
        [
            modelId,
            allowedModels,
            isHydrated,
            tier,
            isTierLoading,
            gateModal,
            dismissGate,
            handleModelChange,
            reasoning,
            setReasoning,
            canUseReasoning,
            isReasoningHydrated,
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
