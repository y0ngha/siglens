import { describe, expect, it } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import {
    assembleKrInvestorFlowsSnapshot,
    dartFilingUrl,
    toKrInsiderReport,
    toKrMajorHolderReport,
    toKrTradingPlan,
} from '../../lib/krInvestorFlowsSnapshot';
import type {
    DartInsiderReportRecord,
    DartMajorHoldingRecord,
    DartTradingPlanRecord,
} from '../../api/investorFlowsDartRepository';

const MAJOR: DartMajorHoldingRecord = {
    rceptNo: '20261015000124',
    receiptDate: '2026-10-15',
    reporter: '픽스처자산운용',
    reportForm: 'abbreviated',
    shares: 301_500_000,
    sharesChange: 301_500_000,
    ratioPct: 5.05,
    ratioChangePct: 5.05,
    reason: '신규 보고',
};
const INSIDER: DartInsiderReportRecord = {
    rceptNo: '20261015000457',
    receiptDate: '2026-10-15',
    reporter: '박주주',
    position: null,
    registered: null,
    majorShareholder: '10%이상주주',
    shares: 650_000_000,
    sharesChange: 18_000_000,
    ratioPct: 10.89,
    ratioChangePct: 0.3,
};
const PLAN: DartTradingPlanRecord = {
    rceptNo: '20261014000789',
    receiptDate: '2026-10-14',
    reporter: '이임원',
    title: '임원ㆍ주요주주특정증권등거래계획보고서',
};

const BASE = {
    asOf: '2026-10-16',
    majorHoldings: [MAJOR],
    insiderReports: [INSIDER],
    tradingPlans: [PLAN],
    sharesOutstanding: null,
};

describe('dartFilingUrl', () => {
    it('builds the DART viewer link from the receipt number', () => {
        expect(dartFilingUrl('20261015000124')).toBe(
            'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261015000124'
        );
    });
});

describe('toKrMajorHolderReport', () => {
    it('maps the stored row to the core type with the DART link', () => {
        expect(toKrMajorHolderReport(MAJOR)).toEqual({
            receiptDate: '2026-10-15',
            reporter: '픽스처자산운용',
            reportForm: 'abbreviated',
            shares: 301_500_000,
            sharesChange: 301_500_000,
            ratioPct: 5.05,
            ratioChangePct: 5.05,
            reason: '신규 보고',
            url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261015000124',
        });
    });

    it('turns a missing reason into an empty string', () => {
        expect(toKrMajorHolderReport({ ...MAJOR, reason: null })?.reason).toBe(
            ''
        );
    });

    it.each(['shares', 'sharesChange', 'ratioPct', 'ratioChangePct'] as const)(
        'drops the row when %s is missing (never fills a fake zero)',
        field => {
            expect(toKrMajorHolderReport({ ...MAJOR, [field]: null })).toBe(
                null
            );
        }
    );
});

describe('toKrInsiderReport', () => {
    it('reads a blank registration as not registered and a stated relation as major shareholder', () => {
        expect(toKrInsiderReport(INSIDER)).toMatchObject({
            position: null,
            registered: false,
            majorShareholder: true,
            sharesChange: 18_000_000,
            url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261015000457',
        });
    });

    it('keeps a registered executive with no major-shareholder relation', () => {
        expect(
            toKrInsiderReport({
                ...INSIDER,
                position: '대표이사',
                registered: true,
                majorShareholder: null,
            })
        ).toMatchObject({
            position: '대표이사',
            registered: true,
            majorShareholder: false,
        });
    });

    it('drops the row when a quantity is missing', () => {
        expect(toKrInsiderReport({ ...INSIDER, sharesChange: null })).toBe(
            null
        );
    });
});

describe('toKrTradingPlan', () => {
    it('keeps the list row and adds the link', () => {
        expect(toKrTradingPlan(PLAN)).toEqual({
            receiptDate: '2026-10-14',
            reporter: '이임원',
            title: '임원ㆍ주요주주특정증권등거래계획보고서',
            url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261014000789',
        });
    });
});

describe('assembleKrInvestorFlowsSnapshot', () => {
    it('builds a market kr snapshot with the US sources empty or null', () => {
        const { snapshot, droppedRows } = assembleKrInvestorFlowsSnapshot(BASE);
        expect(droppedRows).toBe(0);
        expect(snapshot).toMatchObject({
            asOf: '2026-10-16',
            market: 'kr',
            sharesOutstanding: null,
            floatShares: null,
            institutional: {
                quarters: [],
                topHolders: [],
                topHoldersPeriod: null,
            },
            insider: { transactions: [] },
            largeHolders: null,
            shortInterest: null,
            shortVolume: null,
            failsToDeliver: null,
            thresholdList: null,
        });
        expect(snapshot?.kr?.majorHolders).toHaveLength(1);
        expect(snapshot?.kr?.insiders).toHaveLength(1);
        expect(snapshot?.kr?.tradingPlans).toHaveLength(1);
    });

    it('is scored by core from the DART reports (a new 5% holder fires kr_major_holder_new)', () => {
        const { snapshot } = assembleKrInvestorFlowsSnapshot(BASE);
        expect(snapshot).not.toBeNull();
        const scorecard = evaluateInvestorFlows(snapshot!);
        expect(scorecard.market).toBe('kr');
        expect(scorecard.largeHolders.signals.map(s => s.id)).toContain(
            'kr_major_holder_new'
        );
        expect(scorecard.institutional.sufficiency).toBe('insufficient');
    });

    it("feeds core the change vs the same filer's previous report, so the 5% crossing evidence is +0.19, not the whole holding", () => {
        const { snapshot } = assembleKrInvestorFlowsSnapshot({
            ...BASE,
            majorHoldings: [
                { ...MAJOR, ratioPct: 5.12, ratioChangePct: 5.12 },
                // 직전 보고(창 밖) — 같은 보고자, 4.93%.
                {
                    ...MAJOR,
                    rceptNo: '20260501000001',
                    receiptDate: '2026-05-01',
                    ratioPct: 4.93,
                    ratioChangePct: -0.4,
                },
            ],
        });
        const latest = snapshot!.kr!.majorHolders.find(
            r => r.receiptDate === '2026-10-15'
        );
        expect(latest?.ratioChangePct).toBe(0.19);
        const signal = evaluateInvestorFlows(
            snapshot!
        ).largeHolders.signals.find(s => s.id === 'kr_major_holder_new');
        expect(signal?.evidence).toMatchObject({
            ratioPct: 5.12,
            priorRatioPct: 4.93,
            ratioChangePct: 0.19,
        });
    });

    it('keeps the DART change on an initial report with no previous report so core still sees the 5% crossing', () => {
        const { snapshot } = assembleKrInvestorFlowsSnapshot(BASE);
        expect(snapshot!.kr!.majorHolders[0]?.ratioChangePct).toBe(5.05);
    });

    it('counts rows left out for missing quantities', () => {
        const { snapshot, droppedRows } = assembleKrInvestorFlowsSnapshot({
            ...BASE,
            majorHoldings: [MAJOR, { ...MAJOR, rceptNo: 'x', ratioPct: null }],
            insiderReports: [{ ...INSIDER, shares: null }],
        });
        expect(droppedRows).toBe(2);
        expect(snapshot?.kr?.majorHolders).toHaveLength(1);
        expect(snapshot?.kr?.insiders).toHaveLength(0);
    });

    it('is null when the company has no filings at all (no data, not a neutral score)', () => {
        expect(
            assembleKrInvestorFlowsSnapshot({
                ...BASE,
                majorHoldings: [],
                insiderReports: [],
                tradingPlans: [],
            }).snapshot
        ).toBeNull();
    });

    it('is null when every row lacks quantities and there are no trading plans', () => {
        expect(
            assembleKrInvestorFlowsSnapshot({
                ...BASE,
                majorHoldings: [{ ...MAJOR, shares: null }],
                insiderReports: [],
                tradingPlans: [],
            }).snapshot
        ).toBeNull();
    });
});
