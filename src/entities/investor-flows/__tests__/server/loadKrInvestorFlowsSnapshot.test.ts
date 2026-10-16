import { describe, expect, it, vi } from 'vitest';
import {
    DbDartInvestorFlowsDataProvider,
    loadKrInvestorFlowsSnapshot,
    type KrInvestorFlowsSnapshotReads,
} from '../../server/loadKrInvestorFlowsSnapshot';

/** 2026-10-16 08:00 KST — UTC 날짜는 아직 10-15라 KST 달력으로 재는지 갈린다. */
const NOW = new Date('2026-10-15T23:00:00Z');

const CORP = {
    corpCode: '00126380',
    corpName: '삼성전자',
    matchedStockCode: '005930',
    viaCommonShare: true,
};

function reads(
    over: Partial<KrInvestorFlowsSnapshotReads> = {}
): KrInvestorFlowsSnapshotReads {
    return {
        resolveCorpCode: vi.fn(async () => CORP),
        findMajorHoldings: vi.fn(async () => [
            {
                rceptNo: '20261015000124',
                receiptDate: '2026-10-15',
                reporter: '픽스처자산운용',
                reportForm: 'abbreviated' as const,
                shares: 301_500_000,
                sharesChange: 301_500_000,
                ratioPct: 5.05,
                ratioChangePct: 5.05,
                reason: '신규 보고',
            },
        ]),
        findInsiderReports: vi.fn(async () => []),
        findTradingPlans: vi.fn(async () => []),
        ...over,
    };
}

describe('loadKrInvestorFlowsSnapshot', () => {
    it('maps the symbol to the stock code and reads the company 2-year window on the KST calendar', async () => {
        const r = reads();
        const snapshot = await loadKrInvestorFlowsSnapshot('005935.ks', {
            reads: r,
            now: () => NOW,
            log: () => {},
        });
        expect(r.resolveCorpCode).toHaveBeenCalledWith('005935');
        expect(r.findMajorHoldings).toHaveBeenCalledWith(
            '00126380',
            '2024-10-16'
        );
        expect(r.findInsiderReports).toHaveBeenCalledWith(
            '00126380',
            '2024-10-16'
        );
        expect(r.findTradingPlans).toHaveBeenCalledWith(
            '00126380',
            '2024-10-16'
        );
        expect(snapshot).toMatchObject({ asOf: '2026-10-16', market: 'kr' });
    });

    it('is null without a DART company mapping and reads no filings', async () => {
        const r = reads({ resolveCorpCode: vi.fn(async () => null) });
        expect(
            await loadKrInvestorFlowsSnapshot('999990.KS', {
                reads: r,
                now: () => NOW,
                log: () => {},
            })
        ).toBeNull();
        expect(r.findMajorHoldings).not.toHaveBeenCalled();
    });

    it('is null for a symbol that is not a Korean listing', async () => {
        const r = reads();
        expect(
            await loadKrInvestorFlowsSnapshot('AAPL', {
                reads: r,
                now: () => NOW,
                log: () => {},
            })
        ).toBeNull();
        expect(r.resolveCorpCode).not.toHaveBeenCalled();
    });

    it('logs the rows dropped for missing quantities', async () => {
        const log = vi.fn();
        await loadKrInvestorFlowsSnapshot('005930.KS', {
            reads: reads({
                findInsiderReports: vi.fn(async () => [
                    {
                        rceptNo: '20261015000457',
                        receiptDate: '2026-10-15',
                        reporter: '박주주',
                        position: null,
                        registered: null,
                        majorShareholder: null,
                        shares: null,
                        sharesChange: 1,
                        ratioPct: 1,
                        ratioChangePct: 0,
                    },
                ]),
            }),
            now: () => NOW,
            log,
        });
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('1 DART rows without quantities')
        );
    });

    it('propagates a database failure (the resilient loader degrades it)', async () => {
        await expect(
            loadKrInvestorFlowsSnapshot('005930.KS', {
                reads: reads({
                    findTradingPlans: vi.fn(async () => {
                        throw new Error('db down');
                    }),
                }),
                now: () => NOW,
                log: () => {},
            })
        ).rejects.toThrow('db down');
    });
});

describe('DbDartInvestorFlowsDataProvider', () => {
    it('implements the core port with the injected reads', async () => {
        const provider = new DbDartInvestorFlowsDataProvider({
            reads: reads(),
            now: () => NOW,
            log: () => {},
        });
        expect(
            (await provider.getInvestorFlowsSnapshot('005930.KS'))?.market
        ).toBe('kr');
    });
});
