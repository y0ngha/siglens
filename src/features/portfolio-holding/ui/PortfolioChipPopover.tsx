'use client';

import { type RefObject, useId, useRef, useState } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { trimTrailingZeros } from '../lib/formatDecimal';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import type { UseSymbolHoldingReturn } from '../hooks/useSymbolHolding';

const FIELD_LABEL = 'text-secondary-400 mb-1 block text-xs font-medium';
const FIELD_INPUT =
    'bg-secondary-950 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-500 focus:ring-primary-500/40 h-10 w-full rounded-md border px-3 text-sm tabular-nums transition-colors outline-none focus:ring-2';
const BUTTON_PRIMARY =
    'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 inline-flex h-9 flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_GHOST =
    'text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';

interface PortfolioChipPopoverProps {
    symbol: string;
    holding: PortfolioHoldingView | null;
    save: UseSymbolHoldingReturn['save'];
    triggerRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

/**
 * Small anchored dialog for viewing/setting the current symbol's holding
 * without leaving the symbol page. Symbol is fixed (no autocomplete) — only
 * quantity/averagePrice are editable, pre-filled from `holding` when set.
 */
export function PortfolioChipPopover({
    symbol,
    holding,
    save,
    triggerRef,
    onClose,
}: PortfolioChipPopoverProps) {
    const titleId = useId();
    const errorId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    useFocusTrap(panelRef, true);
    useEscapeKey(onClose, true);
    useOnClickOutside([panelRef, triggerRef], onClose);

    const [quantity, setQuantity] = useState(
        holding ? trimTrailingZeros(holding.quantity) : ''
    );
    const [averagePrice, setAveragePrice] = useState(
        holding ? trimTrailingZeros(holding.averagePrice) : ''
    );
    const [error, setError] = useState<string | null>(null);

    const canSubmit = quantity.length > 0 && averagePrice.length > 0;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit || save.isPending) return;
        setError(null);
        try {
            const result = await save.mutateAsync({
                symbol,
                quantity,
                averagePrice,
            });
            if (result.status === 'error') {
                setError(result.message);
                return;
            }
            onClose();
        } catch {
            setError('요청 처리 중 문제가 발생했어요. 다시 시도해 주세요.');
        }
    };

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
                'border-secondary-700 bg-secondary-900 absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)]',
                'overscroll-contain rounded-lg border p-4 shadow-2xl outline-none'
            )}
        >
            <h2
                id={titleId}
                className="text-secondary-100 mb-3 text-sm font-semibold"
            >
                {symbol.toUpperCase()} 평단 설정
            </h2>

            <form
                onSubmit={handleSubmit}
                noValidate
                className="flex flex-col gap-3"
            >
                <div>
                    <label
                        htmlFor={`${titleId}-quantity`}
                        className={FIELD_LABEL}
                    >
                        수량
                    </label>
                    <input
                        id={`${titleId}-quantity`}
                        name="quantity"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="예: 10"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className={FIELD_INPUT}
                    />
                </div>
                <div>
                    <label
                        htmlFor={`${titleId}-average-price`}
                        className={FIELD_LABEL}
                    >
                        평균 단가
                    </label>
                    <input
                        id={`${titleId}-average-price`}
                        name="averagePrice"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="예: 152.35"
                        value={averagePrice}
                        onChange={e => setAveragePrice(e.target.value)}
                        className={FIELD_INPUT}
                    />
                </div>

                <div
                    id={errorId}
                    role="alert"
                    aria-live="polite"
                    className="min-h-5 text-sm"
                >
                    {error && <span className="text-ui-danger">{error}</span>}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        disabled={!canSubmit || save.isPending}
                        aria-busy={save.isPending}
                        className={BUTTON_PRIMARY}
                    >
                        {save.isPending ? '저장 중…' : '저장'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className={BUTTON_GHOST}
                    >
                        취소
                    </button>
                </div>
            </form>
        </div>
    );
}
