import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { PrewarmBatchCounts } from '../runPrewarmBatch';
import type { SeamOutcome } from '../harvest';

const {
    mockMarkInFlight,
    mockMarkSkipped,
    mockClearInFlight,
    mockPrewarmTechnical,
    mockPrewarmOverall,
    mockPrewarmFundamental,
    mockPrewarmFinancials,
    mockPrewarmCongress,
    mockPrewarmNews,
    mockPrewarmOptions,
    mockPrewarmPollTechnical,
    mockPrewarmPollOverall,
    mockPrewarmPollFundamental,
    mockPrewarmPollFinancials,
    mockPrewarmPollCongress,
    mockPrewarmPollNews,
    mockPrewarmPollOptions,
} = vi.hoisted(() => ({
    mockMarkInFlight: vi.fn(),
    mockMarkSkipped: vi.fn(),
    mockClearInFlight: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockPrewarmFinancials: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOptions: vi.fn(),
    mockPrewarmPollTechnical: vi.fn(),
    mockPrewarmPollOverall: vi.fn(),
    mockPrewarmPollFundamental: vi.fn(),
    mockPrewarmPollFinancials: vi.fn(),
    mockPrewarmPollCongress: vi.fn(),
    mockPrewarmPollNews: vi.fn(),
    mockPrewarmPollOptions: vi.fn(),
}));

vi.mock('../lock', () => ({
    markInFlight: mockMarkInFlight,
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: mockPrewarmFinancials,
    prewarmCongress: mockPrewarmCongress,
    prewarmPollTechnical: mockPrewarmPollTechnical,
    prewarmPollOverall: mockPrewarmPollOverall,
    prewarmPollFundamental: mockPrewarmPollFundamental,
    prewarmPollFinancials: mockPrewarmPollFinancials,
    prewarmPollCongress: mockPrewarmPollCongress,
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: mockPrewarmNews,
    prewarmPollNews: mockPrewarmPollNews,
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
    prewarmPollOptions: mockPrewarmPollOptions,
}));

import { TAB_SEAMS, TAB_POLLS, resolveHarvest } from '../harvest';

const CTX = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: undefined,
};

function makeCounts(): PrewarmBatchCounts {
    return {
        submitted: 0,
        harvested: 0,
        revalidated: 0,
        remaining: 0,
        fmpBudgetUsed: 0,
    };
}

describe('TAB_SEAMS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrewarmTechnical.mockResolvedValue({ status: 'submitted' });
        mockPrewarmOverall.mockResolvedValue({ status: 'submitted' });
        mockPrewarmFundamental.mockResolvedValue({ status: 'submitted' });
        mockPrewarmFinancials.mockResolvedValue({ status: 'submitted' });
        mockPrewarmCongress.mockResolvedValue({ status: 'submitted' });
        mockPrewarmNews.mockResolvedValue({ status: 'submitted' });
        mockPrewarmOptions.mockResolvedValue({ status: 'submitted' });
    });

    it('dispatches technical with force=false', async () => {
        await TAB_SEAMS.technical(CTX);
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            undefined,
            false
        );
    });

    it('dispatches overall with force=false', async () => {
        await TAB_SEAMS.overall(CTX);
        expect(mockPrewarmOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });

    it('dispatches fundamental with force=false', async () => {
        await TAB_SEAMS.fundamental(CTX);
        expect(mockPrewarmFundamental).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches financials with force=false', async () => {
        await TAB_SEAMS.financials(CTX);
        expect(mockPrewarmFinancials).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches congress with force=false', async () => {
        await TAB_SEAMS.congress(CTX);
        expect(mockPrewarmCongress).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches news with force=false', async () => {
        await TAB_SEAMS.news(CTX);
        expect(mockPrewarmNews).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });

    it('dispatches options with force=false', async () => {
        await TAB_SEAMS.options(CTX);
        expect(mockPrewarmOptions).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });
});

describe('TAB_POLLS (FIX Z)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrewarmPollTechnical.mockResolvedValue({ status: 'processing' });
        mockPrewarmPollOverall.mockResolvedValue({ status: 'processing' });
        mockPrewarmPollFundamental.mockResolvedValue({ status: 'processing' });
        mockPrewarmPollFinancials.mockResolvedValue({ status: 'processing' });
        mockPrewarmPollCongress.mockResolvedValue({ status: 'processing' });
        mockPrewarmPollNews.mockResolvedValue({ status: 'processing' });
        mockPrewarmPollOptions.mockResolvedValue({ status: 'processing' });
    });

    it('dispatches technical poll with jobId', async () => {
        await TAB_POLLS.technical('job-1');
        expect(mockPrewarmPollTechnical).toHaveBeenCalledWith('job-1');
    });

    it('dispatches overall poll with jobId', async () => {
        await TAB_POLLS.overall('job-1');
        expect(mockPrewarmPollOverall).toHaveBeenCalledWith('job-1');
    });

    it('dispatches fundamental poll with jobId', async () => {
        await TAB_POLLS.fundamental('job-1');
        expect(mockPrewarmPollFundamental).toHaveBeenCalledWith('job-1');
    });

    it('dispatches financials poll with jobId', async () => {
        await TAB_POLLS.financials('job-1');
        expect(mockPrewarmPollFinancials).toHaveBeenCalledWith('job-1');
    });

    it('dispatches congress poll with jobId', async () => {
        await TAB_POLLS.congress('job-1');
        expect(mockPrewarmPollCongress).toHaveBeenCalledWith('job-1');
    });

    it('dispatches news poll with jobId', async () => {
        await TAB_POLLS.news('job-1');
        expect(mockPrewarmPollNews).toHaveBeenCalledWith('job-1');
    });

    it('dispatches options poll with jobId', async () => {
        await TAB_POLLS.options('job-1');
        expect(mockPrewarmPollOptions).toHaveBeenCalledWith('job-1');
    });
});

describe('resolveHarvest', () => {
    let repo: { upsert: ReturnType<typeof vi.fn> };
    let counts: PrewarmBatchCounts;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = { upsert: vi.fn() };
        counts = makeCounts();
    });

    it('null result: markSkipped + clearInFlight, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            null,
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical');
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'technical');
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] skip AAPL:technical — null result'
        );
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    it('upserts cached result with PREWARM model + generatedAt, returns true, clears in-flight', async () => {
        const cached: SeamOutcome = {
            status: 'cached',
            result: { foo: 'bar' },
        };

        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            cached,
            repo as never,
            counts
        );

        expect(ok).toBe(true);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
        const call = repo.upsert.mock.calls[0][0];
        expect(call.symbol).toBe('AAPL');
        expect(call.tab).toBe('overall');
        expect(call.content).toEqual({ foo: 'bar' });
        expect(call.model).toBe(DEEPSEEK_V4_FLASH_MODEL);
        expect(typeof call.model).toBe('string');
        expect(call.model.length).toBeGreaterThan(0);
        expect(call.generatedAt).toBeInstanceOf(Date);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('status=done(poll 완료, FIX Z)도 cached와 동일하게 upsert하고 true를 반환한다', async () => {
        const done: SeamOutcome = {
            status: 'done',
            result: { foo: 'bar' },
        };

        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            done,
            repo as never,
            counts
        );

        expect(ok).toBe(true);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('status=processing(poll 진행 중, FIX Z)은 아무 상태도 바꾸지 않고 false를 반환한다', async () => {
        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            { status: 'processing' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(mockMarkSkipped).not.toHaveBeenCalled();
        expect(mockClearInFlight).not.toHaveBeenCalled();
        expect(counts).toEqual(makeCounts());
    });

    it('marks in-flight and counts submitted for status=submitted, returns false', async () => {
        const ok = await resolveHarvest(
            'AAPL',
            'fundamental',
            { status: 'submitted' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(mockMarkInFlight).toHaveBeenCalledWith('AAPL', 'fundamental');
        expect(counts.submitted).toBe(1);
        expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('marks in-flight and counts submitted for status=pending_dependencies, returns false', async () => {
        const ok = await resolveHarvest(
            'AAPL',
            'financials',
            { status: 'pending_dependencies' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(mockMarkInFlight).toHaveBeenCalledWith('AAPL', 'financials');
        expect(counts.submitted).toBe(1);
        expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('terminal status=error: markSkipped + clearInFlight + warn, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'congress',
            { status: 'error' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'congress');
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'congress');
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] skip AAPL:congress — status=error'
        );
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    it('terminal status=miss_no_trigger: markSkipped + clearInFlight, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'news',
            { status: 'miss_no_trigger' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'news');
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'news');
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });
});
