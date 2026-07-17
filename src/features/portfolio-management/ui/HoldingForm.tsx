'use client';

import { useId, useState } from 'react';
import { TickerAutocomplete } from '@/features/ticker-search';
import { cn } from '@/shared/lib/cn';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio';

const FIELD_LABEL = 'text-secondary-400 mb-1 block text-xs font-medium';
const FIELD_INPUT =
    'bg-secondary-950 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-500 focus:ring-primary-500/40 h-10 w-full rounded-md border px-3 text-sm tabular-nums transition-colors outline-none focus:ring-2';
const BUTTON_PRIMARY =
    'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 inline-flex h-10 shrink-0 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_GHOST =
    'text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 inline-flex h-10 shrink-0 items-center justify-center px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';

interface HoldingFormProps {
    /** Present -> edit mode (symbol is fixed, read-only). Absent -> add mode (symbol picked via autocomplete). */
    initial?: PortfolioHoldingView;
    onSubmit: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    submitting?: boolean;
    onCancel?: () => void;
}

/** Controlled add/edit form for a single holding. In add mode, clears itself on success; in edit mode, calls onCancel on success to let the parent close the inline editor. */
export function HoldingForm({
    initial,
    onSubmit,
    submitting = false,
    onCancel,
}: HoldingFormProps) {
    const isEditMode = initial !== undefined;
    const formId = useId();
    const errorId = `${formId}-error`;

    const [symbol, setSymbol] = useState(initial?.symbol ?? '');
    const [quantity, setQuantity] = useState(
        initial ? trimTrailingZeros(initial.quantity) : ''
    );
    const [averagePrice, setAveragePrice] = useState(
        initial ? trimTrailingZeros(initial.averagePrice) : ''
    );
    const [error, setError] = useState<string | null>(null);

    const canSubmit =
        symbol.length > 0 && quantity.length > 0 && averagePrice.length > 0;

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit || submitting) return;
        setError(null);
        try {
            const result = await onSubmit({ symbol, quantity, averagePrice });
            if (result.status === 'error') {
                setError(result.message);
                return;
            }
            if (isEditMode) {
                onCancel?.();
            } else {
                setSymbol('');
                setQuantity('');
                setAveragePrice('');
            }
        } catch {
            setError('요청 처리 중 문제가 발생했어요. 다시 시도해 주세요.');
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-3"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <span id={`${formId}-symbol-label`} className={FIELD_LABEL}>
                        종목
                    </span>
                    {isEditMode ? (
                        <div
                            aria-labelledby={`${formId}-symbol-label`}
                            className={cn(
                                FIELD_INPUT,
                                'flex items-center font-semibold'
                            )}
                        >
                            {symbol}
                        </div>
                    ) : symbol ? (
                        <div className="border-secondary-700 bg-secondary-950 flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-secondary-100 text-sm font-semibold">
                                {symbol}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSymbol('')}
                                className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 -my-2 rounded px-1 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                변경
                            </button>
                        </div>
                    ) : (
                        <TickerAutocomplete
                            size="sm"
                            navigateOnSelect={false}
                            onSelect={setSymbol}
                        />
                    )}
                </div>
                <div className="w-full sm:w-28">
                    <label
                        htmlFor={`${formId}-quantity`}
                        className={FIELD_LABEL}
                    >
                        수량
                    </label>
                    <input
                        id={`${formId}-quantity`}
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
                <div className="w-full sm:w-32">
                    <label
                        htmlFor={`${formId}-average-price`}
                        className={FIELD_LABEL}
                    >
                        평균 단가
                    </label>
                    <input
                        id={`${formId}-average-price`}
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
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="submit"
                        disabled={!canSubmit || submitting}
                        aria-busy={submitting}
                        className={BUTTON_PRIMARY}
                    >
                        {submitting ? '저장 중…' : isEditMode ? '저장' : '추가'}
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className={BUTTON_GHOST}
                        >
                            취소
                        </button>
                    )}
                </div>
            </div>
            <div
                id={errorId}
                role="alert"
                aria-live="polite"
                className="min-h-5 text-sm"
            >
                {error && <span className="text-ui-danger">{error}</span>}
            </div>
        </form>
    );
}
