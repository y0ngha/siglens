import { deduplicatePopularTickerEntries } from '../../../../update-popular-tickers';

describe('deduplicatePopularTickerEntries', () => {
    it('POPULAR_TICKERS 배열에서 첫 등장 티커만 유지한다', () => {
        const fileContent = `export const POPULAR_TICKERS = [
    // --- [1] Mega Cap & Index ---
    'AAPL',
    'BRK.B',
    'PBR-A',

    // --- Trending (2026-04-12) ---
    'T',
    'PBR-A',

    // --- Trending (2026-05-11) ---
    'T',
    'BRK.B',
    'NVDA',
] as const;
`;

        const result = deduplicatePopularTickerEntries(fileContent);

        expect(result.removedTickers).toEqual(['PBR-A', 'T', 'BRK.B']);
        expect(result.content).toBe(`export const POPULAR_TICKERS = [
    // --- [1] Mega Cap & Index ---
    'AAPL',
    'BRK.B',
    'PBR-A',

    // --- Trending (2026-04-12) ---
    'T',

    // --- Trending (2026-05-11) ---
    'NVDA',
] as const;
`);
    });

    it('POPULAR_TICKERS 밖의 같은 티커는 중복 제거 대상으로 보지 않는다', () => {
        const fileContent = `export const TICKER_CATEGORIES = [
    {
        id: 'ev-mobility',
        tickers: ['TSLA'],
    },
];

export const POPULAR_TICKERS = [
    'TSLA',
    'NVDA',
    'TSLA',
] as const;
`;

        const result = deduplicatePopularTickerEntries(fileContent);

        expect(result.removedTickers).toEqual(['TSLA']);
        expect(result.content).toContain("tickers: ['TSLA']");
        expect(result.content).toContain(`export const POPULAR_TICKERS = [
    'TSLA',
    'NVDA',
] as const;`);
    });

    it('POPULAR_TICKERS 배열을 찾지 못하면 원문을 그대로 반환한다', () => {
        const fileContent = `export const OTHER_TICKERS = ['AAPL', 'AAPL'];`;

        expect(deduplicatePopularTickerEntries(fileContent)).toEqual({
            content: fileContent,
            removedTickers: [],
        });
    });
});
