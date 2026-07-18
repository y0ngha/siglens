/**
 * Client-side hardening for holding quantity/average-price `inputMode="decimal"`
 * text inputs (PortfolioChipPopover, HoldingForm): strips every `-` character
 * from a controlled input's `onChange` value so a negative number can never be
 * typed in cleanly, without touching digits or the decimal point.
 *
 * This is a UX nicety, NOT the authoritative guard — `validateHoldingInput`'s
 * `DECIMAL_RE` (`^\d+(\.\d+)?$`) already rejects any string containing `-` server-side
 * regardless of what the client does. `type="text"` (chosen so quantity/price can be
 * pasted/typed as an exact decimal string, never coerced through a JS
 * `type="number"` float) means the HTML `min` attribute has no effect here, so
 * stripping in `onChange` is the "equivalent" client guard for a text input.
 */
export function stripNegativeSign(value: string): string {
    return value.replace(/-/g, '');
}
