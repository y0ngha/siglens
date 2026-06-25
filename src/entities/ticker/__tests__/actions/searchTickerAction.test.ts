import type { MockedFunction } from 'vitest';
import { searchTickerAction } from '../../actions/searchTickerAction';
import { searchTicker } from '../../lib/searchTicker';
import type { TickerSearchResult } from '@/shared/lib/types';

vi.mock('../../lib/searchTicker', () => ({
    searchTicker: vi.fn(),
}));

const mockSearchTicker = searchTicker as MockedFunction<typeof searchTicker>;

const results: TickerSearchResult[] = [
    { symbol: 'AAPL', name: 'Apple Inc.' } as TickerSearchResult,
];

describe('searchTickerAction 함수는', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        mockSearchTicker.mockReset();
        delete process.env.E2E_TEST;
    });

    afterEach(() => {
        if (originalE2E === undefined) {
            delete process.env.E2E_TEST;
        } else {
            process.env.E2E_TEST = originalE2E;
        }
    });

    it('trim된 query를 use-case searchTicker에 전달한다', async () => {
        mockSearchTicker.mockResolvedValueOnce(results);

        await searchTickerAction('  apple  ');

        expect(mockSearchTicker).toHaveBeenCalledWith('apple');
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

    it('E2E_TEST=1이면 FMP를 호출하지 않고 AAPL 패밀리 픽스처를 반환한다', async () => {
        process.env.E2E_TEST = '1';

        const result = await searchTickerAction('aapl');

        expect(mockSearchTicker).not.toHaveBeenCalled();
        expect(result.some(r => r.symbol === 'AAPL')).toBe(true);
        expect(result.every(r => r.symbol.startsWith('AAP'))).toBe(true);
        expect(result[0]).toMatchObject({
            symbol: expect.any(String),
            name: expect.any(String),
            exchange: expect.any(String),
            exchangeFullName: expect.any(String),
        });
    });

    it('E2E_TEST=1이고 매칭이 없으면 전체 픽스처로 폴백한다', async () => {
        process.env.E2E_TEST = '1';

        const result = await searchTickerAction('zzzz');

        expect(mockSearchTicker).not.toHaveBeenCalled();
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(r => r.symbol === 'AAPL')).toBe(true);
    });
});
