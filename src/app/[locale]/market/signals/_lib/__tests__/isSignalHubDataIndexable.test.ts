import { isSignalHubDataIndexable } from '../isSignalHubDataIndexable';

const ROW = {
    market: 'us',
    symbol: 'NVDA',
    koreanName: null,
    sessionDate: '2026-11-13',
    lastSeenSession: '2026-11-13',
    changePercent: 1,
} as const;

describe('isSignalHubDataIndexable', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
        ...ROW,
        symbol: `S${i}`,
    }));

    it('기준 이상이고 정상 조회면 색인한다', () => {
        expect(isSignalHubDataIndexable({ rows, degraded: false })).toBe(true);
    });

    it('기준 미만이거나 degraded면 색인하지 않는다', () => {
        expect(
            isSignalHubDataIndexable({ rows: rows.slice(1), degraded: false })
        ).toBe(false);
        expect(isSignalHubDataIndexable({ rows, degraded: true })).toBe(false);
    });
});
