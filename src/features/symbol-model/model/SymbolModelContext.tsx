'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ModelId, Tier } from '@y0ngha/siglens-core';
import {
    useModelGate,
    type ModelGateState,
} from '@/features/premium-gate/hooks/useModelGate';
import { AnalysisSignupNudgeModal } from '@/features/analysis-nudge/ui/AnalysisSignupNudgeModal';
import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';
import { useEffectiveReasoning } from '../hooks/useEffectiveReasoning';
import { useModelSelection } from '../hooks/useModelSelection';
import { useSignupNudgeControls } from '../hooks/useSignupNudgeControls';

/** `useSymbolModel()`이 돌려주는 종목 페이지의 모델·추론·가입 넛지 상태. */
interface SymbolModelContextValue {
    /** 지금 선택된 분석 모델. `isHydrated` 전에는 기본 모델이다. */
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
    /** 저장된 선택을 읽었는지 — 분석 요청은 이 값이 참이 된 뒤에 보낸다. */
    isHydrated: boolean;
    /** 현재 사용자의 tier. 확정 전(`isTierHydrated` false)에는 core `DEFAULT_TIER`다. */
    tier: Tier;
    isTierHydrated: boolean;
    /** 열려 있는 premium 모델 게이트 안내(인증/BYOK). 없으면 `null`. */
    gateModal: ModelGateState | null;
    dismissGate: () => void;
    /** 모델 선택 UI가 부른다. 게이트를 통과한 선택만 저장된다. */
    handleModelChange: (model: ModelId) => void;
    /**
     * Effective "깊은 생각" (reasoning) value to send with an analysis request.
     * Already tier-gated: `false` for anonymous/free regardless of the
     * member's stored preference. Server-side `resolveReasoning` is the
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
     * rather than shown as an unlocked switch.
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

const SymbolModelContext = createContext<SymbolModelContextValue | null>(null);

interface SymbolModelProviderProps {
    children: ReactNode;
}

/**
 * 종목 레이아웃(헤더 + 탭 트리)을 감싸 모델 선택·추론 토글·가입 넛지를 한 곳에서 공유한다.
 * 가입 넛지 모달은 여기서 **한 번만** 그린다 — 열림 상태가 컨텍스트 값 밖에 있어 열고 닫아도
 * 소비자가 다시 렌더되지 않는다(`openSignupNudge` 문서 참조).
 */
export function SymbolModelProvider({ children }: SymbolModelProviderProps) {
    const {
        signupNudge,
        openSignupNudge,
        openSignupNudgeAs,
        closeSignupNudge,
    } = useSignupNudgeControls();
    const {
        tier,
        isTierHydrated,
        allowedModels,
        unavailableModels,
        fallbackModel,
        modelId,
        setModelId,
        isHydrated,
    } = useModelSelection();
    const { gateModal, dismissGate, handleModelChange } = useModelGate({
        onAllow: setModelId,
    });
    const {
        reasoning,
        setReasoning,
        canUseReasoning,
        isReasoningSupported,
        isReasoningHydrated,
    } = useEffectiveReasoning(tier, modelId);

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

/**
 * 종목 페이지의 모델·추론·넛지 상태를 읽는다. `SymbolModelProvider` 밖에서 부르면 던진다 —
 * 기본값을 두지 않아 배선 실수가 첫 렌더에서 드러난다.
 */
export function useSymbolModel(): SymbolModelContextValue {
    const ctx = useContext(SymbolModelContext);
    if (!ctx)
        throw new Error(
            'useSymbolModel must be used inside SymbolModelProvider'
        );
    return ctx;
}
