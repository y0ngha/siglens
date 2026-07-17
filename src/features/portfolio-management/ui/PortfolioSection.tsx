'use client';

import { useState } from 'react';
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
    'border-secondary-700 text-secondary-300 hover:bg-secondary-800 focus-visible:ring-primary-500 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const DANGER_BUTTON =
    'text-ui-danger-text border-ui-danger/40 hover:bg-ui-danger/10 focus-visible:ring-ui-danger rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={cn('bg-secondary-800 animate-pulse rounded', className)}
        />
    );
}

function HoldingsSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">보유종목을 불러오는 중이에요</span>
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
    if (isEditing) {
        return (
            <li className={ROW_CHROME}>
                <HoldingForm
                    initial={holding}
                    onSubmit={onSave}
                    submitting={isSaving}
                    onCancel={onCancelEdit}
                />
            </li>
        );
    }

    return (
        <li className={ROW_CHROME}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-secondary-100 font-semibold">
                            {holding.symbol}
                        </span>
                        {holding.companyName && (
                            <span className="text-secondary-400 truncate text-sm">
                                {holding.companyName}
                            </span>
                        )}
                    </div>
                    <div className="text-secondary-400 mt-0.5 text-sm tabular-nums">
                        {trimTrailingZeros(holding.quantity)}주 · 평단 $
                        {trimTrailingZeros(holding.averagePrice)}
                    </div>
                </div>

                {isConfirmingDelete ? (
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-secondary-400 text-xs">
                            삭제할까요?
                        </span>
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={isDeleting}
                            aria-busy={isDeleting}
                            className={DANGER_BUTTON}
                        >
                            {isDeleting ? '삭제 중…' : '삭제 확정'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancelDelete}
                            disabled={isDeleting}
                            className={ACTION_BUTTON}
                        >
                            취소
                        </button>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={onStartEdit}
                            aria-label={`${holding.symbol} 보유종목 수정`}
                            className={ACTION_BUTTON}
                        >
                            수정
                        </button>
                        <button
                            type="button"
                            onClick={onRequestDelete}
                            aria-label={`${holding.symbol} 보유종목 삭제`}
                            className={DANGER_BUTTON}
                        >
                            삭제
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
    const { holdings, isHydrated, isLoading, isError, refetch, save, remove } =
        usePortfolioHoldings();

    const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
    const [confirmingDeleteSymbol, setConfirmingDeleteSymbol] = useState<
        string | null
    >(null);
    const [deleteError, setDeleteError] = useState<{
        symbol: string;
        message: string;
    } | null>(null);

    const isLoadingState = !isHydrated || isLoading;

    const handleDelete = async (symbol: string) => {
        setDeleteError(null);
        const result = await remove.mutateAsync(symbol);
        if (result.status === 'error') {
            setDeleteError({ symbol, message: result.message });
            return;
        }
        setConfirmingDeleteSymbol(null);
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-secondary-100 text-lg font-semibold">
                    보유종목
                </h2>
                <p className="text-secondary-400 mt-1 text-sm">
                    등록하면 내 평단 기준으로 분석을 받을 수 있어요.
                </p>
            </div>

            {isLoadingState && <HoldingsSkeleton />}

            {!isLoadingState && isError && (
                <div
                    role="alert"
                    className="border-secondary-800 text-secondary-400 rounded-xl border border-dashed px-4 py-6 text-center text-sm"
                >
                    <p>보유종목을 일시적으로 불러오지 못했어요.</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className={cn(ACTION_BUTTON, 'mt-3')}
                    >
                        다시 시도
                    </button>
                </div>
            )}

            {!isLoadingState && !isError && holdings.length === 0 && (
                <p className="border-secondary-800 text-secondary-400 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                    아직 등록한 보유종목이 없어요. 첫 종목을 추가해 보세요.
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
                                const result = await save.mutateAsync(input);
                                if (result.status === 'ok') {
                                    setEditingSymbol(null);
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
                <div className="border-secondary-800 space-y-2 border-t pt-4">
                    <h3 className="text-secondary-200 text-sm font-semibold">
                        종목 추가
                    </h3>
                    <HoldingForm
                        onSubmit={input => save.mutateAsync(input)}
                        submitting={save.isPending && editingSymbol === null}
                    />
                </div>
            )}
        </div>
    );
}
