const { mockClient } = vi.hoisted(() => ({ mockClient: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import { isFmpTransientError } from '@/shared/api/fmp/fmpRetry';
import { OpenFigiRateLimitedError } from '@/shared/api/openfigi/openFigiClient';
import { isSecBlockedError } from '@/shared/api/sec/secClient';
import {
    COMPANY_TICKERS_PATH,
    createCikSymbolMapDeps,
    createCusipMapDeps,
} from '../createDeps';

describe('createCusipMapDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockClient.mockReturnValue({ db: {} });
    });

    it('throws when the database is unavailable', () => {
        mockClient.mockReturnValue(null);
        expect(() => createCusipMapDeps(() => false)).toThrow(
            '[cusip-map] database unavailable'
        );
    });

    it('recognises FMP 429 and OpenFIGI rate limiting as rate limits, and nothing else', () => {
        const { isRateLimitError } = createCusipMapDeps(() => false);
        expect(
            isRateLimitError(new FmpHttpError('profile', 429, null, 'AAPL'))
        ).toBe(true);
        expect(isRateLimitError(new OpenFigiRateLimitedError())).toBe(true);
        expect(isRateLimitError(new FmpHttpError('profile', 500, null))).toBe(
            false
        );
        expect(isRateLimitError(new Error('429'))).toBe(false);
    });

    it('fetches each profile with a single HTTP attempt (no internal transient retry), so the pacer counts real requests', async () => {
        const fetchSpy = vi.fn(
            async (_input: unknown, _init?: RequestInit) =>
                new Response('', { status: 503 })
        );
        vi.stubGlobal('fetch', fetchSpy);
        vi.stubEnv('FMP_API_KEY', 'test-key');
        try {
            const { fetchProfile, isTransientError } = createCusipMapDeps(
                () => false
            );
            const error = await fetchProfile('AAPL').catch(
                (reason: unknown) => reason
            );
            expect(error).toBeInstanceOf(FmpHttpError);
            expect(isTransientError(error)).toBe(true);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
            vi.unstubAllEnvs();
        }
    });

    it('classifies FMP transient errors with the shared FMP rule', () => {
        expect(createCusipMapDeps(() => false).isTransientError).toBe(
            isFmpTransientError
        );
    });

    it('carries the deadline callback through', () => {
        const isDeadlineReached = () => true;
        expect(createCusipMapDeps(isDeadlineReached).isDeadlineReached).toBe(
            isDeadlineReached
        );
    });
});

describe('createCikSymbolMapDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockClient.mockReturnValue({ db: {} });
    });

    it('throws when the database is unavailable', () => {
        mockClient.mockReturnValue(null);
        expect(() => createCikSymbolMapDeps()).toThrow(
            '[cusip-map] database unavailable'
        );
    });

    it('uses the shared SEC block detector', () => {
        expect(createCikSymbolMapDeps().isSecBlockedError).toBe(
            isSecBlockedError
        );
    });

    it('reads company_tickers.json from www.sec.gov/files as JSON', async () => {
        const fetchSpy = vi.fn(
            async (_input: unknown, _init?: RequestInit) =>
                new Response('{"0":{"cik_str":320193,"ticker":"AAPL"}}')
        );
        vi.stubGlobal('fetch', fetchSpy);
        try {
            expect(
                await createCikSymbolMapDeps().fetchCompanyTickers()
            ).toEqual({
                0: { cik_str: 320193, ticker: 'AAPL' },
            });
            expect(fetchSpy).toHaveBeenCalledWith(
                `https://www.sec.gov${COMPANY_TICKERS_PATH}`,
                expect.anything()
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
