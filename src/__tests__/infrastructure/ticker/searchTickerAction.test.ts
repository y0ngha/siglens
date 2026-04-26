import { searchTickerAction } from '@/infrastructure/ticker/searchTickerAction';
import { searchTicker } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/domain/types';

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

    it('query를 siglens-core searchTicker에 그대로 전달한다', async () => {
        mockSearchTicker.mockResolvedValueOnce(results);

        await searchTickerAction('apple');

        expect(mockSearchTicker).toHaveBeenCalledWith('apple');
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockSearchTicker.mockResolvedValueOnce(results);

        const result = await searchTickerAction('apple');

        expect(result).toBe(results);
    });
});
