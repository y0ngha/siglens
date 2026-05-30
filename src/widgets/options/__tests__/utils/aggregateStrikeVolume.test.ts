/**
 * Unit tests for `aggregateStrikeVolume`.
 *
 * Mirrors the patterns in `aggregateOpenInterest` upstream — fixtures are
 * minimal `OptionsChain` shapes with only the fields the helper reads
 * (`calls[].strike`, `calls[].volume`, same for puts). All other contract
 * fields are filled with realistic defaults so we don't rely on type
 * assertions to bypass the public type.
 */
import type { OptionsChain, OptionsContract } from '@y0ngha/siglens-core';
import { aggregateStrikeVolume } from '@/widgets/options/utils/aggregateStrikeVolume';

function makeContract(
    strike: number,
    volume: number,
    side: 'C' | 'P'
): OptionsContract {
    return {
        contractSymbol: `TEST250620${side}${strike.toString().padStart(8, '0')}`,
        strike,
        lastPrice: 1,
        bid: 1,
        ask: 1.05,
        volume,
        openInterest: 0,
        impliedVolatility: 0.25,
        inTheMoney: false,
    };
}

function makeChain(
    calls: ReadonlyArray<OptionsContract>,
    puts: ReadonlyArray<OptionsContract>
): OptionsChain {
    return {
        expirationDate: '2026-06-20',
        daysToExpiration: 30,
        calls,
        puts,
    };
}

describe('aggregateStrikeVolume', () => {
    describe('정상 케이스', () => {
        it('정상 chain에서 strike별 call/put volume을 합산하고 오름차순 정렬한다', () => {
            const chain = makeChain(
                [
                    makeContract(110, 50, 'C'),
                    makeContract(100, 30, 'C'),
                    makeContract(120, 20, 'C'),
                ],
                [
                    makeContract(100, 40, 'P'),
                    makeContract(120, 15, 'P'),
                    makeContract(110, 25, 'P'),
                ]
            );
            const result = aggregateStrikeVolume(chain);
            expect(result).toEqual([
                { strike: 100, callVolume: 30, putVolume: 40 },
                { strike: 110, callVolume: 50, putVolume: 25 },
                { strike: 120, callVolume: 20, putVolume: 15 },
            ]);
        });

        it('한쪽 side에만 strike가 있는 경우에도 합집합 순서대로 정렬한다', () => {
            const chain = makeChain(
                [makeContract(105, 10, 'C')],
                [makeContract(100, 4, 'P'), makeContract(110, 6, 'P')]
            );
            expect(aggregateStrikeVolume(chain)).toEqual([
                { strike: 100, callVolume: 0, putVolume: 4 },
                { strike: 105, callVolume: 10, putVolume: 0 },
                { strike: 110, callVolume: 0, putVolume: 6 },
            ]);
        });
    });

    describe('엣지 케이스', () => {
        it('빈 chain은 빈 배열을 반환한다', () => {
            const chain = makeChain([], []);
            expect(aggregateStrikeVolume(chain)).toEqual([]);
        });

        it('call만 존재하는 strike는 putVolume을 0으로 채운다', () => {
            const chain = makeChain([makeContract(100, 12, 'C')], []);
            expect(aggregateStrikeVolume(chain)).toEqual([
                { strike: 100, callVolume: 12, putVolume: 0 },
            ]);
        });

        it('put만 존재하는 strike는 callVolume을 0으로 채운다', () => {
            const chain = makeChain([], [makeContract(100, 7, 'P')]);
            expect(aggregateStrikeVolume(chain)).toEqual([
                { strike: 100, callVolume: 0, putVolume: 7 },
            ]);
        });

        it('동일 strike에 contract가 여러 개 있으면 자연스럽게 합산된다', () => {
            const chain = makeChain(
                [makeContract(100, 5, 'C'), makeContract(100, 8, 'C')],
                [makeContract(100, 3, 'P'), makeContract(100, 2, 'P')]
            );
            expect(aggregateStrikeVolume(chain)).toEqual([
                { strike: 100, callVolume: 13, putVolume: 5 },
            ]);
        });

        it('volume이 0인 contract도 안전하게 누적된다', () => {
            const chain = makeChain(
                [makeContract(100, 0, 'C')],
                [makeContract(100, 0, 'P')]
            );
            expect(aggregateStrikeVolume(chain)).toEqual([
                { strike: 100, callVolume: 0, putVolume: 0 },
            ]);
        });
    });
});
