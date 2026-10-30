import { fieldForErrorCode } from '@/features/portfolio-management/lib/holdingErrorField';

describe('fieldForErrorCode', () => {
    it('maps invalid_symbol to the symbol field', () => {
        expect(fieldForErrorCode('invalid_symbol')).toBe('symbol');
    });

    it('maps invalid_quantity to the quantity field', () => {
        expect(fieldForErrorCode('invalid_quantity')).toBe('quantity');
    });

    it('maps invalid_price to the averagePrice field', () => {
        expect(fieldForErrorCode('invalid_price')).toBe('averagePrice');
    });

    it.each([
        'symbol_not_found',
        'unauthenticated',
        'storage_unavailable',
        'unknown',
    ] as const)('maps %s to no field', code => {
        expect(fieldForErrorCode(code)).toBeNull();
    });
});
