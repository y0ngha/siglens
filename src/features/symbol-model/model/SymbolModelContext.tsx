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
import {
    useModelGate,
    type ModelGateState,
} from '@/features/premium-gate/hooks/useModelGate';
import { useUserTier } from '../hooks/useUserTier';
import { useReasoningToggle } from '@/features/reasoning-toggle/hooks/useReasoningToggle';
import { isReasoningToggleable } from '@y0ngha/siglens-core';
import {
    AnalysisSignupNudgeModal,
    type SignupNudgeKind,
} from '@/features/analysis-nudge/ui/AnalysisSignupNudgeModal';
import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';

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
     * Whether the selected model's reasoning toggle changes anything at all.
     *
     * Orthogonal to {@link canUseReasoning}: that one is about the caller's
     * tier, this one about the model. A member on `claude-haiku-4-5` may use
     * the feature in principle but the toggle is inert for that model, so the
     * control is disabled rather than shown as an unlocked switch.
     */
    isReasoningSupported: boolean;
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
     * locked-toggle nudge (`SymbolLayoutHeader`) and the anonymous first-analysis
     * auto-nudge (`ChartContent` → `useAnonAnalysisNudge`) share a single
     * instance instead of each mounting their own `fixed inset-0 z-50` dialog
     * — two stacked modals would clash over focus-trap/Escape handling. The
     * open-state itself is provider-LOCAL (not exposed on the context value)
     * so opening/closing the modal never changes the context value identity
     * and thus never re-renders unrelated `useSymbolModel()` consumers.
     */
    openSignupNudge: () => void;
    /**
     * Open the same shared modal with a specific copy variant. The anonymous
     * auto-nudge uses this to alternate between the reasoning ("상세 분석") and
     * email-report pitches; `openSignupNudge` stays argument-free because it is
     * passed straight to click handlers, which would hand it the click event.
     */
    openSignupNudgeAs: (variant: SignupNudgeVariant) => void;
    /** Dismiss the shared signup-nudge modal. */
    closeSignupNudge: () => void;
}

/** 공유 가입 넛지 모달의 열림 상태 — 어떤 문구를, 어떤 계기로. 닫혀 있으면 null. */
interface SignupNudgeState {
    kind: SignupNudgeKind;
    variant: SignupNudgeVariant;
}

const SymbolModelContext = createContext<SymbolModelContextValue | null>(null);

interface SymbolModelProviderProps {
    children: ReactNode;
}

export function SymbolModelProvider({ children }: SymbolModelProviderProps) {
    // Single shared open-state for the signup-nudge modal. Both entry points
    // (locked-toggle click in the header, first-analysis auto-nudge in ChartContent)
    // flip this same flag, and the modal is rendered once below — see the
    // `openSignupNudge` doc for why a single instance is required. This state
    // is provider-LOCAL and intentionally NOT part of the context value: only
    // the provider reads it (to render the modal), so keeping it out of the
    // memoized value means open/close never churns `useSymbolModel()` consumers.
    // (Declared first per the useState → custom-hooks → derived → handlers
    // hook-ordering convention — REACT.md "Custom Hook Declaration Order".)
    const [signupNudge, setSignupNudge] = useState<SignupNudgeState | null>(
        null
    );

    const { tier, isLoading: isTierLoading } = useUserTier();
    const allowedModels = useMemo(() => getAllowedModels(tier), [tier]);
    const isTierHydrated = !isTierLoading;
    const [modelId, setModelId, isHydrated] = useSelectedModel(
        allowedModels,
        isTierHydrated
    );
    const { gateModal, dismissGate, handleModelChange } = useModelGate({
        onAllow: setModelId,
    });
    const [storedReasoning, setReasoning, isReasoningHydrated] =
        useReasoningToggle();
    // free(익명 포함) tier는 서버에서도 강제되지만(resolveReasoning), 클라에서도
    // 미리 false로 접어 두면 downgrade(로그아웃/등급 하락) 직후 stale true 값이
    // 한 프레임이라도 실제 submit에 실려 나가는 것을 방지한다.
    const canUseReasoning = tier !== 'free';
    // 등급과 별개로, 토글이 아무 효과도 없는 모델이 있다(`claude-haiku-4-5` —
    // `off`와 `on`이 동일). 그런 모델에서는 컨트롤을 비활성화해야 한다. 켜도
    // 아무 일이 없는데 켜졌다고 보이는 편이 더 나쁘다.
    const isReasoningSupported = isReasoningToggleable(modelId);
    const reasoning =
        canUseReasoning && isReasoningSupported && storedReasoning;

    // 잠긴 추론 토글 클릭. 문구는 늘 상세 분석이고, 퍼널에는 `reasoning_toggle`로 남는다.
    const openSignupNudge = useCallback(
        () =>
            setSignupNudge({ kind: 'reasoning_toggle', variant: 'reasoning' }),
        []
    );
    // 익명 첫 분석 자동 넛지. 문구를 번갈아 쓰고, 퍼널에는 `anon_auto`+variant로 남는다.
    const openSignupNudgeAs = useCallback(
        (variant: SignupNudgeVariant) =>
            setSignupNudge({ kind: 'anon_auto', variant }),
        []
    );
    const closeSignupNudge = useCallback(() => setSignupNudge(null), []);

    const value = useMemo(
        () => ({
            modelId,
            allowedModels,
            isHydrated,
            tier,
            isTierHydrated,
            gateModal,
            dismissGate,
            handleModelChange,
            reasoning,
            setReasoning,
            canUseReasoning,
            isReasoningSupported,
            isReasoningHydrated,
            openSignupNudge,
            openSignupNudgeAs,
            closeSignupNudge,
        }),
        [
            modelId,
            allowedModels,
            isHydrated,
            tier,
            isTierHydrated,
            gateModal,
            dismissGate,
            handleModelChange,
            reasoning,
            setReasoning,
            canUseReasoning,
            isReasoningSupported,
            isReasoningHydrated,
            openSignupNudge,
            openSignupNudgeAs,
            closeSignupNudge,
        ]
    );

    return (
        <SymbolModelContext.Provider value={value}>
            {children}
            {/* Single signup-nudge modal instance shared by the header's
                locked-toggle nudge and ChartContent's first-analysis auto-nudge. */}
            {signupNudge !== null && (
                <AnalysisSignupNudgeModal
                    kind={signupNudge.kind}
                    variant={signupNudge.variant}
                    onClose={closeSignupNudge}
                />
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
