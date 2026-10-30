import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { RawHoldingInput, ValidateHoldingResult } from '../model';

/** 수량 소수점 허용 자릿수. 에러 문구에 값으로 넘겨 문자열과 어긋나지 않게 한다. */
export const QUANTITY_SCALE = 8;
const QUANTITY_MAX = 1_000_000_000;
/** 평단 소수점 허용 자릿수. */
export const PRICE_SCALE = 8;
const PRICE_MAX = 10_000_000;

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

/**
 * 보유종목 폼 제출값의 순수 검증: 심볼을 대문자 정규형으로 만들고 수량·평단을 소수 문자열로
 * 범위 검사한다. 저장값은 JS 부동소수로 변환하지 않고 입력 문자열 그대로 돌려준다.
 */
export function validateHoldingInput(
    input: RawHoldingInput
): ValidateHoldingResult {
    const symbol = input.symbol.trim().toUpperCase();
    if (!isAdmissibleSymbolShape(symbol)) {
        return { ok: false, code: 'invalid_symbol' };
    }
    const q = checkDecimal(input.quantity, QUANTITY_SCALE, QUANTITY_MAX);
    if (!q.ok) return { ok: false, code: 'invalid_quantity' };
    const p = checkDecimal(input.averagePrice, PRICE_SCALE, PRICE_MAX);
    if (!p.ok) return { ok: false, code: 'invalid_price' };
    return { ok: true, symbol, quantity: q.value, averagePrice: p.value };
}
