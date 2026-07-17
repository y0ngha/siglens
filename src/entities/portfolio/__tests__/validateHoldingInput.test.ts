import { describe, expect, it } from 'vitest';
import { validateHoldingInput } from '../lib/validateHoldingInput';

describe('validateHoldingInput', () => {
    it('canonicalizes symbol to uppercase and trims', () => {
        const r = validateHoldingInput({
            symbol: ' aapl ',
            quantity: '10',
            averagePrice: '150',
        });
        expect(r).toEqual({
            ok: true,
            symbol: 'AAPL',
            quantity: '10',
            averagePrice: '150',
        });
    });
    it('rejects malformed symbol shape', () => {
        expect(
            validateHoldingInput({
                symbol: '!!!',
                quantity: '10',
                averagePrice: '150',
            })
        ).toMatchObject({ ok: false, code: 'invalid_symbol' });
    });
    it('rejects zero/negative quantity', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '0',
                averagePrice: '1',
            }).ok
        ).toBe(false);
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '-3',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('rejects zero/negative price', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '1',
                averagePrice: '0',
            })
        ).toMatchObject({ ok: false, code: 'invalid_price' });
    });
    it('rejects quantity beyond scale (>8 decimals)', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '1.123456789',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('rejects absurd upper bounds', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '2000000000',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '1',
                averagePrice: '20000000',
            })
        ).toMatchObject({ ok: false, code: 'invalid_price' });
    });
    it('rejects non-numeric', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: 'abc',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('accepts fractional quantity', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '0.00012345',
                averagePrice: '65000.50',
            }).ok
        ).toBe(true);
    });
    it('rejects price beyond scale (>8 decimals)', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '1',
                averagePrice: '1.123456789',
            })
        ).toMatchObject({ ok: false, code: 'invalid_price' });
    });
    it('accepts quantity exactly at QUANTITY_MAX (boundary is inclusive)', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '1000000000',
                averagePrice: '1',
            }).ok
        ).toBe(true);
    });
    it('rejects quantity one above QUANTITY_MAX', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '1000000001',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('rejects a leading-dot decimal string (no leading digit)', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '.5',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
    it('rejects a trailing-dot decimal string (no fractional digit)', () => {
        expect(
            validateHoldingInput({
                symbol: 'AAPL',
                quantity: '5.',
                averagePrice: '1',
            })
        ).toMatchObject({ ok: false, code: 'invalid_quantity' });
    });
});
