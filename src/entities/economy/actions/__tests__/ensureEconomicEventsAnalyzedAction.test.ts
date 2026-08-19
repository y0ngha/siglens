const {
    revalidateTag,
    isAnalysisRecentlyRun,
    markAnalysisRun,
    runEconomicEventAnalysis,
    listUnanalyzedAnnounced,
    attachEventAnalysis,
    isE2E,
} = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
    isAnalysisRecentlyRun: vi.fn(),
    markAnalysisRun: vi.fn(),
    runEconomicEventAnalysis: vi.fn(),
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
    runEconomicEventAnalysis,
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
import { CALENDAR_ANALYZED_IMPACTS } from '@/entities/economy/lib/economyCalendarConstants';

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
        runEconomicEventAnalysis.mockResolvedValue({
            status: 'cached',
            result: ANALYSIS,
        });
        attachEventAnalysis.mockResolvedValue(undefined);
    });

    it('skips when recently run', async () => {
        isAnalysisRecentlyRun.mockResolvedValue(true);
        await ensureEconomicEventsAnalyzedAction();
        expect(listUnanalyzedAnnounced).not.toHaveBeenCalled();
        expect(runEconomicEventAnalysis).not.toHaveBeenCalled();
    });

    it('short-circuits under E2E (no LLM calls)', async () => {
        isE2E.mockReturnValue(true);
        await ensureEconomicEventsAnalyzedAction();
        expect(runEconomicEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('analyzes Medium+ announced unanalyzed events and revalidates on change (cached path)', async () => {
        await ensureEconomicEventsAnalyzedAction();
        expect(markAnalysisRun).toHaveBeenCalledOnce();
        expect(listUnanalyzedAnnounced).toHaveBeenCalledWith(
            [...CALENDAR_ANALYZED_IMPACTS],
            'US'
        );
        expect(runEconomicEventAnalysis).toHaveBeenCalledWith({
            region: '미국',
            event: 'Core CPI MoM (May)',
            impact: 'High',
            actual: 0.4,
            estimate: 0.3,
            previous: 0.2,
            unit: '%',
        });
        expect(attachEventAnalysis).toHaveBeenCalledWith('id1', ANALYSIS);
        expect(revalidateTag).toHaveBeenCalledWith(
            'economy:calendar:us',
            'max'
        );
    });

    it('done 상태도 cached와 동일하게 저장·revalidate한다', async () => {
        runEconomicEventAnalysis.mockResolvedValue({
            status: 'done',
            result: ANALYSIS,
        });
        await ensureEconomicEventsAnalyzedAction();
        expect(attachEventAnalysis).toHaveBeenCalledWith('id1', ANALYSIS);
        expect(revalidateTag).toHaveBeenCalledWith(
            'economy:calendar:us',
            'max'
        );
    });

    /**
     * 한국 발표는 core에 국가 개념이 없던 동안 분석을 통째로 건너뛰었다(잘못된
     * 해설이 `analyzed_at IS NULL` 가드로 영구히 굳기 때문). core 0.48.0의
     * `region`이 그 축을 받으므로 다시 켰다 — 스킵이 되살아나면 한국 캘린더의
     * 해설 컬럼이 조용히 비어 간다.
     */
    it('한국 발표도 분석하고 region을 한국으로 넘긴다', async () => {
        await ensureEconomicEventsAnalyzedAction('KR');

        expect(listUnanalyzedAnnounced).toHaveBeenCalledWith(
            [...CALENDAR_ANALYZED_IMPACTS],
            'KR'
        );
        expect(runEconomicEventAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ region: '한국' })
        );
        expect(revalidateTag).toHaveBeenCalledWith(
            'economy:calendar:kr',
            'max'
        );
    });

    it('does not revalidate when there is nothing to analyze', async () => {
        listUnanalyzedAnnounced.mockResolvedValue([]);
        await ensureEconomicEventsAnalyzedAction();
        expect(runEconomicEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('swallows a core failure without throwing and skips persist for that event', async () => {
        runEconomicEventAnalysis.mockRejectedValue(new Error('llm down'));
        await expect(
            ensureEconomicEventsAnalyzedAction()
        ).resolves.toBeUndefined();
        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('error 상태면 저장도 revalidate도 하지 않는다 (§18)', async () => {
        runEconomicEventAnalysis.mockResolvedValue({
            status: 'error',
            error: 'llm down',
        });

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
        runEconomicEventAnalysis.mockRejectedValue(new Error('llm down'));

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

    it('skips persist and revalidate when cached result has empty summaryKo (C1 guard)', async () => {
        // core normalizeEconomicEventAnalysis crash-safe fallback: empty summaryKo.
        // Must NOT call attachEventAnalysis (write-once guard) or revalidateTag.
        runEconomicEventAnalysis.mockResolvedValue({
            status: 'cached',
            result: {
                sentiment: 'neutral',
                summaryKo: '',
                interpretationKo: '',
            },
        });

        await ensureEconomicEventsAnalyzedAction();

        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('skips persist and revalidate when summaryKo is whitespace-only (C1 guard)', async () => {
        runEconomicEventAnalysis.mockResolvedValue({
            status: 'cached',
            result: {
                sentiment: 'neutral',
                summaryKo: '   ',
                interpretationKo: '',
            },
        });
        await ensureEconomicEventsAnalyzedAction();
        expect(attachEventAnalysis).not.toHaveBeenCalled();
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('warns but does not error on minority failure, and still revalidates persisted rows', async () => {
        // 3 pending, first fails → 1/3 < majority(1.5)
        const ROW_2 = { ...ROW, id: 'id2', event: 'PPI MoM (May)' };
        const ROW_3 = { ...ROW, id: 'id3', event: 'Retail Sales MoM (May)' };
        listUnanalyzedAnnounced.mockResolvedValue([ROW, ROW_2, ROW_3]);
        runEconomicEventAnalysis
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
            'economy:calendar:us',
            'max'
        );

        consoleWarn.mockRestore();
        consoleError.mockRestore();
    });
});
