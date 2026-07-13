'use client';

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import {
    getAllowedModels,
    type ModelId,
    type Tier,
} from '@y0ngha/siglens-core';
import { useSelectedModel } from '../hooks/useSelectedModel';
import { useModelGate, type ModelGateState } from '@/features/premium-gate';
import { useUserTier } from '../hooks/useUserTier';
import { useReasoningToggle } from '@/features/reasoning-toggle';
import { AnalysisSignupNudgeModal } from '@/features/analysis-nudge';

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
    /**
     * Whether the current tier may interact with (toggle) the reasoning
     * switch (member/pro). The switch is always rendered — tiers that can't
     * use it see it in a locked state (which opens the signup nudge) rather
     * than it being hidden.
     */
    canUseReasoning: boolean;
    /**
     * Whether the reasoning toggle's localStorage read has completed (mirrors
     * `isHydrated` for `modelId`). Consumers that restart analysis on
     * reasoning change (e.g. `useAnalysis`) gate on this the same way they
     * gate on model hydration, to avoid a spurious extra fetch mid-hydration.
     */
    isReasoningHydrated: boolean;
    /**
     * Open the shared signup-nudge modal (locked toggle click + auto-nudge).
     *
     * The modal itself is rendered EXACTLY ONCE by `SymbolModelProvider`
     * (which wraps both the layout header and the chart page tree), so the
     * locked-toggle nudge (`SymbolLayoutHeader`) and the anonymous 3-symbol
     * auto-nudge (`ChartContent` → `useAnonAnalysisNudge`) share a single
     * instance instead of each mounting their own `fixed inset-0 z-50` dialog
     * — two stacked modals would clash over focus-trap/Escape handling. The
     * open-state itself is provider-LOCAL (not exposed on the context value)
     * so opening/closing the modal never changes the context value identity
     * and thus never re-renders unrelated `useSymbolModel()` consumers.
     */
    openSignupNudge: () => void;
    /** Dismiss the shared signup-nudge modal. */
    closeSignupNudge: () => void;
}

const SymbolModelContext = createContext<SymbolModelContextValue | null>(null);

interface SymbolModelProviderProps {
    children: ReactNode;
}

export function SymbolModelProvider({ children }: SymbolModelProviderProps) {
    // Single shared open-state for the signup-nudge modal. Both entry points
    // (locked-toggle click in the header, 3-symbol auto-nudge in ChartContent)
    // flip this same flag, and the modal is rendered once below — see the
    // `openSignupNudge` doc for why a single instance is required. This state
    // is provider-LOCAL and intentionally NOT part of the context value: only
    // the provider reads it (to render the modal), so keeping it out of the
    // memoized value means open/close never churns `useSymbolModel()` consumers.
    // (Declared first per the useState → custom-hooks → derived → handlers
    // hook-ordering convention — CONVENTIONS.md "Custom Hook Declaration Order".)
    const [isSignupNudgeOpen, setIsSignupNudgeOpen] = useState(false);

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

    const openSignupNudge = useCallback(() => setIsSignupNudgeOpen(true), []);
    const closeSignupNudge = useCallback(() => setIsSignupNudgeOpen(false), []);

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
            openSignupNudge,
            closeSignupNudge,
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
            openSignupNudge,
            closeSignupNudge,
        ]
    );

    return (
        <SymbolModelContext.Provider value={value}>
            {children}
            {/* Single signup-nudge modal instance shared by the header's
                locked-toggle nudge and ChartContent's 3-symbol auto-nudge. */}
            {isSignupNudgeOpen && (
                <AnalysisSignupNudgeModal onClose={closeSignupNudge} />
            )}
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
