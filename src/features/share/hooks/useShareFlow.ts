'use client';

import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { useShareable } from '../model/ShareableAnalysisContext';
import type { ShareableRegistration } from '../model/ShareableAnalysisContext';
import { useUserTier } from '@/features/symbol-model/hooks/useUserTier';
import type { Tier } from '@y0ngha/siglens-core';
import { createShareSnapshotAction } from '@/entities/shared-analysis/actions/createShareSnapshotAction';
import { MAX_CHART_BARS } from '@/entities/shared-analysis';
import { canShareNatively, isShareAbort } from '@/shared/lib/share';
import { SITE_URL } from '@/shared/lib/seo';

/**
 * Return type of useShareFlow — contains all state and handlers that
 * ShareButton needs to render and respond to user interaction.
 */
export interface UseShareFlowResult {
    /** Effective share status, 'unavailable' when no registration. */
    status: 'idle' | 'pending' | 'success' | 'error' | 'unavailable';
    /** True while the createShareSnapshotAction mutation is in flight. */
    isMutating: boolean;
    /** Controls the bottom-sheet that shows the share URL / tweet link. */
    sheetOpen: boolean;
    /** Controls the "trigger analysis to share" confirmation dialog. */
    triggerDialogOpen: boolean;
    /** Controls the analysis-preparing modal (includes error phase). */
    preparingOpen: boolean;
    /** Phase shown inside the preparing modal. */
    preparingPhase: 'pending' | 'error';
    /** True when the inline "unavailable" notice should be visible. */
    unavailableVisible: boolean;
    /** The share URL after a successful snapshot, needed by ShareSheet. */
    shareUrl: string | null;
    /** Tweet text derived from the symbol context. */
    tweetText: string;
    /** aria-describedby id for the unavailable notice element. */
    describedById: string;
    /** Symbol string for rendering titles / aria labels. */
    symbol: string;
    /** Ref to pass to the trigger button element for focus management. */
    buttonRef: React.RefObject<HTMLButtonElement | null>;
    /** Click handler for the main share button. */
    onClick: () => void;
    /** Called when the user confirms the trigger dialog. */
    onTriggerConfirm: () => void;
    /** Called when the user cancels the trigger dialog. */
    onTriggerCancel: () => void;
    /** Called when the preparing modal closes (✕ or background). */
    onPreparingClose: () => void;
    /** Called when the user retries from inside the preparing modal. */
    onPreparingRetry: () => void;
    /** Called when the share sheet closes. */
    onSheetClose: () => void;
}

/**
 * Orchestrates the full share flow for the currently active analysis tab.
 *
 * State machine (based on useShareable() status):
 * - null / 'unavailable' → click shows inline notice.
 * - 'success'           → runShare() → createShareSnapshotAction → native share or ShareSheet.
 * - 'pending'           → open SharePreparingModal (already polling).
 * - 'idle' / 'error'   → open ShareTriggerDialog; on confirm → reg.trigger() + modal.
 *
 * Auto-advance: `hasTriggered` is set in event handlers when the user enters the
 * preparing flow. A useEffect keyed on `hasTriggered` + `reg.status` + `reg.result`
 * watches for the 'success' transition and calls runShare() automatically without any
 * setState (satisfying react-hooks/set-state-in-effect). State cleanup happens inside
 * the mutation's async onSuccess callback.
 */
export function useShareFlow(): UseShareFlowResult {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
    const [preparingOpen, setPreparingOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [unavailableVisible, setUnavailableVisible] = useState(false);
    /**
     * True when the user is in the preparing flow (set in event handlers, never in
     * effects). Combined with `reg.status` to derive preparingPhase and gate the
     * auto-advance effect. Cleared in onSuccess (async callback) and handlePreparingClose.
     */
    const [hasTriggered, setHasTriggered] = useState(false);

    const buttonRef = useRef<HTMLButtonElement>(null);
    /**
     * Stable refs to the latest reg and sharerTier values. The mutation fn reads
     * these so it always operates on the current registration even when called
     * from within the auto-advance effect (where the closure would otherwise close
     * over a stale 'pending' reg). Updated in a no-dep useEffect (runs after every
     * render) so they are never read during render itself.
     */
    const regRef = useRef<ShareableRegistration | null>(null);
    const sharerTierRef = useRef<Tier>('free');
    /**
     * Stable ref to mutation.mutate so runShare's identity never changes across
     * renders. Without this, every mutation state update (idle→pending→success)
     * would produce a new `mutation` object, a new `runShare`, and re-fire the
     * auto-advance effect while hasTriggered is still true — causing double mutate().
     */
    const mutateRef = useRef<() => void>(() => undefined);

    const reg = useShareable();
    const { tier: sharerTier } = useUserTier();

    /**
     * Reset all transient UI state when the user switches to a different analysis tab.
     *
     * Uses the getDerivedStateFromProps-equivalent pattern (setState during render)
     * to avoid the react-hooks/set-state-in-effect lint rule while still resetting
     * synchronously before the next paint.
     */
    const [prevKind, setPrevKind] = useState(reg?.kind);
    if (prevKind !== reg?.kind) {
        setPrevKind(reg?.kind);
        setSheetOpen(false);
        setTriggerDialogOpen(false);
        setPreparingOpen(false);
        setUnavailableVisible(false);
        setHasTriggered(false);
    }

    const mutation = useMutation({
        mutationFn: async () => {
            const currentReg = regRef.current;
            if (
                !currentReg ||
                currentReg.status !== 'success' ||
                !currentReg.result
            ) {
                throw new Error('No shareable result available');
            }
            // Slice to the last MAX_CHART_BARS candles (most recent = most relevant
            // for the analysis). The server re-validates the count in isValidShareInput;
            // this client-side cap prevents exceeding the server limit before the
            // network round-trip.
            const chartBars =
                currentReg.kind === 'chart' &&
                currentReg.chartBars !== undefined &&
                currentReg.chartBars.length > 0
                    ? currentReg.chartBars.slice(-MAX_CHART_BARS)
                    : undefined;
            return createShareSnapshotAction({
                kind: currentReg.kind,
                symbol: currentReg.context.symbol,
                context: currentReg.context,
                result: currentReg.result,
                sharerTier: sharerTierRef.current,
                ...(chartBars !== undefined && { chartBars }),
            });
        },
        onError: () => {
            // Network / unexpected throw: dismiss the preparing modal so it
            // doesn't stay stuck, and reset the auto-advance gate.
            setHasTriggered(false);
            setPreparingOpen(false);
        },
        onSuccess: async result => {
            if (!result.ok) {
                // Action-level error (e.g. rate_limited, persist_failed): dismiss
                // preparing modal so it doesn't stay stuck, reset auto-advance gate.
                setHasTriggered(false);
                setPreparingOpen(false);
                return;
            }
            const url = `${SITE_URL}/share/${result.id}`;
            setShareUrl(url);

            const symbol = regRef.current?.context.symbol ?? '';
            const title = `${symbol} AI 분석 결과`;
            const text = `${symbol} AI 분석 결과를 SigLens에서 확인하세요`;

            if (canShareNatively()) {
                try {
                    await navigator.share({ title, text, url });
                    // Reset preparing-flow state so the auto-advance effect cannot
                    // re-fire on a subsequent provider re-render (double-fire guard).
                    setHasTriggered(false);
                    setPreparingOpen(false);
                } catch (err) {
                    if (!isShareAbort(err)) {
                        // Non-abort errors: fall through to sheet.
                        setSheetOpen(true);
                    }
                    // AbortError → user dismissed OS sheet, silently ignore.
                    // Reset preparing-flow state in both error sub-cases so the
                    // SharePreparingModal is dismissed and the auto-advance effect
                    // is gated out on the next render.
                    setHasTriggered(false);
                    setPreparingOpen(false);
                }
            } else {
                // Close preparing modal if open and open sheet.
                setHasTriggered(false);
                setPreparingOpen(false);
                setSheetOpen(true);
            }
        },
    });

    /**
     * Phase is derived purely from observable state — no setState called during render
     * and no refs read during render. Error phase only shows after the user has
     * actually triggered analysis (`hasTriggered`) and the result came back as an error,
     * preventing a false error phase when opening the modal from an already-errored reg.
     */
    const preparingPhase = useMemo((): 'pending' | 'error' => {
        if (preparingOpen && hasTriggered && reg?.status === 'error') {
            return 'error';
        }
        return 'pending';
    }, [preparingOpen, hasTriggered, reg?.status]);

    /**
     * Shared share-execution function used by both the direct success-click path and
     * the auto-advance effect. Stable identity prevents the auto-advance effect from
     * re-firing due to mutation state changes mid-flight.
     */
    const runShare = useCallback(() => {
        mutateRef.current();
    }, []);

    // Placed after useMemo/useCallback per MISTAKES #17 strict hook order:
    // useState/useRef → hooks/useMutation → useCallback/useMemo → derived → handlers → useEffect.
    const effectiveStatus = reg?.status ?? 'unavailable';
    const isMutating = mutation.isPending;

    const onClick = useCallback(() => {
        // Prevent double-click while mutation is in flight.
        if (isMutating) return;

        // Hide stale unavailable notice on each click.
        setUnavailableVisible(false);

        if (effectiveStatus === 'unavailable' || reg === null) {
            setUnavailableVisible(true);
            return;
        }

        if (effectiveStatus === 'success') {
            runShare();
            return;
        }

        if (effectiveStatus === 'pending') {
            setHasTriggered(true);
            setPreparingOpen(true);
            return;
        }

        // 'idle' | 'error'
        setTriggerDialogOpen(true);
    }, [isMutating, effectiveStatus, reg, runShare]);

    const onTriggerConfirm = useCallback(() => {
        setTriggerDialogOpen(false);
        reg?.trigger();
        setHasTriggered(true);
        setPreparingOpen(true);
    }, [reg]);

    const onTriggerCancel = useCallback(() => {
        setTriggerDialogOpen(false);
        buttonRef.current?.focus();
    }, []);

    const onPreparingClose = useCallback(() => {
        setHasTriggered(false);
        setPreparingOpen(false);
        buttonRef.current?.focus();
    }, []);

    const onPreparingRetry = useCallback(() => {
        reg?.trigger();
    }, [reg]);

    const onSheetClose = useCallback(() => {
        setSheetOpen(false);
        buttonRef.current?.focus();
    }, []);

    /**
     * Keep all stable refs in sync with the latest values so callbacks and the
     * mutation fn always read up-to-date state without stale closure issues.
     * No deps (runs after every render) — intentional: always reflects latest values.
     */
    useEffect(() => {
        regRef.current = reg;
        sharerTierRef.current = sharerTier;
        mutateRef.current = mutation.mutate;
    });

    /**
     * When the user has triggered analysis (hasTriggered) and the result becomes
     * available (reg transitions to 'success'), automatically execute the share.
     * This effect only calls runShare() — an external-system side-effect via React
     * Query — and does NOT call setState directly, complying with the
     * react-hooks/set-state-in-effect rule. State cleanup happens inside the mutation's
     * async onSuccess callback.
     */
    useEffect(() => {
        if (!hasTriggered) return;
        if (reg?.status === 'success' && reg.result != null) {
            runShare();
        }
    }, [hasTriggered, reg?.status, reg?.result, runShare]);

    const describedById = useId();
    const symbol = reg?.context.symbol ?? '';
    const tweetText = `${symbol} AI 분석 결과를 SigLens에서 확인하세요`;

    return {
        status: effectiveStatus,
        isMutating,
        sheetOpen,
        triggerDialogOpen,
        preparingOpen,
        preparingPhase,
        unavailableVisible,
        shareUrl,
        tweetText,
        describedById,
        symbol,
        buttonRef,
        onClick,
        onTriggerConfirm,
        onTriggerCancel,
        onPreparingClose,
        onPreparingRetry,
        onSheetClose,
    };
}
