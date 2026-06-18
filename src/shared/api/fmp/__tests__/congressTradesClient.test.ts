vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FmpCongressTradesClient } from '../congressTradesClient';

const mockFetch = vi.fn();

const TEST_API_KEY = 'test-api-key';

beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    process.env.FMP_API_KEY = TEST_API_KEY;
});

afterEach(() => {
    vi.restoreAllMocks();
});

function mockOk(body: unknown): void {
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => body,
    } as Response);
}

const sampleSenate = [
    {
        symbol: 'AAPL',
        senateID: 'C001047',
        disclosureDate: '2026-05-07',
        transactionDate: '2026-04-17',
        firstName: 'Shelley',
        lastName: 'Capito',
        office: 'Shelley Capito',
        district: 'WV',
        owner: 'Spouse',
        assetDescription: 'Apple Inc',
        assetType: 'Stock',
        type: 'Sale',
        amount: '$1,001 - $15,000',
        capitalGainsOver200USD: 'False',
        comment: '',
        link: 'https://efd',
    },
];

describe('FmpCongressTradesClient', () => {
    it('senate는 /stable/senate-trades를 대문자 symbol과 함께 호출하고 raw 행을 반환한다', async () => {
        mockOk(sampleSenate);
        const out = await new FmpCongressTradesClient().getTrades(
            'aapl',
            'senate',
            50
        );
        const url = String(mockFetch.mock.calls[0][0]);
        expect(url).toContain('senate-trades');
        expect(url).toContain('symbol=AAPL');
        expect(out[0].type).toBe('Sale'); // RAW row preserved (not normalized)
        expect(out[0].amount).toBe('$1,001 - $15,000');
        expect('side' in out[0]).toBe(false); // NOT normalized
    });

    it('house는 /stable/house-trades를 호출한다', async () => {
        mockOk([]);
        await new FmpCongressTradesClient().getTrades('AAPL', 'house', 50);
        expect(String(mockFetch.mock.calls[0][0])).toContain('house-trades');
    });

    it('limit으로 잘라 반환한다', async () => {
        mockOk([sampleSenate[0], sampleSenate[0], sampleSenate[0]]);
        const out = await new FmpCongressTradesClient().getTrades(
            'AAPL',
            'senate',
            2
        );
        expect(out).toHaveLength(2);
    });

    it('빈 배열 응답은 빈 배열(throw 금지)', async () => {
        mockOk([]);
        expect(
            await new FmpCongressTradesClient().getTrades('ZZZZ', 'senate', 50)
        ).toEqual([]);
    });

    it('FMP 5xx는 throw(장애 표면화)', async () => {
        // withRetry retries 3x on 5xx — provide 4 failing responses so all attempts exhaust
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            headers: new Headers(),
        });
        await expect(
            new FmpCongressTradesClient().getTrades('AAPL', 'senate', 50)
        ).rejects.toBeDefined();
    });
});
