import { planWatchlistMerge } from '../lib/planWatchlistMerge';

const candidate = (symbol: string, companyName: string | null = null) => ({
    symbol,
    companyName,
});

describe('planWatchlistMerge', () => {
    it('이미 있는 심볼은 넣지도 skipped로 세지도 않는다', () => {
        expect(
            planWatchlistMerge(new Set(['AAPL']), [candidate('AAPL')], 50)
        ).toEqual({ toInsert: [], skipped: 0 });
    });

    it('중복 후보는 앞의 것만 남긴다', () => {
        expect(
            planWatchlistMerge(
                new Set(),
                [candidate('MSFT', 'Microsoft'), candidate('MSFT')],
                50
            )
        ).toEqual({
            toInsert: [candidate('MSFT', 'Microsoft')],
            skipped: 0,
        });
    });

    it('기존 행 수를 뺀 여유만큼 앞에서부터 채우고 나머지를 skipped로 센다', () => {
        expect(
            planWatchlistMerge(
                new Set(['AAPL']),
                [candidate('MSFT'), candidate('NVDA'), candidate('TSLA')],
                3
            )
        ).toEqual({
            toInsert: [candidate('MSFT'), candidate('NVDA')],
            skipped: 1,
        });
    });

    it('이미 상한 이상이면 전부 skipped다', () => {
        expect(
            planWatchlistMerge(new Set(['A', 'B', 'C']), [candidate('MSFT')], 2)
        ).toEqual({ toInsert: [], skipped: 1 });
    });
});
