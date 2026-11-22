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
    const rows = [ROW];

    it('전체 종목 수가 기준 이상이고 정상 조회면 색인한다', () => {
        expect(
            isSignalHubDataIndexable({
                rows,
                counts: { us: 3, kr: 2 },
                degraded: false,
            })
        ).toBe(true);
    });

    it('줄 수가 상한으로 잘려 적어도 전체 종목 수로 판정한다', () => {
        expect(
            isSignalHubDataIndexable({
                rows: [ROW],
                counts: { us: 150, kr: 0 },
                degraded: false,
            })
        ).toBe(true);
    });

    it('기준 미만이거나 degraded면 색인하지 않는다', () => {
        expect(
            isSignalHubDataIndexable({
                rows,
                counts: { us: 2, kr: 2 },
                degraded: false,
            })
        ).toBe(false);
        expect(
            isSignalHubDataIndexable({
                rows,
                counts: { us: 5, kr: 5 },
                degraded: true,
            })
        ).toBe(false);
    });
});
