import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { ValidateWatchlistSymbolResult } from '../model';

/** 순수: 공백 제거·대문자화 뒤 사이트 전역 admission 형상(`isAdmissibleSymbolShape`)을 적용한다. */
export function validateWatchlistSymbol(
    raw: string
): ValidateWatchlistSymbolResult {
    const symbol = raw.trim().toUpperCase();
    if (!isAdmissibleSymbolShape(symbol)) {
        return { ok: false, code: 'invalid_symbol' };
    }
    return { ok: true, symbol };
}
