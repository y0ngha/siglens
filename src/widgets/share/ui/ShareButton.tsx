'use client';

import { useCallback, useId, useRef, useState } from 'react';
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
 * - 'success'           → mutate createShareSnapshotAction → native share or ShareSheet.
 * - 'pending'           → open SharePreparingModal (already polling).
 * - 'idle' / 'error'   → open ShareTriggerDialog; on confirm → reg.trigger() + modal.
 *
 * Auto-advance: when preparingModal is open and reg.status transitions to 'success',
 * the ShareButton's render cycle will re-evaluate via useShareable() re-render and the
 * pending-to-success path is handled by the useEffect below. This keeps the implementation
 * simple without wiring an extra effect inside the modal itself.
 */
export function ShareButton() {
    // ── state ────────────────────────────────────────────────────────────
    const [sheetOpen, setSheetOpen] = useState(false);
    const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
    const [preparingOpen, setPreparingOpen] = useState(false);
    const [preparingPhase, setPreparingPhase] = useState<'pending' | 'error'>(
        'pending'
    );
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [unavailableVisible, setUnavailableVisible] = useState(false);

    // ── refs ─────────────────────────────────────────────────────────────
    const buttonRef = useRef<HTMLButtonElement>(null);

    // ── hooks ─────────────────────────────────────────────────────────────
    const reg = useShareable();
    const { tier: sharerTier } = useUserTier();

    // ── mutation ──────────────────────────────────────────────────────────
    const mutation = useMutation({
        mutationFn: async () => {
            if (!reg || reg.status !== 'success' || !reg.result) {
                throw new Error('No shareable result available');
            }
            return createShareSnapshotAction({
                kind: reg.kind,
                symbol: reg.context.symbol,
                context: reg.context,
                result: reg.result,
                sharerTier,
            });
        },
        onSuccess: async result => {
            if (!result.ok) {
                // Treat action-level errors as a benign close; no toast per spec.
                return;
            }
            const url = `${SITE_URL}/share/${result.id}`;
            setShareUrl(url);

            const symbol = reg?.context.symbol ?? '';
            const title = `${symbol} AI 분석 결과`;
            const text = `${symbol} AI 분석 결과를 SigLens에서 확인하세요`;

            if (canShareNatively()) {
                try {
                    await navigator.share({ title, text, url });
                } catch (err) {
                    if (!isShareAbort(err)) {
                        // Non-abort errors: fall through to sheet.
                        setSheetOpen(true);
                    }
                    // AbortError → user dismissed OS sheet, silently ignore.
                }
            } else {
                // Close preparing modal if open, open sheet.
                setPreparingOpen(false);
                setSheetOpen(true);
            }
        },
    });

    // ── derived ──────────────────────────────────────────────────────────
    const effectiveStatus = reg?.status ?? 'unavailable';
    const isMutating = mutation.isPending;

    // ── handlers ─────────────────────────────────────────────────────────
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
            mutation.mutate();
            return;
        }

        if (effectiveStatus === 'pending') {
            setPreparingPhase('pending');
            setPreparingOpen(true);
            return;
        }

        // 'idle' | 'error'
        setTriggerDialogOpen(true);
    }, [isMutating, effectiveStatus, reg, mutation]);

    const handleTriggerConfirm = useCallback(() => {
        setTriggerDialogOpen(false);
        reg?.trigger();
        setPreparingPhase('pending');
        setPreparingOpen(true);
    }, [reg]);

    const handleTriggerCancel = useCallback(() => {
        setTriggerDialogOpen(false);
        buttonRef.current?.focus();
    }, []);

    const handlePreparingClose = useCallback(() => {
        setPreparingOpen(false);
        buttonRef.current?.focus();
    }, []);

    const handlePreparingRetry = useCallback(() => {
        reg?.trigger();
        setPreparingPhase('pending');
    }, [reg]);

    const handleSheetClose = useCallback(() => {
        setSheetOpen(false);
        buttonRef.current?.focus();
    }, []);

    // ── unavailable notice id ─────────────────────────────────────────────
    const noticeId = useId();

    // ── tweet text ────────────────────────────────────────────────────────
    const symbol = reg?.context.symbol ?? '';
    const tweetText = `${symbol} AI 분석 결과를 SigLens에서 확인하세요`;

    return (
        <div className="relative">
            {/* ── Share button ──────────────────────────────────────────── */}
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

            {/* ── Unavailable inline notice ─────────────────────────────── */}
            {unavailableVisible && (
                <p
                    id={noticeId}
                    role="status"
                    className="border-secondary-700 bg-secondary-900 text-secondary-400 absolute top-full right-0 z-50 mt-1 w-max max-w-xs rounded-lg border px-3 py-2 text-xs shadow-lg"
                >
                    이 탭은 공유할 분석이 아직 없어요
                </p>
            )}

            {/* ── ShareSheet (desktop popover) ─────────────────────────── */}
            {sheetOpen && shareUrl && (
                <ShareSheet
                    shareUrl={shareUrl}
                    tweetText={tweetText}
                    title={`${symbol} AI 분석 결과`}
                    description={tweetText}
                    onClose={handleSheetClose}
                />
            )}

            {/* ── ShareTriggerDialog ───────────────────────────────────── */}
            <ShareTriggerDialog
                open={triggerDialogOpen}
                onConfirm={handleTriggerConfirm}
                onCancel={handleTriggerCancel}
            />

            {/* ── SharePreparingModal ──────────────────────────────────── */}
            <SharePreparingModal
                open={preparingOpen}
                phase={preparingPhase}
                onClose={handlePreparingClose}
                onRetry={handlePreparingRetry}
            />
        </div>
    );
}
