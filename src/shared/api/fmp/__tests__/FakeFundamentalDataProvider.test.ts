import { describe, it, expect } from 'vitest';
import { FakeFundamentalDataProvider } from '../FakeFundamentalDataProvider';

describe('FakeFundamentalDataProvider', () => {
    const provider = new FakeFundamentalDataProvider();

    it('getProfile returns a fully-populated profile for the requested symbol', async () => {
        const profile = await provider.getProfile('aapl');

        expect(profile).not.toBeNull();
        expect(profile!.symbol).toBe('aapl');
        expect(profile).toMatchObject({
            companyName: expect.any(String),
            sector: expect.any(String),
            industry: expect.any(String),
            marketCap: expect.any(Number),
        });
    });

    it('getGrades returns an empty list (siglens-specific extra is callable)', async () => {
        await expect(provider.getGrades('AAPL')).resolves.toEqual([]);
    });

    it('getEarningsReports returns an empty list (no-op DB upsert under E2E)', async () => {
        await expect(provider.getEarningsReports('AAPL')).resolves.toEqual([]);
    });
});
