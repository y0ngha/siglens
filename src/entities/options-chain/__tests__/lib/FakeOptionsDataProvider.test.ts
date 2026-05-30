import { describe, it, expect } from 'vitest';
import { FakeOptionsDataProvider } from '../../lib/FakeOptionsDataProvider';

describe('FakeOptionsDataProvider', () => {
    const provider = new FakeOptionsDataProvider();

    it('fetchSnapshot returns one expiration with a symmetric call/put strike ladder', async () => {
        const snapshot = await provider.fetchSnapshot('aapl');

        expect(snapshot).not.toBeNull();
        expect(snapshot!.symbol).toBe('AAPL');
        expect(snapshot!.underlyingPrice).toBeGreaterThan(0);
        expect(snapshot!.chains).toHaveLength(1);

        const [chain] = snapshot!.chains;
        expect(chain.expirationDate).toBe('2026-06-05');
        expect(chain.daysToExpiration).toBe(6);
        expect(chain.calls.length).toBe(chain.puts.length);
        expect(chain.calls.length).toBeGreaterThan(0);

        const [call] = chain.calls;
        expect(call).toMatchObject({
            contractSymbol: expect.any(String),
            strike: expect.any(Number),
            volume: expect.any(Number),
            openInterest: expect.any(Number),
            inTheMoney: expect.any(Boolean),
        });
    });

    it('hasOptionsMarket reports true for any symbol', async () => {
        await expect(provider.hasOptionsMarket('ANYTHING')).resolves.toBe(true);
    });
});
