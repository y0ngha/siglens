import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { PrewarmBatchCounts } from '../runPrewarmBatch';
import type { SeamOutcome } from '../harvest';

const {
    mockMarkSkipped,
    mockClearInFlight,
    mockPrewarmTechnical,
    mockPrewarmOverall,
    mockPrewarmFundamental,
    mockPrewarmFinancials,
    mockPrewarmCongress,
    mockPrewarmNews,
    mockPrewarmOptions,
} = vi.hoisted(() => ({
    mockMarkSkipped: vi.fn(),
    mockClearInFlight: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockPrewarmFinancials: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOptions: vi.fn(),
}));

vi.mock('../lock', () => ({
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
    // 구현과 동일한 값(lock.ts). 일시적 실패 backoff TTL.
    TRANSIENT_SKIP_TTL_SECONDS: 1800,
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
        harvested: 0,
        revalidated: 0,
        remaining: 0,
        fmpBudgetUsed: 0,
        staleTotal: 0,
        durationMs: 0,
    };
}

describe('TAB_SEAMS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrewarmTechnical.mockResolvedValue({ status: 'cached' });
        mockPrewarmOverall.mockResolvedValue({ status: 'cached' });
        mockPrewarmFundamental.mockResolvedValue({ status: 'cached' });
        mockPrewarmFinancials.mockResolvedValue({ status: 'cached' });
        mockPrewarmCongress.mockResolvedValue({ status: 'cached' });
        mockPrewarmNews.mockResolvedValue({ status: 'cached' });
        mockPrewarmOptions.mockResolvedValue({ status: 'cached' });
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

    it('status=done도 cached와 동일하게 upsert하고 true를 반환한다', async () => {
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
        // FMP fetch 실패는 throw가 아니라 이 status로 **반환**된다. 6시간을 걸면
        // FMP 장애 한 번이 4개 축을 그날 밤 내내 배제한다 — 30분이어야 한다.
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'congress', 1800);
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
        // 구조적으로 불가능한 케이스는 기본 6시간을 유지한다(TTL 인자 없음).
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'news', undefined);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'news');
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });
});
