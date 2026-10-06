import {
    EARLY_CLOSE_MINUTE,
    isUsMarketEarlyClose,
    usMarketCloseMinute,
    type OptionsChain,
    type OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { rebaseOptionsSnapshot } from '../rebaseOptionsSnapshot';

function chain(expirationDate: string, daysToExpiration: number): OptionsChain {
    return { expirationDate, daysToExpiration, calls: [], puts: [] };
}

function snapshot(chains: OptionsChain[]): OptionsSnapshot {
    return {
        symbol: 'AAPL',
        underlyingPrice: 195,
        chains,
        capturedAt: '2026-10-02T20:00:00.000Z',
    };
}

// 2026-10-05(월) 낮 12:00 ET = 16:00 UTC.
const MONDAY_NOON_ET = new Date('2026-10-05T16:00:00.000Z');

describe('rebaseOptionsSnapshot', () => {
    it('오늘(ET) 이전 만기는 버리고 오늘 이후 만기는 남긴다', () => {
        const result = rebaseOptionsSnapshot(
            snapshot([
                chain('2026-10-02', 0),
                chain('2026-10-05', 3),
                chain('2026-10-09', 7),
            ]),
            MONDAY_NOON_ET
        );

        expect(result?.chains.map(c => c.expirationDate)).toEqual([
            '2026-10-05',
            '2026-10-09',
        ]);
    });

    it('daysToExpiration을 오늘 기준으로 다시 센다', () => {
        const result = rebaseOptionsSnapshot(
            snapshot([chain('2026-10-05', 3), chain('2026-10-09', 7)]),
            MONDAY_NOON_ET
        );

        expect(result?.chains.map(c => c.daysToExpiration)).toEqual([0, 4]);
    });

    it('capturedAt·underlyingPrice는 저장 당시 값을 유지한다', () => {
        const result = rebaseOptionsSnapshot(
            snapshot([chain('2026-10-09', 7)]),
            MONDAY_NOON_ET
        );

        expect(result?.capturedAt).toBe('2026-10-02T20:00:00.000Z');
        expect(result?.underlyingPrice).toBe(195);
    });

    it('ET 날짜 기준이다: UTC로는 이미 다음 날이어도 ET 날짜로 판단한다', () => {
        // 2026-10-05 21:00 ET = 2026-10-06 01:00 UTC. 오늘(ET) 만기는 이미 끝났고 내일 만기가 남는다.
        const lateEvening = new Date('2026-10-06T01:00:00.000Z');
        const result = rebaseOptionsSnapshot(
            snapshot([chain('2026-10-05', 0), chain('2026-10-06', 1)]),
            lateEvening
        );

        expect(result?.chains.map(c => c.expirationDate)).toEqual([
            '2026-10-06',
        ]);
        expect(result?.chains.map(c => c.daysToExpiration)).toEqual([1]);
    });

    describe('만기 당일', () => {
        const chains = [chain('2026-10-05', 0), chain('2026-10-09', 4)];

        it('개장 전(프리마켓 08:00 ET)에는 당일 만기를 남긴다', () => {
            // 2026-10-05 08:00 EDT = 12:00 UTC.
            const result = rebaseOptionsSnapshot(
                snapshot(chains),
                new Date('2026-10-05T12:00:00.000Z')
            );

            expect(result?.chains.map(c => c.expirationDate)).toEqual([
                '2026-10-05',
                '2026-10-09',
            ]);
        });

        it('종가 직전(15:59 ET)에는 남기고 16:00 ET부터는 버린다', () => {
            const before = rebaseOptionsSnapshot(
                snapshot(chains),
                new Date('2026-10-05T19:59:00.000Z')
            );
            const atClose = rebaseOptionsSnapshot(
                snapshot(chains),
                new Date('2026-10-05T20:00:00.000Z')
            );

            expect(before?.chains.map(c => c.expirationDate)).toContain(
                '2026-10-05'
            );
            expect(atClose?.chains.map(c => c.expirationDate)).toEqual([
                '2026-10-09',
            ]);
        });

        it('종가 뒤(18:00 ET)에도 당일 만기는 없고 daysToExpiration은 다음 만기 기준이다', () => {
            const result = rebaseOptionsSnapshot(
                snapshot(chains),
                new Date('2026-10-05T22:00:00.000Z')
            );

            expect(result?.chains.map(c => c.expirationDate)).toEqual([
                '2026-10-09',
            ]);
        });

        it('조기 마감일(2026-11-27)은 13:00 ET에 당일 만기를 버리고 12:59 ET까지는 남긴다', () => {
            // 전제: 이 날이 세션 캘린더상 조기 마감일(13:00 ET)이다.
            const earlyCloseDay = new Date('2026-11-27T17:00:00.000Z');
            expect(isUsMarketEarlyClose(earlyCloseDay)).toBe(true);
            expect(usMarketCloseMinute(earlyCloseDay)).toBe(EARLY_CLOSE_MINUTE);

            const earlyChains = [
                chain('2026-11-27', 0),
                chain('2026-11-30', 3),
            ];
            // 13:00 EST = 18:00 UTC, 12:59 EST = 17:59 UTC.
            const before = rebaseOptionsSnapshot(
                snapshot(earlyChains),
                new Date('2026-11-27T17:59:00.000Z')
            );
            const atEarlyClose = rebaseOptionsSnapshot(
                snapshot(earlyChains),
                new Date('2026-11-27T18:00:00.000Z')
            );

            expect(before?.chains.map(c => c.expirationDate)).toEqual([
                '2026-11-27',
                '2026-11-30',
            ]);
            expect(atEarlyClose?.chains.map(c => c.expirationDate)).toEqual([
                '2026-11-30',
            ]);
        });

        it('당일 만기뿐이고 종가 뒤라면 null이다', () => {
            expect(
                rebaseOptionsSnapshot(
                    snapshot([chain('2026-10-05', 0)]),
                    new Date('2026-10-05T22:00:00.000Z')
                )
            ).toBeNull();
        });
    });

    it('남은 만기가 없으면 null이다', () => {
        expect(
            rebaseOptionsSnapshot(
                snapshot([chain('2026-10-02', 0)]),
                MONDAY_NOON_ET
            )
        ).toBeNull();
    });

    it('입력 스냅샷을 변형하지 않는다', () => {
        const input = snapshot([
            chain('2026-10-02', 0),
            chain('2026-10-09', 7),
        ]);
        rebaseOptionsSnapshot(input, MONDAY_NOON_ET);

        expect(input.chains).toHaveLength(2);
        expect(input.chains[1].daysToExpiration).toBe(7);
    });
});
