const {
    revalidateTag,
    isAnalysisRecentlyRun,
    markAnalysisRun,
    submitEconomicEventAnalysis,
    pollEconomicEventAnalysis,
    listUnanalyzedAnnounced,
    attachEventAnalysis,
    isE2E,
} = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
    isAnalysisRecentlyRun: vi.fn(),
    markAnalysisRun: vi.fn(),
    submitEconomicEventAnalysis: vi.fn(),
    pollEconomicEventAnalysis: vi.fn(),
    listUnanalyzedAnnounced: vi.fn(),
    attachEventAnalysis: vi.fn(),
    isE2E: vi.fn(() => false),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@/entities/economy/api/calendarAnalysisRefreshFlag', () => ({
    isAnalysisRecentlyRun,
    markAnalysisRun,
}));
vi.mock('@y0ngha/siglens-core', () => ({
    submitEconomicEventAnalysis,
    pollEconomicEventAnalysis,
}));
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listUnanalyzedAnnounced = listUnanalyzedAnnounced;
        attachEventAnalysis = attachEventAnalysis;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));
// sleep is mocked to avoid real 2s delays in tests
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/lib/withConcurrencyLimit', async () => {
    const actual = await vi.importActual<
        typeof import('@/shared/lib/withConcurrencyLimit')
    >('@/shared/lib/withConcurrencyLimit');
    return actual;
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ensureEconomicEventsAnalyzedAction } from '@/entities/economy/actions/ensureEconomicEventsAnalyzedAction';
import {
    ECONOMY_CALENDAR_CACHE_TAG,
    CALENDAR_ANALYZED_IMPACTS,
} from '@/entities/economy/lib/economyCalendarConstants';

const ROW = {
    id: 'id1',
    event: 'Core CPI MoM (May)',
    impact: 'High' as const,
    actual: 0.4,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
};
const ANALYSIS = {
    sentiment: 'bullish' as const,
    summaryKo: '요약',
    interpretationKo: '해석',
};

describe('ensureEconomicEventsAnalyzedAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        isAnalysisRecentlyRun.mockResolvedValue(false);
        markAnalysisRun.mockResolvedValue(undefined);
        listUnanalyzedAnnounced.mockResolvedValue([ROW]);
        // Default: cache hit (simplest path, avoids poll complexity in most tests)
        submitEconomicEventAnalysis.mockResolvedValue({
            status: 'cached',
            result: ANALYSIS,
        });
        pollEconomicEventAnalysis.mockResolvedValue({
            status: 'done',
            result: ANALYSIS,
        });
        attachEventAnalysis.mockResolvedValue(undefined);
    });

    it('skips when recently run', async () => {
        isAnalysisRecentlyRun.mockResolvedValue(true);
        await ensureEconomicEventsAnalyzedAction();
        expect(listUnanalyzedAnnounced).not.toHaveBeenCalled();
        expect(submitEconomicEventAnalysis).not.toHaveBeenCalled();
    });

    it('short-circuits under E2E (no LLM calls)', async () => {
        isE2E.mockReturnValue(true);
        await ensureEconomicEventsAnalyzedAction();
        expect(submitEconomicEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('analyzes Medium+ announced unanalyzed events and revalidates on change (cached path)', async () => {
        await ensureEconomicEventsAnalyzedAction();
        expect(markAnalysisRun).toHaveBeenCalledOnce();
        expect(listUnanalyzedAnnounced).toHaveBeenCalledWith([
            ...CALENDAR_ANALYZED_IMPACTS,
        ]);
        expect(submitEconomicEventAnalysis).toHaveBeenCalledWith({
            event: 'Core CPI MoM (May)',
            impact: 'High',
            actual: 0.4,
            estimate: 0.3,
            previous: 0.2,
            unit: '%',
        });
        expect(attachEventAnalysis).toHaveBeenCalledWith('id1', ANALYSIS);
        expect(revalidateTag).toHaveBeenCalledWith(
            ECONOMY_CALENDAR_CACHE_TAG,
            'max'
        );
    });

    it('analyzes via poll when submit returns submitted status', async () => {
        submitEconomicEventAnalysis.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-abc',
        });
        pollEconomicEventAnalysis.mockResolvedValue({
            status: 'done',
            result: ANALYSIS,
        });
        await ensureEconomicEventsAnalyzedAction();
        expect(pollEconomicEventAnalysis).toHaveBeenCalledWith('job-abc');
        expect(attachEventAnalysis).toHaveBeenCalledWith('id1', ANALYSIS);
        expect(revalidateTag).toHaveBeenCalledWith(
            ECONOMY_CALENDAR_CACHE_TAG,
            'max'
        );
    });

    it('does not revalidate when there is nothing to analyze', async () => {
        listUnanalyzedAnnounced.mockResolvedValue([]);
        await ensureEconomicEventsAnalyzedAction();
        expect(submitEconomicEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('swallows a core failure without throwing and skips persist for that event', async () => {
        submitEconomicEventAnalysis.mockRejectedValue(new Error('llm down'));
        await expect(
            ensureEconomicEventsAnalyzedAction()
        ).resolves.toBeUndefined();
        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not attach or revalidate when poll returns error status (§18)', async () => {
        // submit → submitted path; poll → error
        submitEconomicEventAnalysis.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-err',
        });
        pollEconomicEventAnalysis.mockResolvedValue({
            status: 'error',
            error: 'llm down',
        });

        await expect(
            ensureEconomicEventsAnalyzedAction()
        ).resolves.toBeUndefined();

        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('does not attach or revalidate when poll times out (§18)', async () => {
        // submit → submitted path; poll always returns processing (loop exhausts)
        submitEconomicEventAnalysis.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-timeout',
        });
        pollEconomicEventAnalysis.mockResolvedValue({ status: 'processing' });

        // sleep is already mocked as a no-op — 30 iterations run instantly
        await expect(
            ensureEconomicEventsAnalyzedAction()
        ).resolves.toBeUndefined();

        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('logs console.error and skips revalidate when majority of events fail (§18)', async () => {
        // Two unanalyzed events; both submit calls reject → failures (2) > pending (2) / 2
        const ROW_2 = { ...ROW, id: 'id2', event: 'PPI MoM (May)' };
        listUnanalyzedAnnounced.mockResolvedValue([ROW, ROW_2]);
        submitEconomicEventAnalysis.mockRejectedValue(new Error('llm down'));

        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            ensureEconomicEventsAnalyzedAction()
        ).resolves.toBeUndefined();

        // The majority-failure console.error must have fired with the exact message
        expect(consoleError).toHaveBeenCalledWith(
            '[ensureEconomicEventsAnalyzedAction] majority analyze failure (2/2)'
        );

        // No rows persisted → revalidateTag must NOT be called
        expect(revalidateTag).not.toHaveBeenCalled();

        consoleWarn.mockRestore();
        consoleError.mockRestore();
    });

    it('warns but does not error on minority failure, and still revalidates persisted rows', async () => {
        // 3 pending, first fails → 1/3 < majority(1.5)
        const ROW_2 = { ...ROW, id: 'id2', event: 'PPI MoM (May)' };
        const ROW_3 = { ...ROW, id: 'id3', event: 'Retail Sales MoM (May)' };
        listUnanalyzedAnnounced.mockResolvedValue([ROW, ROW_2, ROW_3]);
        submitEconomicEventAnalysis
            .mockRejectedValueOnce(new Error('llm down'))
            .mockResolvedValue({ status: 'cached', result: ANALYSIS });
        const consoleWarn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await ensureEconomicEventsAnalyzedAction();

        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('1/3 analyze failed'),
            expect.any(Array)
        );
        expect(consoleError).not.toHaveBeenCalledWith(
            expect.stringContaining('majority analyze failure')
        );
        expect(revalidateTag).toHaveBeenCalledWith(
            ECONOMY_CALENDAR_CACHE_TAG,
            'max'
        );

        consoleWarn.mockRestore();
        consoleError.mockRestore();
    });
});
