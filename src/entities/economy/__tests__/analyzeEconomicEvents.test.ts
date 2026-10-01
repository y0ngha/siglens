const mocks = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
    isAnalysisRecentlyRun: vi.fn(),
    markAnalysisRun: vi.fn(),
    runEconomicEventAnalysis: vi.fn(),
    listUnanalyzedAnnounced: vi.fn(),
    attachEventAnalysis: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@/entities/economy/api/calendarAnalysisRefreshFlag', () => ({
    isAnalysisRecentlyRun: mocks.isAnalysisRecentlyRun,
    markAnalysisRun: mocks.markAnalysisRun,
}));
vi.mock('@y0ngha/siglens-core', () => ({
    runEconomicEventAnalysis: mocks.runEconomicEventAnalysis,
}));
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listUnanalyzedAnnounced = mocks.listUnanalyzedAnnounced;
        attachEventAnalysis = mocks.attachEventAnalysis;
    },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { analyzeEconomicEvents } from '@/entities/economy/api/analyzeEconomicEvents';
import {
    CALENDAR_ANALYZED_IMPACTS,
    economyCalendarCacheTag,
} from '@/entities/economy/lib/economyCalendarConstants';

const row = (id: string) => ({
    id,
    event: `Event ${id}`,
    impact: 'High' as const,
    actual: 0.4,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
});
const ANALYSIS = {
    sentiment: 'bullish' as const,
    summaryKo: '요약',
    interpretationKo: '해석',
};

describe('analyzeEconomicEvents', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isAnalysisRecentlyRun.mockResolvedValue(false);
        mocks.markAnalysisRun.mockResolvedValue(undefined);
        mocks.listUnanalyzedAnnounced.mockResolvedValue([row('a')]);
        mocks.runEconomicEventAnalysis.mockResolvedValue({
            status: 'done',
            result: ANALYSIS,
        });
        mocks.attachEventAnalysis.mockResolvedValue(undefined);
    });

    it('플래그가 살아 있으면 recently-run으로 단락하고 DB를 읽지 않는다', async () => {
        mocks.isAnalysisRecentlyRun.mockResolvedValue(true);

        const result = await analyzeEconomicEvents('US', { logLabel: 't' });

        expect(result).toEqual({ status: 'recently-run' });
        expect(mocks.markAnalysisRun).not.toHaveBeenCalled();
        expect(mocks.listUnanalyzedAnnounced).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
    });

    it('분석 전에 플래그를 먼저 세운다 — 동시 호출 dedup', async () => {
        const order: string[] = [];
        mocks.markAnalysisRun.mockImplementation(async () => {
            order.push('mark');
        });
        mocks.listUnanalyzedAnnounced.mockImplementation(async () => {
            order.push('list');
            return [];
        });

        await analyzeEconomicEvents('US', { logLabel: 't' });

        expect(order).toEqual(['mark', 'list']);
        expect(mocks.listUnanalyzedAnnounced).toHaveBeenCalledWith(
            CALENDAR_ANALYZED_IMPACTS,
            'US'
        );
    });

    it('미분석 이벤트가 없으면 persisted 0·pending 0이고 태그를 안 턴다', async () => {
        mocks.listUnanalyzedAnnounced.mockResolvedValue([]);

        const result = await analyzeEconomicEvents('US', { logLabel: 't' });

        expect(result).toEqual({ status: 'ok', persisted: 0, pending: 0 });
        expect(mocks.runEconomicEventAnalysis).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
    });

    it('limit이 없으면 미분석 전부를 분석한다', async () => {
        mocks.listUnanalyzedAnnounced.mockResolvedValue([
            row('a'),
            row('b'),
            row('c'),
        ]);

        const result = await analyzeEconomicEvents('US', { logLabel: 't' });

        expect(result).toEqual({ status: 'ok', persisted: 3, pending: 0 });
        expect(mocks.runEconomicEventAnalysis).toHaveBeenCalledTimes(3);
    });

    it('limit이 있으면 앞에서 limit개만 분석하고 나머지를 pending으로 센다', async () => {
        mocks.listUnanalyzedAnnounced.mockResolvedValue([
            row('a'),
            row('b'),
            row('c'),
            row('d'),
        ]);

        const result = await analyzeEconomicEvents('US', {
            limit: 2,
            logLabel: 't',
        });

        expect(result).toEqual({ status: 'ok', persisted: 2, pending: 2 });
        expect(mocks.runEconomicEventAnalysis).toHaveBeenCalledTimes(2);
        expect(mocks.attachEventAnalysis).toHaveBeenCalledWith('a', ANALYSIS);
        expect(mocks.attachEventAnalysis).toHaveBeenCalledWith('b', ANALYSIS);
        expect(mocks.attachEventAnalysis).not.toHaveBeenCalledWith(
            'c',
            expect.anything()
        );
    });

    it('region을 넘겨 경제권별로 분석한다', async () => {
        await analyzeEconomicEvents('KR', { logLabel: 't' });

        expect(mocks.runEconomicEventAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'Event a',
                region: expect.any(String),
            })
        );
    });

    it('1건 이상 persist되면 국가별 캘린더 태그만 턴다', async () => {
        await analyzeEconomicEvents('KR', { logLabel: 't' });

        expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
        expect(mocks.revalidateTag).toHaveBeenCalledWith(
            economyCalendarCacheTag('KR'),
            'max'
        );
    });

    it('persist가 0이면(빈 summaryKo) 태그를 털지 않는다', async () => {
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mocks.runEconomicEventAnalysis.mockResolvedValue({
            status: 'done',
            result: { ...ANALYSIS, summaryKo: '  ' },
        });

        const result = await analyzeEconomicEvents('US', { logLabel: 't' });

        expect(result).toEqual({ status: 'ok', persisted: 0, pending: 0 });
        expect(mocks.attachEventAnalysis).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('일부가 실패해도 성공분만 센다 — 과반 실패는 에러 로그만', async () => {
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mocks.listUnanalyzedAnnounced.mockResolvedValue([
            row('a'),
            row('b'),
            row('c'),
        ]);
        mocks.runEconomicEventAnalysis
            .mockResolvedValueOnce({ status: 'done', result: ANALYSIS })
            .mockRejectedValueOnce(new Error('llm'))
            .mockRejectedValueOnce(new Error('llm'));

        const result = await analyzeEconomicEvents('US', { logLabel: 'lbl' });

        expect(result).toEqual({ status: 'ok', persisted: 1, pending: 0 });
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[lbl] majority analyze failure')
        );
        expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
