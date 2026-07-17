'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { TickerAutocomplete } from '@/features/ticker-search';
import { cn } from '@/shared/lib/cn';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import type {
    PortfolioActionErrorCode,
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio';

const FIELD_LABEL = 'text-secondary-400 mb-1 block text-xs font-medium';
const FIELD_INPUT =
    'bg-secondary-950 border-secondary-700 text-secondary-100 placeholder-secondary-400 focus:border-primary-500 focus:ring-primary-500/40 h-10 w-full rounded-md border px-3 text-sm tabular-nums transition-colors outline-none focus:ring-2';
const FIELD_INPUT_ERROR =
    'border-ui-danger focus:border-ui-danger focus:ring-ui-danger/40';
const SYMBOL_CHIP =
    'border-secondary-700 bg-secondary-950 flex h-10 items-center justify-between rounded-md border px-3';
const BUTTON_PRIMARY =
    'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 inline-flex h-10 shrink-0 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_GHOST =
    'text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 inline-flex h-10 shrink-0 items-center justify-center px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';

/** Which field a `PortfolioActionErrorCode` should be surfaced against; codes with no dedicated field (e.g. storage/auth failures) render only the alert message. */
type HoldingErrorField = 'symbol' | 'quantity' | 'averagePrice' | null;

function fieldForErrorCode(code: PortfolioActionErrorCode): HoldingErrorField {
    switch (code) {
        case 'invalid_symbol':
            return 'symbol';
        case 'invalid_quantity':
            return 'quantity';
        case 'invalid_price':
            return 'averagePrice';
        default:
            return null;
    }
}

interface HoldingFormProps {
    /** Present -> edit mode (symbol is fixed, read-only). Absent -> add mode (symbol picked via autocomplete). */
    initial?: PortfolioHoldingView;
    onSubmit: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    submitting?: boolean;
    onCancel?: () => void;
    /**
     * When true and in edit mode, focuses the quantity field once on mount.
     * Used by an inline row editor (e.g. `PortfolioSection`) so swapping a
     * row's display buttons for this form moves keyboard focus into the new
     * control instead of dropping it to `<body>`. The symbol field is
     * read-only in edit mode, so quantity is the first focusable input.
     */
    autoFocusFirstField?: boolean;
}

/** Controlled add/edit form for a single holding. In add mode, clears itself on success; in edit mode, calls onCancel on success to let the parent close the inline editor. */
export function HoldingForm({
    initial,
    onSubmit,
    submitting = false,
    onCancel,
    autoFocusFirstField = false,
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
    const [errorField, setErrorField] = useState<HoldingErrorField>(null);

    const symbolFieldRef = useRef<HTMLDivElement>(null);
    const quantityRef = useRef<HTMLInputElement>(null);
    const priceRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocusFirstField && isEditMode) {
            quantityRef.current?.focus();
        }
        // Mount-only: this form remounts fresh each time a row enters edit
        // mode (the parent swaps element trees rather than re-rendering the
        // same instance), so an empty dep array fires focus exactly once per
        // edit-mode entry.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const focusField = (field: HoldingErrorField) => {
        if (field === 'quantity') quantityRef.current?.focus();
        else if (field === 'averagePrice') priceRef.current?.focus();
        else if (field === 'symbol') {
            symbolFieldRef.current
                ?.querySelector<HTMLElement>('input, button')
                ?.focus();
        }
    };

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting) return;
        setError(null);
        setErrorField(null);
        try {
            const result = await onSubmit({ symbol, quantity, averagePrice });
            if (result.status === 'error') {
                setError(result.message);
                const field = fieldForErrorCode(result.code);
                setErrorField(field);
                focusField(field);
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
                <div ref={symbolFieldRef} className="min-w-0 flex-1">
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
                        <div
                            className={cn(
                                SYMBOL_CHIP,
                                errorField === 'symbol' && 'border-ui-danger'
                            )}
                        >
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
                            inputClassName={cn(
                                'bg-secondary-950 h-10 rounded-md focus:ring-2',
                                errorField === 'symbol'
                                    ? FIELD_INPUT_ERROR
                                    : 'focus:border-primary-500 focus:ring-primary-500/40'
                            )}
                            ariaInvalid={errorField === 'symbol'}
                            ariaDescribedby={
                                errorField === 'symbol' ? errorId : undefined
                            }
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
                        ref={quantityRef}
                        id={`${formId}-quantity`}
                        name="quantity"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="예: 10…"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        aria-invalid={errorField === 'quantity'}
                        aria-describedby={
                            errorField === 'quantity' ? errorId : undefined
                        }
                        className={cn(
                            FIELD_INPUT,
                            errorField === 'quantity' && FIELD_INPUT_ERROR
                        )}
                    />
                </div>
                <div className="w-full sm:w-32">
                    <label
                        htmlFor={`${formId}-average-price`}
                        className={FIELD_LABEL}
                    >
                        평단
                    </label>
                    <input
                        ref={priceRef}
                        id={`${formId}-average-price`}
                        name="averagePrice"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="예: 152.35…"
                        value={averagePrice}
                        onChange={e => setAveragePrice(e.target.value)}
                        aria-invalid={errorField === 'averagePrice'}
                        aria-describedby={
                            errorField === 'averagePrice' ? errorId : undefined
                        }
                        className={cn(
                            FIELD_INPUT,
                            errorField === 'averagePrice' && FIELD_INPUT_ERROR
                        )}
                    />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="submit"
                        disabled={submitting}
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
            <div id={errorId} role="alert" className="min-h-5 text-sm">
                {error && <span className="text-ui-danger">{error}</span>}
            </div>
        </form>
    );
}
