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
import { useShareable } from '@/features/share';
import { useUserTier } from '@/features/symbol-model/hooks/useUserTier';
import { createShareSnapshotAction } from '@/entities/shared-analysis/actions/createShareSnapshotAction';
import { canShareNatively, isShareAbort } from '@/shared/lib/share';
import { SITE_URL } from '@/shared/lib/seo';
import { cn } from '@/shared/lib/cn';
import { ShareSheet } from './ShareSheet';
import { ShareTriggerDialog } from './ShareTriggerDialog';
import { SharePreparingModal } from './SharePreparingModal';
import { ShareIcon, SpinnerIcon } from './icons';

/**
 * Header button that orchestrates the share flow for the current analysis tab.
 *
 * State machine (based on useShareable() status):
 * - null / 'unavailable' → button stays enabled; click shows inline notice.
 * - 'success'           → runShare() → createShareSnapshotAction → native share or ShareSheet.
 * - 'pending'           → open SharePreparingModal (already polling).
 * - 'idle' / 'error'   → open ShareTriggerDialog; on confirm → reg.trigger() + modal.
 *
 * Auto-advance: `hasTriggered` is set to true (in event handlers only) when the
 * user enters the preparing flow. A useEffect keyed on `hasTriggered` + `reg.status`
 * + `reg.result` watches for the status-to-'success' transition and automatically calls
 * runShare() without any setState (satisfying react-hooks/set-state-in-effect). The
 * preparingPhase ('pending' → 'error') is derived via useMemo from observable state,
 * so no setState is needed in the effect. The direct success-click path reuses the
 * same runShare() callback (DRY).
 */
export function ShareButton() {
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

    const reg = useShareable();
    const { tier: sharerTier } = useUserTier();

    /**
     * Stable refs to the latest reg and sharerTier values. The mutation fn reads
     * these so it always operates on the current registration even when called
     * from within the auto-advance effect (where the closure would otherwise close
     * over a stale 'pending' reg). Updated in a no-dep useEffect (runs after every
     * render, before the browser paints) so they are never read during render itself.
     */
    const regRef = useRef(reg);
    const sharerTierRef = useRef(sharerTier);
    useEffect(() => {
        regRef.current = reg;
        sharerTierRef.current = sharerTier;
    });

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
            return createShareSnapshotAction({
                kind: currentReg.kind,
                symbol: currentReg.context.symbol,
                context: currentReg.context,
                result: currentReg.result,
                sharerTier: sharerTierRef.current,
            });
        },
        onSuccess: async result => {
            if (!result.ok) {
                // Treat action-level errors as a benign close; no toast per spec.
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
     * Stable ref to mutation.mutate so runShare's identity never changes across
     * renders. Without this, every mutation state update (idle→pending→success)
     * would produce a new `mutation` object, a new `runShare`, and re-fire the
     * auto-advance effect while hasTriggered is still true — causing double mutate().
     */
    const mutateRef = useRef(mutation.mutate);
    useEffect(() => {
        mutateRef.current = mutation.mutate;
    });

    /**
     * Shared share-execution function used by both the direct success-click path and
     * the auto-advance effect. Stable identity prevents the auto-advance effect from
     * re-firing due to mutation state changes mid-flight.
     */
    const runShare = useCallback(() => {
        mutateRef.current();
    }, []);

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

    const effectiveStatus = reg?.status ?? 'unavailable';
    const isMutating = mutation.isPending;

    const handleClick = useCallback(() => {
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

    const handleTriggerConfirm = useCallback(() => {
        setTriggerDialogOpen(false);
        reg?.trigger();
        setHasTriggered(true);
        setPreparingOpen(true);
    }, [reg]);

    const handleTriggerCancel = useCallback(() => {
        setTriggerDialogOpen(false);
        buttonRef.current?.focus();
    }, []);

    const handlePreparingClose = useCallback(() => {
        setHasTriggered(false);
        setPreparingOpen(false);
        buttonRef.current?.focus();
    }, []);

    const handlePreparingRetry = useCallback(() => {
        reg?.trigger();
    }, [reg]);

    const handleSheetClose = useCallback(() => {
        setSheetOpen(false);
        buttonRef.current?.focus();
    }, []);

    const noticeId = useId();

    const symbol = reg?.context.symbol ?? '';
    const tweetText = `${symbol} AI 분석 결과를 SigLens에서 확인하세요`;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-label="분석 결과 공유"
                aria-busy={isMutating ? 'true' : undefined}
                aria-describedby={unavailableVisible ? noticeId : undefined}
                disabled={isMutating}
                onClick={handleClick}
                className={cn(
                    'border-secondary-700 text-secondary-300 inline-flex size-9 min-h-11 items-center justify-center rounded-lg border',
                    'hover:border-secondary-600 hover:bg-secondary-700/30 hover:text-secondary-100',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'touch-manipulation transition-colors'
                )}
            >
                {isMutating ? (
                    <SpinnerIcon className="h-5 w-5" />
                ) : (
                    <ShareIcon className="h-5 w-5" />
                )}
            </button>

            {unavailableVisible && (
                <p
                    id={noticeId}
                    role="status"
                    className="border-secondary-700 bg-secondary-900 text-secondary-400 absolute top-full right-0 z-50 mt-1 w-max max-w-xs rounded-lg border px-3 py-2 text-xs shadow-lg"
                >
                    이 탭은 공유할 분석이 아직 없어요
                </p>
            )}

            {sheetOpen && shareUrl && (
                <ShareSheet
                    shareUrl={shareUrl}
                    tweetText={tweetText}
                    title={`${symbol} AI 분석 결과`}
                    description={tweetText}
                    onClose={handleSheetClose}
                />
            )}

            <ShareTriggerDialog
                open={triggerDialogOpen}
                onConfirm={handleTriggerConfirm}
                onCancel={handleTriggerCancel}
            />

            <SharePreparingModal
                open={preparingOpen}
                phase={preparingPhase}
                onClose={handlePreparingClose}
                onRetry={handlePreparingRetry}
            />
        </div>
    );
}
