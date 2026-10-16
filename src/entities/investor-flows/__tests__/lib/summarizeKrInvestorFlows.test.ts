import { describe, expect, it } from 'vitest';
import {
    KR_SUMMARY_MAX_TRADING_PLANS,
    summarizeKrInvestorFlows,
} from '../../lib/summarizeKrInvestorFlows';
import {
    evaluate,
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
    makeKrTradingPlanRecord,
} from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';

describe('summarizeKrInvestorFlows', () => {
    it('copies the core scorecard (axes, krMetrics, latest receipt date) without recomputing', () => {
        const snapshot = makeKrSnapshot();
        const scorecard = evaluate(snapshot);
        const summary = summarizeKrInvestorFlows(snapshot, scorecard);
        expect(summary.composite).toBe(scorecard.composite);
        expect(summary.axes.short).toEqual({
            label: 'insufficient',
            score: null,
            sufficiency: 'insufficient',
        });
        expect(summary.majorHolders.metrics).toEqual(
            scorecard.largeHolders.krMetrics
        );
        expect(summary.insiders.metrics).toEqual(scorecard.insider.krMetrics);
        expect(summary.freshness).toEqual({
            asOf: '2026-10-16',
            windowDays: scorecard.freshness.insiderWindow.days,
            latestReceiptDate: '2026-10-14',
        });
    });

    it('sorts each list newest first and keeps the insider flags', () => {
        const snapshot = makeKrSnapshot();
        const summary = summarizeKrInvestorFlows(snapshot, evaluate(snapshot));
        expect(summary.majorHolders.recent.map(r => r.receiptDate)).toEqual([
            '2026-10-14',
            '2026-10-10',
        ]);
        expect(
            summary.insiders.recent.find(r => r.reporter === '박주주')
        ).toMatchObject({
            position: null,
            registered: false,
            majorShareholder: true,
        });
    });

    it('caps the trading plans and clips long titles', () => {
        const snapshot = makeKrSnapshot({
            tradingPlans: Array.from({ length: 8 }, (_, i) =>
                makeKrTradingPlanRecord({
                    rceptNo: `2026101200${String(i).padStart(4, '0')}`,
                    title: '가'.repeat(80),
                })
            ),
        });
        const summary = summarizeKrInvestorFlows(snapshot, evaluate(snapshot));
        expect(summary.tradingPlans).toHaveLength(KR_SUMMARY_MAX_TRADING_PLANS);
        expect(summary.tradingPlans[0]?.title.endsWith('…')).toBe(true);
        expect(summary.tradingPlans[0]?.title.length).toBeLessThan(80);
    });

    it('flattens newlines and runs of spaces in reporter names and reasons (same rule as the US summary)', () => {
        const snapshot = makeKrSnapshot({
            majorHoldings: [
                makeKrMajorHoldingRecord({
                    reporter: '픽스처\n자산운용   주식회사',
                    reason: '  보유주식등의\n수 변동 ',
                }),
            ],
        });
        const [row] = summarizeKrInvestorFlows(snapshot, evaluate(snapshot))
            .majorHolders.recent;
        expect(row?.reporter).toBe('픽스처 자산운용 주식회사');
        expect(row?.reason).toBe('보유주식등의 수 변동');
    });

    it('keeps core precision for the insider net change percentage', () => {
        const snapshot = makeKrSnapshot();
        const scorecard = evaluate(snapshot);
        expect(
            summarizeKrInvestorFlows(snapshot, scorecard).insiders.metrics
                ?.netChangePct
        ).toBe(scorecard.insider.krMetrics?.netChangePct);
    });

    it('keeps each signal subject so two signals with the same id stay distinguishable', () => {
        const snapshot = makeKrSnapshot({
            majorHoldings: [
                makeKrMajorHoldingRecord({ reporter: '첫째\n운용' }),
                makeKrMajorHoldingRecord({
                    rceptNo: '20261013000125',
                    reporter: '둘째운용',
                }),
            ],
        });
        const summary = summarizeKrInvestorFlows(snapshot, evaluate(snapshot));
        const news = summary.signals.filter(
            s => s.id === 'kr_major_holder_new'
        );
        expect(news.map(s => s.subject).toSorted()).toEqual([
            '둘째운용',
            '첫째 운용',
        ]);
    });

    it('treats a snapshot without the kr block as empty lists', () => {
        const snapshot = { ...makeKrSnapshot(), kr: undefined };
        const summary = summarizeKrInvestorFlows(snapshot, evaluate(snapshot));
        expect(summary.majorHolders.recent).toEqual([]);
        expect(summary.tradingPlans).toEqual([]);
    });
});
