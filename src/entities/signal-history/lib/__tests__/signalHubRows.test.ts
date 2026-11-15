import type { SignalEpisodeRow } from '../../types';
import {
    latestEpisodePerSymbol,
    orderForDisplay,
    signalHubWindowStart,
} from '../signalHubRows';

function row(
    market: SignalEpisodeRow['market'],
    symbol: string,
    sessionDate: string
): SignalEpisodeRow {
    return {
        market,
        symbol,
        koreanName: null,
        sessionDate,
        lastSeenSession: sessionDate,
        changePercent: 1,
    };
}

describe('signalHubWindowStart', () => {
    it('오늘(KST)을 포함한 30일 — 29일 전부터다', () => {
        // 2026-11-15 15:30Z = KST 11-16 00:30 → 11-16 포함 30일은 10-18부터.
        expect(signalHubWindowStart(new Date('2026-11-15T15:30:00Z'))).toBe(
            '2026-10-18'
        );
        expect(signalHubWindowStart(new Date('2026-11-15T14:59:00Z'))).toBe(
            '2026-10-17'
        );
    });
});

describe('latestEpisodePerSymbol', () => {
    it('종목마다 첫 번째(가장 최근) 에피소드만 남기고 순서를 지킨다', () => {
        const rows = [
            row('us', 'NVDA', '2026-11-13'),
            row('us', 'AAPL', '2026-11-12'),
            row('us', 'NVDA', '2026-10-20'),
        ];

        expect(latestEpisodePerSymbol(rows)).toEqual([rows[0], rows[1]]);
    });

    it('시장이 다르면 같은 심볼도 다른 종목이다', () => {
        const rows = [
            row('us', 'X', '2026-11-13'),
            row('kr', 'X', '2026-11-12'),
        ];

        expect(latestEpisodePerSymbol(rows)).toEqual(rows);
    });
});

describe('orderForDisplay', () => {
    it('미국 전부, 그다음 한국 — 시장 안에서는 입력 순서', () => {
        const rows = [
            row('kr', 'A.KS', '2026-11-13'),
            row('us', 'B', '2026-11-12'),
            row('kr', 'C.KS', '2026-11-11'),
            row('us', 'D', '2026-11-10'),
        ];

        expect(orderForDisplay(rows).map(r => r.symbol)).toEqual([
            'B',
            'D',
            'A.KS',
            'C.KS',
        ]);
    });
});
