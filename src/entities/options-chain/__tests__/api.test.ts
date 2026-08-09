import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        runOptionsAnalysis: vi.fn(),
    };
});

vi.mock('../lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
}));

import {
    runOptionsAnalysis,
    DEEPSEEK_V4_FLASH_MODEL,
    type RunOptionsAnalysisResult,
    type OptionsSnapshot,
    type OptionsChain,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '../lib/optionsDataCache';
import { prewarmOptions } from '../api';

const SEAM_SOURCE = readFileSync(
    fileURLToPath(new URL('../api.ts', import.meta.url)),
    'utf8'
);

const mockRunOptionsAnalysis = vi.mocked(runOptionsAnalysis);
const mockFetchOptionsSnapshot = vi.mocked(fetchOptionsSnapshot);

const DONE_RESULT: RunOptionsAnalysisResult = {
    status: 'done',
    result: {} as never,
};

const NOW = new Date('2026-07-25T12:00:00Z');

function makeChain(expirationDate: string): OptionsChain {
    return {
        expirationDate,
        daysToExpiration: 0,
        calls: [],
        puts: [],
    };
}

function makeSnapshot(chains: OptionsChain[]): OptionsSnapshot {
    return {
        symbol: 'AAPL',
        underlyingPrice: 150,
        capturedAt: NOW.toISOString(),
        chains,
    };
}

describe('prewarmOptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        mockRunOptionsAnalysis.mockResolvedValue(DONE_RESULT);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns null without calling runOptionsAnalysis when the snapshot is null (NoChains)', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(null);

        const result = await prewarmOptions('AAPL', 'Apple Inc.', false);

        expect(result).toBeNull();
        expect(mockRunOptionsAnalysis).not.toHaveBeenCalled();
    });

    it('calls runOptionsAnalysis with the anonymous-free branch shape and the snapshot threaded', async () => {
        const snapshot = makeSnapshot([makeChain('2026-08-01')]);
        mockFetchOptionsSnapshot.mockResolvedValueOnce(snapshot);

        await prewarmOptions('AAPL', 'Apple Inc.', false);

        expect(mockRunOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                modelId: DEEPSEEK_V4_FLASH_MODEL,
                snapshot,
                tier: 'free',
                reasoning: false,
                skipEnqueueIfMiss: false,
            })
        );
    });

    it('threads force:true when requested', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(
            makeSnapshot([makeChain('2026-08-01')])
        );

        await prewarmOptions('AAPL', 'Apple Inc.', true);

        expect(mockRunOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(
            makeSnapshot([makeChain('2026-08-01')])
        );

        await prewarmOptions('AAPL', 'Apple Inc.', false);

        const callArg = mockRunOptionsAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });

    it('picks the nearest mapped slot expiration (mirrors OptionsPageClient initial default)', async () => {
        // NOW = 2026-07-25. A same-week (~0D) expiration should win over a
        // farther one — mirrors mapExpirationsToSlots picking the closest match
        // for the earliest slot in EXPIRATION_SLOTS render order.
        const nearExpiration = '2026-07-31';
        const farExpiration = '2027-01-29';
        mockFetchOptionsSnapshot.mockResolvedValueOnce(
            makeSnapshot([makeChain(farExpiration), makeChain(nearExpiration)])
        );

        await prewarmOptions('AAPL', 'Apple Inc.', false);

        expect(mockRunOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ expirationDate: nearExpiration })
        );
    });

    it("falls back to 'all' when no expiration maps to a slot", async () => {
        // A snapshot whose only expiration is in the past never maps to any slot
        // (mapExpirationsToSlots filters out negative day-deltas).
        mockFetchOptionsSnapshot.mockResolvedValueOnce(
            makeSnapshot([makeChain('2020-01-01')])
        );

        await prewarmOptions('AAPL', 'Apple Inc.', false);

        expect(mockRunOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ expirationDate: 'all' })
        );
    });

    it('static guard: the seam source contains no request-context calls', () => {
        expect(SEAM_SOURCE).not.toMatch(
            /next\/headers|getCurrentUser|isBot|cookies|draftMode/
        );
    });
});
