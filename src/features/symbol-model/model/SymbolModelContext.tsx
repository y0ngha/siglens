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
import { pickFallbackModel, useSelectedModel } from '../hooks/useSelectedModel';
import {
    useModelGate,
    type ModelGateState,
} from '@/features/premium-gate/hooks/useModelGate';
import { useUserTier } from '../hooks/useUserTier';
import { useDisabledServerKeyModels } from '../hooks/useDisabledServerKeyModels';
import { useReasoningToggle } from '@/features/reasoning-toggle/hooks/useReasoningToggle';
import { isReasoningToggleable } from '@y0ngha/siglens-core';
import {
    AnalysisSignupNudgeModal,
    type SignupNudgeKind,
} from '@/features/analysis-nudge/ui/AnalysisSignupNudgeModal';
import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';

interface SymbolModelContextValue {
    modelId: ModelId;
    /** 이 등급이 목록에서 보는 모델 전부. 일시 중단된 모델도 들어 있다(`unavailableModels`). */
    allowedModels: readonly ModelId[];
    /**
     * `allowedModels` 중 운영자가 꺼 둔 서버 키 모델(`SERVER_KEY_DISABLED_PROVIDERS`).
     * 목록에서 "일시 중단"으로 비활성 표시하고, 저장된 선택이 이 안에 있으면 기본 모델로 강등한다.
     */
    unavailableModels: readonly ModelId[];
    /**
     * 저장된 선택을 고를 수 없을 때 떨어지는 모델 — `useSelectedModel`이 강등에 쓰는 것과 같은
     * 규칙(`pickFallbackModel`)을 고를 수 있는 모델(허용 − 일시 중단)에 적용한 값이다.
     */
    fallbackModel: ModelId;
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
     * tier, this one about the model. On a model whose `off` and `on` states
     * are identical (core spec `toggleable: false`, decided by
     * `isReasoningToggleable`) the toggle is inert, so the control is disabled
     * rather than shown as an unlocked switch. The 2026-10 roster has no such
     * model; the branch stays for future ones.
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
    const { models: disabledModels, isSettled: isAvailabilitySettled } =
        useDisabledServerKeyModels();
    const allowedModels = useMemo(() => getAllowedModels(tier), [tier]);
    const unavailableModels = useMemo(
        () => allowedModels.filter(model => disabledModels.includes(model)),
        [allowedModels, disabledModels]
    );
    // 선택 검증은 고를 수 있는 모델로만 한다 — 꺼진 모델 저장값은 기본 모델로 떨어진다.
    // 저장값(localStorage)은 지우지 않으므로 스위치를 다시 켜면 다음 로드에 되살아난다.
    const selectableModels = useMemo(
        () =>
            unavailableModels.length === 0
                ? allowedModels
                : allowedModels.filter(
                      model => !unavailableModels.includes(model)
                  ),
        [allowedModels, unavailableModels]
    );
    const fallbackModel = useMemo(
        () => pickFallbackModel(selectableModels),
        [selectableModels]
    );
    const isTierHydrated = !isTierLoading;
    // 저장된 선택은 등급과 꺼진 모델 목록이 **둘 다** 확정된 뒤에 읽는다. 목록보다 먼저
    // 읽으면 꺼진 모델로 첫 분석이 나간 뒤 강등돼 같은 분석이 한 번 더 나간다.
    const [modelId, setModelId, isHydrated] = useSelectedModel(
        selectableModels,
        isTierHydrated && isAvailabilitySettled
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
    // 등급과 별개로, 토글이 아무 효과도 없는 모델(`off`와 `on`이 같은 모델)에서는
    // 컨트롤을 비활성화한다. 켜도 아무 일이 없는데 켜졌다고 보이는 편이 더 나쁘다.
    // 판정은 core `isReasoningToggleable`(스펙의 `toggleable: false`)이 한다. 2026-10
    // 로스터에는 그런 모델이 없지만(Haiku 4.5 퇴역), 다시 생길 때를 위해 분기를 유지한다.
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
            unavailableModels,
            fallbackModel,
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
            unavailableModels,
            fallbackModel,
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
