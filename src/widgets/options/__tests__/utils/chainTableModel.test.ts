import { buildChainTableModel } from '@/widgets/options/utils/chainTableModel';
import type {
    ClientOptionsChain,
    ClientOptionsContract,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';
import type { StrikeOpenInterest } from '@y0ngha/siglens-core';

const contract = (strike: number): ClientOptionsContract => ({
    strike,
    bid: 1,
    ask: 1.1,
    volume: 1,
    openInterest: 10,
    impliedVolatility: 0.3,
});

const CHAIN: ClientOptionsChain = {
    expirationDate: '2025-06-20',
    daysToExpiration: 30,
    calls: [contract(100), contract(110)],
    puts: [contract(110), contract(120)],
};

const OI: StrikeOpenInterest[] = [100, 110, 120].map(strike => ({
    strike,
    callOpenInterest: 1,
    putOpenInterest: 1,
}));

describe('buildChainTableModel', () => {
    describe('without a chain', () => {
        it('returns an empty model', () => {
            expect(buildChainTableModel(null, [], 110, 105)).toEqual({
                rows: [],
                nearestStrike: null,
                maxPainStrike: null,
            });
        });
    });

    describe('with a chain', () => {
        it('builds one row per aggregated strike, joining the call and put side', () => {
            const { rows } = buildChainTableModel(CHAIN, OI, 110, 105);
            expect(rows.map(r => r.strike)).toEqual([100, 110, 120]);
            expect(rows[0]).toMatchObject({
                call: CHAIN.calls[0],
                put: undefined,
            });
            expect(rows[1]).toMatchObject({
                call: CHAIN.calls[1],
                put: CHAIN.puts[0],
            });
            expect(rows[2]).toMatchObject({
                call: undefined,
                put: CHAIN.puts[1],
            });
        });

        it('picks the strike nearest the spot as the ATM strike', () => {
            expect(
                buildChainTableModel(CHAIN, OI, 110, 118).nearestStrike
            ).toBe(120);
        });

        it('passes Max Pain through as the marked strike', () => {
            expect(
                buildChainTableModel(CHAIN, OI, 100, 105).maxPainStrike
            ).toBe(100);
        });

        it('leaves the Max Pain strike null when Max Pain is null', () => {
            expect(
                buildChainTableModel(CHAIN, OI, null, 105).maxPainStrike
            ).toBeNull();
        });

        it('has no ATM strike when there are no aggregated strikes', () => {
            expect(
                buildChainTableModel(CHAIN, [], null, 105).nearestStrike
            ).toBeNull();
        });
    });
});
