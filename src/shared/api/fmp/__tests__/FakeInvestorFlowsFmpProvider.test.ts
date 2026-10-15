import { describe, expect, it } from 'vitest';
import { FakeInvestorFlowsFmpProvider } from '../FakeInvestorFlowsFmpProvider';

describe('FakeInvestorFlowsFmpProvider', () => {
    const fake = new FakeInvestorFlowsFmpProvider();

    it('returns deterministic buy and sell insider rows', async () => {
        const rows = await fake.getInsiderTrades('AAPL');
        expect(rows.map(r => r.transactionType)).toEqual([
            'S-Sale',
            'P-Purchase',
        ]);
    });

    it('returns statistics, one 13G holder and a float', async () => {
        expect(await fake.getInsiderStatistics('AAPL')).toHaveLength(1);
        expect(await fake.getBeneficialOwnership('AAPL', 5)).toHaveLength(1);
        expect((await fake.getSharesFloat('AAPL'))?.outstandingShares).toBe(
            14594180000
        );
    });

    it('honours the limit for 13D/G rows', async () => {
        expect(await fake.getBeneficialOwnership('AAPL', 0)).toEqual([]);
    });

    it('returns empty data for EMPTYX on every method (empty-state UI)', async () => {
        expect(await fake.getInsiderTrades('emptyx')).toEqual([]);
        expect(await fake.getInsiderStatistics('EMPTYX')).toEqual([]);
        expect(await fake.getBeneficialOwnership('EMPTYX', 5)).toEqual([]);
        expect(await fake.getSharesFloat('EMPTYX')).toBeNull();
    });
});
