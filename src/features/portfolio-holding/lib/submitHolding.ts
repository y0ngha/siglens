import type {
    PortfolioActionErrorCode,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';

/** An editable field of the holding popover that an error can be pinned to. */
export type HoldingErrorField = 'quantity' | 'averagePrice';

/**
 * Field each save error code is surfaced against. The popover's symbol is fixed
 * (not user-editable), so `invalid_symbol` and every non-input failure map to
 * `null` and render only the alert message.
 */
const FIELD_BY_ERROR_CODE: Record<
    PortfolioActionErrorCode,
    HoldingErrorField | null
> = {
    invalid_quantity: 'quantity',
    invalid_price: 'averagePrice',
    unauthenticated: null,
    invalid_symbol: null,
    symbol_not_found: null,
    storage_unavailable: null,
    unknown: null,
};

/** Returns the popover field a save error code belongs to, or `null` when it has no field. */
export function fieldForErrorCode(
    code: PortfolioActionErrorCode
): HoldingErrorField | null {
    return FIELD_BY_ERROR_CODE[code];
}

/**
 * Result of one save attempt, already reduced to what the popover renders:
 * `saved` closes it, `rejected` shows the server's (localised) message against
 * an optional field, `failed` means the request itself threw and the caller
 * shows its own generic message.
 */
export type HoldingSubmitOutcome =
    | { kind: 'saved' }
    | { kind: 'rejected'; message: string; field: HoldingErrorField | null }
    | { kind: 'failed' };

/**
 * Runs the save mutation and maps its result to a `HoldingSubmitOutcome`. Kept
 * outside the hook so the result mapping is testable without rendering, and so
 * a rejected promise never escapes into the submit handler.
 */
export async function submitHolding(
    mutateAsync: (input: RawHoldingInput) => Promise<SavePortfolioResult>,
    input: RawHoldingInput
): Promise<HoldingSubmitOutcome> {
    try {
        const result = await mutateAsync(input);
        if (result.status === 'ok') return { kind: 'saved' };
        return {
            kind: 'rejected',
            message: result.message,
            field: fieldForErrorCode(result.code),
        };
    } catch {
        return { kind: 'failed' };
    }
}
