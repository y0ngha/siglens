'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import { cn } from '@/shared/lib/cn';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio';
import { HoldingForm } from './HoldingForm';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';

const ROW_CHROME =
    'ring-secondary-800 bg-secondary-900/60 rounded-xl p-4 ring-1';
const ACTION_BUTTON =
    'border-secondary-700 text-secondary-300 hover:bg-secondary-800 focus-visible:ring-primary-500 touch-manipulation rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const DANGER_BUTTON =
    'text-ui-danger-text border-ui-danger/40 hover:bg-ui-danger/10 focus-visible:ring-ui-danger touch-manipulation rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={cn('bg-secondary-800 animate-pulse rounded', className)}
        />
    );
}

function HoldingsSkeleton() {
    const t = useTranslations('features.portfolio-management');
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">{t('PortfolioSection.e8f6b4')}</span>
            <div className="space-y-2" aria-hidden="true">
                {[0, 1].map(i => (
                    <div key={i} className={ROW_CHROME}>
                        <SkeletonLine className="h-4 w-24" />
                        <SkeletonLine className="mt-2 h-3 w-40" />
                    </div>
                ))}
            </div>
        </div>
    );
}

interface HoldingRowProps {
    holding: PortfolioHoldingView;
    isEditing: boolean;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSave: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    isSaving: boolean;
    onDelete: () => void;
    isConfirmingDelete: boolean;
    onRequestDelete: () => void;
    onCancelDelete: () => void;
    isDeleting: boolean;
    deleteError: string | null;
}

function HoldingRow({
    holding,
    isEditing,
    onStartEdit,
    onCancelEdit,
    onSave,
    isSaving,
    onDelete,
    isConfirmingDelete,
    onRequestDelete,
    onCancelDelete,
    isDeleting,
    deleteError,
}: HoldingRowProps) {
    const t = useTranslations('features.portfolio-management');
    const deleteButtonRef = useRef<HTMLButtonElement>(null);
    const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
    const wasConfirmingDeleteRef = useRef(isConfirmingDelete);

    // Move focus once on each delete-confirm transition instead of letting it
    // drop to <body> when the row swaps its buttons out. Entering confirm ->
    // focus "삭제 확정"; leaving confirm (cancel) -> return focus to "삭제".
    // This is a row control swap, not a dialog, so we move focus once and do
    // not trap it.
    useEffect(() => {
        if (isConfirmingDelete && !wasConfirmingDeleteRef.current) {
            confirmDeleteButtonRef.current?.focus();
        } else if (!isConfirmingDelete && wasConfirmingDeleteRef.current) {
            deleteButtonRef.current?.focus();
        }
        wasConfirmingDeleteRef.current = isConfirmingDelete;
    }, [isConfirmingDelete]);

    if (isEditing) {
        return (
            <li className={ROW_CHROME}>
                <HoldingForm
                    initial={holding}
                    onSubmit={onSave}
                    submitting={isSaving}
                    onCancel={onCancelEdit}
                    autoFocusFirstField
                />
            </li>
        );
    }

    return (
        <li className={ROW_CHROME}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-secondary-100">
                            {holding.symbol}
                        </span>
                        {holding.companyName && (
                            <span className="truncate text-sm text-secondary-400">
                                {holding.companyName}
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 text-sm text-secondary-400 tabular-nums">
                        {t('PortfolioSection.91d7d2', {
                            v0: trimTrailingZeros(holding.quantity),
                            v1: trimTrailingZeros(holding.averagePrice),
                        })}
                    </div>
                </div>

                {isConfirmingDelete ? (
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-secondary-400">
                            {t('PortfolioSection.ac4dd7')}
                        </span>
                        <button
                            ref={confirmDeleteButtonRef}
                            type="button"
                            onClick={onDelete}
                            disabled={isDeleting}
                            aria-busy={isDeleting}
                            className={DANGER_BUTTON}
                        >
                            {isDeleting
                                ? t('PortfolioSection.283e16')
                                : t('PortfolioSection.eca4ac')}
                        </button>
                        <button
                            type="button"
                            onClick={onCancelDelete}
                            disabled={isDeleting}
                            className={ACTION_BUTTON}
                        >
                            {t('PortfolioSection.19b2d1')}
                        </button>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={onStartEdit}
                            aria-label={t('PortfolioSection.editHolding', {
                                v0: holding.symbol,
                            })}
                            className={ACTION_BUTTON}
                        >
                            {t('PortfolioSection.e1407b')}
                        </button>
                        <button
                            ref={deleteButtonRef}
                            type="button"
                            onClick={onRequestDelete}
                            aria-label={t('PortfolioSection.deleteHolding', {
                                v0: holding.symbol,
                            })}
                            className={DANGER_BUTTON}
                        >
                            {t('PortfolioSection.fc81e2')}
                        </button>
                    </div>
                )}
            </div>
            <div role="alert" className="min-h-5 text-sm">
                {deleteError && (
                    <span className="text-ui-danger">{deleteError}</span>
                )}
            </div>
        </li>
    );
}

/** Account-page section for managing the member's portfolio holdings: list + inline edit + inline delete confirm + add form. */
export function PortfolioSection() {
    const t = useTranslations('features.portfolio-management');
    const tToast = useTranslations('features.portfolio-management.toast');
    const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
    const [confirmingDeleteSymbol, setConfirmingDeleteSymbol] = useState<
        string | null
    >(null);
    const [deleteError, setDeleteError] = useState<{
        symbol: string;
        message: string;
    } | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    // Bumped on every successful delete; a dedicated effect (below) reacts to
    // it rather than calling .focus() straight from handleDelete, because
    // HoldingRow has its own effect that returns focus to its "삭제" button
    // whenever isConfirmingDelete flips back to false — which also happens on
    // a *successful* delete (confirmingDeleteSymbol resets the same way a
    // cancel would). React flushes child effects before parent effects within
    // the same commit, so driving this focus move through a parent-level
    // effect (instead of an inline call) guarantees it runs after — and wins
    // over — HoldingRow's, landing focus on the heading rather than a button
    // that may be about to unmount.
    const [deleteSuccessTick, setDeleteSuccessTick] = useState(0);
    const headingRef = useRef<HTMLHeadingElement>(null);

    const { holdings, isHydrated, isLoading, isError, refetch, save, remove } =
        usePortfolioHoldings();

    const isLoadingState = !isHydrated || isLoading;

    // Fires once per successful delete (see deleteSuccessTick above).
    useEffect(() => {
        if (deleteSuccessTick > 0) {
            headingRef.current?.focus();
        }
    }, [deleteSuccessTick]);

    const handleDelete = async (symbol: string) => {
        setDeleteError(null);
        setStatusMessage(null);
        try {
            const result = await remove.mutateAsync(symbol);
            if (result.status === 'error') {
                setDeleteError({ symbol, message: result.message });
                return;
            }
            setConfirmingDeleteSymbol(null);
            setStatusMessage(tToast('holdingDeleted', { v0: symbol }));
            setDeleteSuccessTick(tick => tick + 1);
        } catch {
            // remove.mutateAsync can reject outright (e.g. getCurrentUser()
            // throwing on a session outage, or an RSC transport failure) —
            // deletePortfolioHoldingAction only catches its own DB errors and
            // returns a `status: 'error'` result, it doesn't guard those.
            // Mirror HoldingForm.handleSubmit's save-path guard so a delete
            // failure surfaces the same per-row feedback instead of an
            // unhandled promise rejection.
            setDeleteError({
                symbol,
                message: t('PortfolioSection.19d04f'),
            });
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="rounded-sm text-lg font-semibold text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('PortfolioSection.cae421')}
                </h2>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('PortfolioSection.060e90')}
                </p>
            </div>

            <div role="status" aria-live="polite" className="min-h-5 text-sm">
                {statusMessage && (
                    <span className="text-ui-success">{statusMessage}</span>
                )}
            </div>

            {isLoadingState && <HoldingsSkeleton />}

            {!isLoadingState && isError && (
                <div
                    role="alert"
                    className="rounded-xl border border-dashed border-secondary-800 px-4 py-6 text-center text-sm text-secondary-400"
                >
                    <p>{t('PortfolioSection.4e29b2')}</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className={cn(ACTION_BUTTON, 'mt-3')}
                    >
                        {t('PortfolioSection.0c767c')}
                    </button>
                </div>
            )}

            {!isLoadingState && !isError && holdings.length === 0 && (
                <p className="rounded-xl border border-dashed border-secondary-800 px-4 py-6 text-center text-sm text-secondary-400">
                    {t('PortfolioSection.20b566')}
                </p>
            )}

            {!isLoadingState && !isError && holdings.length > 0 && (
                <ul className="space-y-2">
                    {holdings.map(holding => (
                        <HoldingRow
                            key={holding.symbol}
                            holding={holding}
                            isEditing={editingSymbol === holding.symbol}
                            onStartEdit={() => {
                                setConfirmingDeleteSymbol(null);
                                setEditingSymbol(holding.symbol);
                            }}
                            onCancelEdit={() => setEditingSymbol(null)}
                            onSave={async input => {
                                setStatusMessage(null);
                                const result = await save.mutateAsync(input);
                                if (result.status === 'ok') {
                                    setEditingSymbol(null);
                                    setStatusMessage(
                                        tToast('holdingSaved', {
                                            v0: result.holding.symbol,
                                        })
                                    );
                                }
                                return result;
                            }}
                            isSaving={save.isPending}
                            onDelete={() => handleDelete(holding.symbol)}
                            isConfirmingDelete={
                                confirmingDeleteSymbol === holding.symbol
                            }
                            onRequestDelete={() => {
                                setEditingSymbol(null);
                                setDeleteError(null);
                                setConfirmingDeleteSymbol(holding.symbol);
                            }}
                            onCancelDelete={() =>
                                setConfirmingDeleteSymbol(null)
                            }
                            isDeleting={remove.isPending}
                            deleteError={
                                deleteError?.symbol === holding.symbol
                                    ? deleteError.message
                                    : null
                            }
                        />
                    ))}
                </ul>
            )}

            {!isLoadingState && !isError && (
                <div className="space-y-2 border-t border-secondary-800 pt-4">
                    <h3 className="text-sm font-semibold text-secondary-200">
                        {t('PortfolioSection.0a4e7f')}
                    </h3>
                    <HoldingForm
                        onSubmit={async input => {
                            setStatusMessage(null);
                            const result = await save.mutateAsync(input);
                            if (result.status === 'ok') {
                                setStatusMessage(
                                    tToast('holdingSaved', {
                                        v0: result.holding.symbol,
                                    })
                                );
                            }
                            return result;
                        }}
                        submitting={save.isPending && editingSymbol === null}
                    />
                </div>
            )}
        </div>
    );
}
