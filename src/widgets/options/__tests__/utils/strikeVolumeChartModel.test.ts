import { buildStrikeVolumeChartModel } from '@/widgets/options/utils/strikeVolumeChartModel';
import type {
    ClientOptionsChain,
    ClientOptionsContract,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';

const contract = (strike: number, volume: number): ClientOptionsContract => ({
    strike,
    bid: 1,
    ask: 1.1,
    volume,
    openInterest: 10,
    impliedVolatility: 0.3,
});

const chain = (
    calls: ClientOptionsContract[],
    puts: ClientOptionsContract[]
): ClientOptionsChain => ({
    expirationDate: '2025-06-20',
    daysToExpiration: 30,
    calls,
    puts,
});

describe('buildStrikeVolumeChartModel', () => {
    describe('when there is nothing to draw', () => {
        it('returns null without a chain', () => {
            expect(buildStrikeVolumeChartModel(null, 100)).toBeNull();
        });

        it('returns null for a chain with no contracts', () => {
            expect(buildStrikeVolumeChartModel(chain([], []), 100)).toBeNull();
        });

        it('returns null when volume is zero everywhere', () => {
            expect(
                buildStrikeVolumeChartModel(
                    chain([contract(100, 0)], [contract(100, 0)]),
                    100
                )
            ).toBeNull();
        });
    });

    describe('when there is volume', () => {
        const model = buildStrikeVolumeChartModel(
            chain(
                [contract(100, 30), contract(110, 80)],
                [contract(100, 10), contract(110, 20)]
            ),
            108
        )!;

        it('aggregates rows ascending by strike', () => {
            expect(model.rows).toEqual([
                { strike: 100, callVolume: 30, putVolume: 10 },
                { strike: 110, callVolume: 80, putVolume: 20 },
            ]);
        });

        it('uses the largest single side as globalMax', () => {
            expect(model.globalMax).toBe(80);
        });

        it('locates the strike nearest the spot price', () => {
            expect(model.currentPriceIdx).toBe(1);
        });

        it('labels every strike for a short chain', () => {
            expect(model.labelIndices).toEqual(new Set([0, 1]));
        });
    });

    it('floors globalMax at 1', () => {
        const model = buildStrikeVolumeChartModel(
            chain([contract(100, 0.4)], []),
            100
        )!;
        expect(model.globalMax).toBe(1);
    });
});
