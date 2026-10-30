import type {
    PortfolioActionErrorCode,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import { fieldForErrorCode, submitHolding } from '../lib/submitHolding';

const INPUT: RawHoldingInput = {
    symbol: 'AAPL',
    quantity: '12',
    averagePrice: '98.5',
};

describe('fieldForErrorCode', () => {
    it('pins invalid_quantity to the quantity field', () => {
        expect(fieldForErrorCode('invalid_quantity')).toBe('quantity');
    });

    it('pins invalid_price to the averagePrice field', () => {
        expect(fieldForErrorCode('invalid_price')).toBe('averagePrice');
    });

    it.each<PortfolioActionErrorCode>([
        'unauthenticated',
        'invalid_symbol',
        'symbol_not_found',
        'storage_unavailable',
        'unknown',
    ])('maps %s to no field', code => {
        expect(fieldForErrorCode(code)).toBeNull();
    });
});

describe('submitHolding', () => {
    it('passes the input through to mutateAsync unchanged', async () => {
        const mutateAsync = vi.fn<
            (input: RawHoldingInput) => Promise<SavePortfolioResult>
        >(async () => ({ status: 'error', code: 'unknown', message: 'x' }));

        await submitHolding(mutateAsync, INPUT);

        expect(mutateAsync).toHaveBeenCalledWith({
            symbol: 'AAPL',
            quantity: '12',
            averagePrice: '98.5',
        });
    });

    it('returns saved for an ok result', async () => {
        const outcome = await submitHolding(
            async () => ({
                status: 'ok',
                holding: {
                    symbol: 'AAPL',
                    companyName: null,
                    fmpSymbol: null,
                    quantity: '12',
                    averagePrice: '98.5',
                    updatedAt: '2026-01-02T00:00:00.000Z',
                },
            }),
            INPUT
        );

        expect(outcome).toEqual({ kind: 'saved' });
    });

    it('returns rejected with the server message and the mapped field for an error result', async () => {
        const outcome = await submitHolding(
            async () => ({
                status: 'error',
                code: 'invalid_price',
                message: '평단이 올바르지 않아요.',
            }),
            INPUT
        );

        expect(outcome).toEqual({
            kind: 'rejected',
            message: '평단이 올바르지 않아요.',
            field: 'averagePrice',
        });
    });

    it('returns failed instead of throwing when mutateAsync rejects', async () => {
        const outcome = await submitHolding(async () => {
            throw new Error('network down');
        }, INPUT);

        expect(outcome).toEqual({ kind: 'failed' });
    });
});
