'use client';

import {
    type RefObject,
    type SubmitEvent,
    useCallback,
    useRef,
    useState,
} from 'react';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';
import { stripNegativeSign } from '@/shared/lib/stripNegativeSign';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import { type HoldingErrorField, submitHolding } from '../lib/submitHolding';
import type { UseSymbolHoldingReturn } from './useSymbolHolding';

/**
 * Runs `task` and always clears `guard` afterwards, even if `task` rejects.
 * `submitHolding` already maps a thrown save to `failed`, but the guard must not
 * depend on that: a leaked rejection would lock the form until it remounts.
 * Kept outside the hook because React Compiler cannot lower a `try/finally`
 * without a `catch` inside a hook body.
 */
async function releaseAfter<T>(
    guard: RefObject<boolean>,
    task: () => Promise<T>
): Promise<T> {
    try {
        return await task();
    } finally {
        guard.current = false;
    }
}

/** The message shown under the form, and the field it is pinned to (if any). */
export interface HoldingFormError {
    message: string;
    field: HoldingErrorField | null;
}

interface UseHoldingPopoverFormParams {
    symbol: string;
    /** Existing holding to pre-fill from; `null` starts both fields empty. */
    holding: PortfolioHoldingView | null;
    save: UseSymbolHoldingReturn['save'];
    /** Called once a save succeeds. */
    onSaved: () => void;
    /** Localised message shown when the save request itself throws. */
    unexpectedErrorMessage: string;
}

/** State and handlers `PortfolioChipPopover` renders its form from. */
export interface UseHoldingPopoverFormReturn {
    quantity: string;
    averagePrice: string;
    error: HoldingFormError | null;
    isPending: boolean;
    quantityRef: RefObject<HTMLInputElement | null>;
    priceRef: RefObject<HTMLInputElement | null>;
    changeQuantity: (value: string) => void;
    changeAveragePrice: (value: string) => void;
    handleSubmit: (e: SubmitEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Form logic of the header holding popover: pre-filled amounts, negative-sign
 * stripping, a single in-flight save, error mapping and focus on the offending
 * field.
 *
 * The submit button stays focusable while pending (`aria-disabled`, not
 * `disabled`), so a second activation reaches `handleSubmit`; the in-flight ref
 * rejects it before `save.isPending` has re-rendered. `save.isPending` still
 * covers a save started by an earlier popover instance that was closed mid-flight.
 */
export function useHoldingPopoverForm({
    symbol,
    holding,
    save,
    onSaved,
    unexpectedErrorMessage,
}: UseHoldingPopoverFormParams): UseHoldingPopoverFormReturn {
    const [quantity, setQuantity] = useState(() =>
        holding ? trimTrailingZeros(holding.quantity) : ''
    );
    const [averagePrice, setAveragePrice] = useState(() =>
        holding ? trimTrailingZeros(holding.averagePrice) : ''
    );
    const [error, setError] = useState<HoldingFormError | null>(null);
    const quantityRef = useRef<HTMLInputElement>(null);
    const priceRef = useRef<HTMLInputElement>(null);
    const inFlightRef = useRef(false);

    const { mutateAsync, isPending } = save;

    const changeQuantity = useCallback((value: string) => {
        setQuantity(stripNegativeSign(value));
    }, []);

    const changeAveragePrice = useCallback((value: string) => {
        setAveragePrice(stripNegativeSign(value));
    }, []);

    const handleSubmit = useCallback(
        async (e: SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (inFlightRef.current || isPending) return;
            inFlightRef.current = true;
            setError(null);
            const outcome = await releaseAfter(inFlightRef, () =>
                submitHolding(mutateAsync, { symbol, quantity, averagePrice })
            );

            if (outcome.kind === 'saved') {
                onSaved();
                return;
            }
            if (outcome.kind === 'failed') {
                setError({ message: unexpectedErrorMessage, field: null });
                return;
            }
            setError({ message: outcome.message, field: outcome.field });
            const fieldRefs = { quantity: quantityRef, averagePrice: priceRef };
            if (outcome.field) fieldRefs[outcome.field].current?.focus();
        },
        [
            isPending,
            mutateAsync,
            symbol,
            quantity,
            averagePrice,
            onSaved,
            unexpectedErrorMessage,
        ]
    );

    return {
        quantity,
        averagePrice,
        error,
        isPending,
        quantityRef,
        priceRef,
        changeQuantity,
        changeAveragePrice,
        handleSubmit,
    };
}
