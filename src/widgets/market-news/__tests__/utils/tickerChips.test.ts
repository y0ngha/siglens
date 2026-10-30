import { buildTickerChips } from '@/widgets/market-news/utils/tickerChips';

describe('buildTickerChips', () => {
    it('stock 카테고리의 큐레이션 티커는 /[symbol]/news로 링크한다', () => {
        expect(buildTickerChips('stock', ['AAPL'])).toEqual([
            { ticker: 'AAPL', href: '/AAPL/news' },
        ]);
    });

    it('stock 카테고리라도 큐레이션 밖 티커는 링크하지 않는다', () => {
        expect(buildTickerChips('stock', ['ZZZNOTREAL'])).toEqual([
            { ticker: 'ZZZNOTREAL', href: null },
        ]);
    });

    it('stock 이외 카테고리는 큐레이션 티커여도 링크하지 않는다', () => {
        expect(buildTickerChips('crypto', ['AAPL'])).toEqual([
            { ticker: 'AAPL', href: null },
        ]);
    });

    it('입력 순서와 중복을 그대로 보존한다', () => {
        expect(
            buildTickerChips('stock', ['MSFT', 'AAPL', 'MSFT']).map(
                chip => chip.ticker
            )
        ).toEqual(['MSFT', 'AAPL', 'MSFT']);
    });
});
