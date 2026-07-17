import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { RawHoldingInput, ValidateHoldingResult } from '../model';

export const QUANTITY_SCALE = 8;
export const QUANTITY_MAX = 1_000_000_000;
export const PRICE_SCALE = 8;
export const PRICE_MAX = 10_000_000;

const DECIMAL_RE = /^\d+(\.\d+)?$/;

function checkDecimal(
    raw: string,
    scale: number,
    max: number
): { ok: true; value: string } | { ok: false } {
    const s = raw.trim();
    if (!DECIMAL_RE.test(s)) return { ok: false };
    const [, frac = ''] = s.split('.');
    if (frac.length > scale) return { ok: false };
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > max) return { ok: false };
    return { ok: true, value: s };
}

/** Pure validation for a raw holding form submission: canonicalizes the symbol shape and bounds-checks quantity/price as decimal strings (never coerced through JS floats for storage). */
export function validateHoldingInput(
    input: RawHoldingInput
): ValidateHoldingResult {
    const symbol = input.symbol.trim().toUpperCase();
    if (!isAdmissibleSymbolShape(symbol)) {
        return {
            ok: false,
            code: 'invalid_symbol',
            message: '올바른 종목 코드를 입력해 주세요.',
        };
    }
    const q = checkDecimal(input.quantity, QUANTITY_SCALE, QUANTITY_MAX);
    if (!q.ok)
        return {
            ok: false,
            code: 'invalid_quantity',
            message: '0보다 큰 수량을 입력해 주세요 (소수점 8자리까지)',
        };
    const p = checkDecimal(input.averagePrice, PRICE_SCALE, PRICE_MAX);
    if (!p.ok)
        return {
            ok: false,
            code: 'invalid_price',
            message: '0보다 큰 평균 단가를 입력해 주세요 (소수점 8자리까지)',
        };
    return { ok: true, symbol, quantity: q.value, averagePrice: p.value };
}
