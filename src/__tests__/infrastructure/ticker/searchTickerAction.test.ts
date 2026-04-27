import { searchTickerAction } from '@/infrastructure/ticker/searchTickerAction';
import { searchTicker } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@y0ngha/siglens-core';

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    searchTicker: jest.fn(),
}));

const mockSearchTicker = searchTicker as jest.MockedFunction<
    typeof searchTicker
>;

const results: TickerSearchResult[] = [
    { symbol: 'AAPL', name: 'Apple Inc.' } as TickerSearchResult,
];

describe('searchTickerAction 함수는', () => {
    beforeEach(() => {
        mockSearchTicker.mockReset();
    });

    it('trim된 query를 siglens-core searchTicker에 전달한다', async () => {
        mockSearchTicker.mockResolvedValueOnce(results);

        await searchTickerAction('  apple  ');

        expect(mockSearchTicker).toHaveBeenCalledWith('apple', {
            waitUntil: expect.any(Function),
        });
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockSearchTicker.mockResolvedValueOnce(results);

        const result = await searchTickerAction('apple');

        expect(result).toBe(results);
    });

    it('빈 문자열 query는 searchTicker를 호출하지 않고 빈 배열을 반환한다', async () => {
        const result = await searchTickerAction('   ');

        expect(mockSearchTicker).not.toHaveBeenCalled();
        expect(result).toEqual([]);
    });
});
