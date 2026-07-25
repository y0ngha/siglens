import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { PrewarmBatchCounts } from '../runPrewarmBatch';
import type { SeamOutcome } from '../harvest';

const {
    mockMarkInFlight,
    mockPrewarmTechnical,
    mockPrewarmOverall,
    mockPrewarmFundamental,
    mockPrewarmFinancials,
    mockPrewarmCongress,
    mockPrewarmNews,
    mockPrewarmOptions,
} = vi.hoisted(() => ({
    mockMarkInFlight: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockPrewarmFinancials: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOptions: vi.fn(),
}));

vi.mock('../lock', () => ({
    markInFlight: mockMarkInFlight,
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: mockPrewarmFinancials,
    prewarmCongress: mockPrewarmCongress,
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: mockPrewarmNews,
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
}));

import { TAB_SEAMS, resolveHarvest } from '../harvest';

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

describe('resolveHarvest', () => {
    let repo: { upsert: ReturnType<typeof vi.fn> };
    let counts: PrewarmBatchCounts;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = { upsert: vi.fn() };
        counts = makeCounts();
    });

    it('returns false and touches nothing when result is null', async () => {
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
        expect(counts).toEqual(makeCounts());
    });

    it('upserts cached result with PREWARM model + generatedAt, returns true', async () => {
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

    it('skips (no upsert, no markInFlight) for status=error, returns false', async () => {
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
        expect(counts).toEqual(makeCounts());
    });

    it('skips (no upsert, no markInFlight) for status=miss_no_trigger, returns false', async () => {
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
        expect(counts).toEqual(makeCounts());
    });
});
