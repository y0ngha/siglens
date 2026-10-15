vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    INSIDER_RENDER_BUDGET_MS,
    INSIDER_RENDER_MAX_PAGES,
} from '@/shared/api/fmp/investorFlowsFmpClient';
import { runWithRenderBudget } from '@/shared/lib/renderBudget';
import { AAPL_SUBMISSIONS } from './fixtures/submissionsSample';
import {
    FmpInvestorFlowsClient,
    INSIDER_MAX_PAGES,
    INSIDER_PAGE_SIZE,
} from '../investorFlowsFmpClient';

/** Deny-by-default: URLs the test does not route throw instead of reaching FMP. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);
const NOW = new Date('2026-10-15T12:00:00Z');

const trade = (filingDate: string): Record<string, unknown> => ({
    symbol: 'AAPL',
    filingDate,
    transactionDate: filingDate,
    transactionType: 'S-Sale',
    securitiesTransacted: 1,
});
const page = (n: number, filingDate: string) =>
    Array.from({ length: n }, () => trade(filingDate));

function route(handler: (url: URL) => unknown): void {
    fetchSpy.mockImplementation(async input => {
        const body = handler(new URL(String(input)));
        return new Response(JSON.stringify(body), { status: 200 });
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('FMP_API_KEY', 'test-key');
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('FmpInvestorFlowsClient.getInsiderTrades', () => {
    it('requests insider-trading/search with symbol, page and the page size', async () => {
        route(() => []);
        await new FmpInvestorFlowsClient().getInsiderTrades('aapl', 180);
        const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
        expect(url.pathname).toBe('/stable/insider-trading/search');
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            symbol: 'AAPL',
            page: '0',
            limit: String(INSIDER_PAGE_SIZE),
        });
    });

    it('keeps paging while a full page is still inside the window, then stops at the first short page', async () => {
        route(url => {
            const p = Number(url.searchParams.get('page'));
            return p === 0
                ? page(200, '2026-09-01')
                : p === 1
                  ? page(200, '2026-08-01')
                  : page(40, '2026-07-01');
        });
        const rows = await new FmpInvestorFlowsClient().getInsiderTrades(
            'AAPL',
            180
        );
        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(rows).toHaveLength(440);
    });

    it('stops as soon as a page reaches rows older than the window and drops the old rows', async () => {
        route(url =>
            Number(url.searchParams.get('page')) === 0
                ? [...page(60, '2026-09-01'), ...page(40, '2026-01-01')]
                : page(100, '2025-01-01')
        );
        const rows = await new FmpInvestorFlowsClient().getInsiderTrades(
            'AAPL',
            180
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(rows).toHaveLength(60);
    });

    it('treats the cutoff day as inside the window', async () => {
        // 180 days before 2026-10-15 is 2026-04-18
        route(() => [trade('2026-04-18'), trade('2026-04-17')]);
        const rows = await new FmpInvestorFlowsClient().getInsiderTrades(
            'AAPL',
            180
        );
        expect(rows.map(r => r.filingDate)).toEqual(['2026-04-18']);
    });

    it('caps the number of pages for symbols with endless full recent pages', async () => {
        route(() => page(INSIDER_PAGE_SIZE, '2026-10-01'));
        await new FmpInvestorFlowsClient().getInsiderTrades('AAPL', 180);
        expect(fetchSpy).toHaveBeenCalledTimes(INSIDER_MAX_PAGES);
    });

    it('returns [] for an empty first page', async () => {
        route(() => []);
        expect(
            await new FmpInvestorFlowsClient().getInsiderTrades('ZZZZ', 180)
        ).toEqual([]);
    });

    it('propagates an FMP error instead of returning []', async () => {
        fetchSpy.mockImplementation(
            async () => new Response('', { status: 402 })
        );
        await expect(
            new FmpInvestorFlowsClient().getInsiderTrades('AAPL', 180)
        ).rejects.toMatchObject({ status: 402 });
    });
});

describe('FmpInvestorFlowsClient.getBeneficialOwnership form lookup', () => {
    const row = (
        accession: string,
        filingDate: string,
        over: Record<string, unknown> = {}
    ) => ({
        symbol: 'AAPL',
        cik: '0000320193',
        filingDate,
        nameOfReportingPerson: 'X',
        url: `https://www.sec.gov/Archives/edgar/data/320193/${accession}/xslSCHEDULE_13G_X02/primary_doc.xml`,
        ...over,
    });
    const NEW = '000210011926000139'; // 0002100119-26-000139 = SCHEDULE 13G
    const AMEND = '000010290926000630'; // 0000102909-26-000630 = SCHEDULE 13G/A
    const LEGACY = '000119312524036431'; // 0001193125-24-036431 = SC 13G/A

    it('does exactly one SEC submissions call per symbol and attaches the exact form, /A included', async () => {
        route(() => [
            row(NEW, '2026-04-29'),
            row(AMEND, '2026-03-26'),
            row(LEGACY, '2024-02-14'),
        ]);
        const fetchSubmissions = vi.fn(async () => AAPL_SUBMISSIONS);
        const rows = await new FmpInvestorFlowsClient(
            fetchSubmissions
        ).getBeneficialOwnership('AAPL', 50);
        expect(fetchSubmissions).toHaveBeenCalledTimes(1);
        expect(fetchSubmissions).toHaveBeenCalledWith('CIK0000320193.json');
        expect(rows.map(r => r.form)).toEqual([
            'SCHEDULE 13G',
            'SCHEDULE 13G/A',
            'SC 13G/A',
        ]);
        expect(rows.some(r => r.formLookupFailed)).toBe(false);
    });

    it('marks rows formLookupFailed (not thrown) when the SEC lookup fails, keeping the FMP rows', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        route(() => [row(NEW, '2026-04-29')]);
        const fetchSubmissions = vi.fn(async () => {
            throw new Error('SEC down');
        });
        const rows = await new FmpInvestorFlowsClient(
            fetchSubmissions
        ).getBeneficialOwnership('AAPL', 50);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ formLookupFailed: true });
        expect(rows[0]?.form).toBeUndefined();
        warn.mockRestore();
    });

    it('marks rows formLookupFailed when FMP gave no subject cik', async () => {
        route(() => [row(NEW, '2026-04-29', { cik: null })]);
        const fetchSubmissions = vi.fn(async () => AAPL_SUBMISSIONS);
        const rows = await new FmpInvestorFlowsClient(
            fetchSubmissions
        ).getBeneficialOwnership('AAPL', 50);
        expect(fetchSubmissions).not.toHaveBeenCalled();
        expect(rows[0]?.formLookupFailed).toBe(true);
    });

    it('leaves a row without form (and without the failure flag) when the list lacks its accession', async () => {
        route(() => [row('000000000026000001', '2026-04-29')]);
        const rows = await new FmpInvestorFlowsClient(
            async () => AAPL_SUBMISSIONS
        ).getBeneficialOwnership('AAPL', 50);
        expect(rows[0]?.form).toBeUndefined();
        expect(rows[0]?.formLookupFailed).toBeUndefined();
    });

    it('opens an archive file only when a row is older than what filings.recent covers', async () => {
        route(() => [row('000000000014000001', '2014-02-01')]);
        const archive = {
            accessionNumber: ['0000000000-14-000001'],
            filingDate: ['2014-02-01'],
            form: ['SC 13D/A'],
        };
        const fetchSubmissions = vi.fn(async (name: string) =>
            name.includes('-submissions-001') ? archive : AAPL_SUBMISSIONS
        );
        const rows = await new FmpInvestorFlowsClient(
            fetchSubmissions
        ).getBeneficialOwnership('AAPL', 50);
        expect(fetchSubmissions.mock.calls.map(c => c[0])).toEqual([
            'CIK0000320193.json',
            'CIK0000320193-submissions-001.json',
        ]);
        expect(rows[0]?.form).toBe('SC 13D/A');
    });

    it('does not open archive files for rows that recent already resolved', async () => {
        route(() => [row(NEW, '2026-04-29')]);
        const fetchSubmissions = vi.fn(async () => AAPL_SUBMISSIONS);
        await new FmpInvestorFlowsClient(
            fetchSubmissions
        ).getBeneficialOwnership('AAPL', 50);
        expect(fetchSubmissions).toHaveBeenCalledTimes(1);
    });

    it('makes no SEC call for an empty 13D/G list', async () => {
        route(() => []);
        const fetchSubmissions = vi.fn(async () => AAPL_SUBMISSIONS);
        expect(
            await new FmpInvestorFlowsClient(
                fetchSubmissions
            ).getBeneficialOwnership('QUIET', 50)
        ).toEqual([]);
        expect(fetchSubmissions).not.toHaveBeenCalled();
    });
});

describe('FmpInvestorFlowsClient insider pagination on the render path', () => {
    it('is capped at INSIDER_RENDER_MAX_PAGES inside a render budget (deep pagination is batch-only)', async () => {
        route(() => page(INSIDER_PAGE_SIZE, '2026-10-01'));
        await runWithRenderBudget(() =>
            new FmpInvestorFlowsClient().getInsiderTrades('AAPL', 365)
        );
        expect(fetchSpy).toHaveBeenCalledTimes(INSIDER_RENDER_MAX_PAGES);
        expect(INSIDER_RENDER_MAX_PAGES).toBeLessThan(INSIDER_MAX_PAGES);
    });

    it('still pages deeply in batch work (outside a render budget)', async () => {
        route(() => page(INSIDER_PAGE_SIZE, '2026-10-01'));
        await new FmpInvestorFlowsClient().getInsiderTrades('AAPL', 365);
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(
            INSIDER_RENDER_MAX_PAGES
        );
    });

    it('stops paging once the render time budget is spent and returns what it already has', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        route(() => {
            vi.setSystemTime(Date.now() + INSIDER_RENDER_BUDGET_MS / 2 + 1);
            return page(INSIDER_PAGE_SIZE, '2026-10-01');
        });
        const rows = await runWithRenderBudget(() =>
            new FmpInvestorFlowsClient().getInsiderTrades('AAPL', 365)
        );
        // page 0 (t+3s), page 1 (t+6s) → budget spent before page 2
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(rows).toHaveLength(INSIDER_PAGE_SIZE * 2);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('cut short'));
        warn.mockRestore();
    });
});

describe('FmpInvestorFlowsClient other endpoints', () => {
    it('statistics: returns the rows', async () => {
        route(() => [{ symbol: 'AAPL', year: 2026, quarter: 4 }]);
        expect(
            await new FmpInvestorFlowsClient().getInsiderStatistics('aapl')
        ).toEqual([{ symbol: 'AAPL', year: 2026, quarter: 4 }]);
        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
            '/stable/insider-trading/statistics?symbol=AAPL'
        );
    });

    it('beneficial ownership: passes symbol and limit', async () => {
        route(() => []);
        await new FmpInvestorFlowsClient().getBeneficialOwnership('aapl', 50);
        const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
        expect(url.pathname).toBe(
            '/stable/acquisition-of-beneficial-ownership'
        );
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            symbol: 'AAPL',
            limit: '50',
        });
    });

    it('shares float: first row or null', async () => {
        route(() => [{ symbol: 'AAPL', floatShares: 1, outstandingShares: 2 }]);
        expect(
            await new FmpInvestorFlowsClient().getSharesFloat('AAPL')
        ).toEqual({ symbol: 'AAPL', floatShares: 1, outstandingShares: 2 });
        route(() => []);
        expect(
            await new FmpInvestorFlowsClient().getSharesFloat('ZZZZ')
        ).toBeNull();
    });

    it('non-array bodies are treated as no rows', async () => {
        route(() => ({ 'Error Message': 'x' }));
        expect(
            await new FmpInvestorFlowsClient().getInsiderStatistics('AAPL')
        ).toEqual([]);
        expect(
            await new FmpInvestorFlowsClient().getBeneficialOwnership('AAPL', 5)
        ).toEqual([]);
    });
});
