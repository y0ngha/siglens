import { PATCH } from '@/app/api/cron/earnings-calendar-sync/route';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/infrastructure/fmp/newsClient', () => ({
    FmpNewsClient: jest.fn().mockImplementation(() => ({
        fetchEarningsCalendarAll: jest.fn(),
    })),
}));

jest.mock('@/infrastructure/db/earningsCalendarRepository', () => ({
    DrizzleEarningsCalendarRepository: jest.fn().mockImplementation(() => ({
        upsertMany: jest.fn(),
    })),
}));

jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn().mockReturnValue({ db: {} }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';

const MockFmpNewsClient = FmpNewsClient as jest.MockedClass<
    typeof FmpNewsClient
>;
const MockEarningsCalendarRepository =
    DrizzleEarningsCalendarRepository as jest.MockedClass<
        typeof DrizzleEarningsCalendarRepository
    >;

/** Build a minimal Request with the given Authorization header value. */
function makeRequest(authHeader?: string): Request {
    const headers: HeadersInit = authHeader
        ? { authorization: authHeader }
        : {};
    return new Request('http://localhost/api/cron/earnings-calendar-sync', {
        method: 'PATCH',
        headers,
    });
}

const CRON_SECRET = 'test-cron-secret-abc';

const SAMPLE_ITEM: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: 1.5,
    epsEstimated: 1.4,
    revenueActual: 90_000_000_000,
    revenueEstimated: 88_000_000_000,
    lastUpdated: '2025-07-15',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/cron/earnings-calendar-sync', () => {
    const originalSecret = process.env.CRON_SECRET;

    beforeAll(() => {
        process.env.CRON_SECRET = CRON_SECRET;
    });

    afterAll(() => {
        process.env.CRON_SECRET = originalSecret;
    });

    beforeEach(() => {
        MockFmpNewsClient.mockClear();
        MockEarningsCalendarRepository.mockClear();
    });

    it('returns 401 when Authorization header is missing', async () => {
        const res = await PATCH(makeRequest());

        expect(res.status).toBe(401);
    });

    it('returns 401 when CRON_SECRET env var is unset even if header is "Bearer undefined"', async () => {
        const saved = process.env.CRON_SECRET;
        delete process.env.CRON_SECRET;
        try {
            const res = await PATCH(makeRequest('Bearer undefined'));
            expect(res.status).toBe(401);
        } finally {
            process.env.CRON_SECRET = saved;
        }
    });

    it('returns 401 when Authorization header contains a wrong secret', async () => {
        const res = await PATCH(makeRequest('Bearer wrong-secret'));

        expect(res.status).toBe(401);
    });

    it('returns 200 with inserted count when bearer is valid and client returns items', async () => {
        const items = [SAMPLE_ITEM, { ...SAMPLE_ITEM, symbol: 'GOOG' }];

        const mockFetchAll = jest.fn().mockResolvedValue(items);
        MockFmpNewsClient.mockImplementation(
            () => ({ fetchEarningsCalendarAll: mockFetchAll }) as never
        );

        const mockUpsertMany = jest.fn().mockResolvedValue(undefined);
        MockEarningsCalendarRepository.mockImplementation(
            () => ({ upsertMany: mockUpsertMany }) as never
        );

        const res = await PATCH(makeRequest(`Bearer ${CRON_SECRET}`));
        const body = (await res.json()) as { inserted: number };

        expect(res.status).toBe(200);
        expect(body.inserted).toBe(2);
        expect(mockUpsertMany).toHaveBeenCalledWith(items);
    });

    it('returns 200 with inserted:0 when the calendar is empty', async () => {
        const mockFetchAll = jest.fn().mockResolvedValue([]);
        MockFmpNewsClient.mockImplementation(
            () => ({ fetchEarningsCalendarAll: mockFetchAll }) as never
        );

        const mockUpsertMany = jest.fn().mockResolvedValue(undefined);
        MockEarningsCalendarRepository.mockImplementation(
            () => ({ upsertMany: mockUpsertMany }) as never
        );

        const res = await PATCH(makeRequest(`Bearer ${CRON_SECRET}`));
        const body = (await res.json()) as { inserted: number };

        expect(res.status).toBe(200);
        expect(body.inserted).toBe(0);
    });
});
