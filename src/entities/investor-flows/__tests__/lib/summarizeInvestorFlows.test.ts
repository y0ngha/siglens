import { describe, expect, it } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import {
    summarizeInvestorFlows,
    SUMMARY_MAX_INSIDER_TRANSACTIONS,
    SUMMARY_MAX_QUARTERS,
    SUMMARY_MAX_SIGNALS,
    SUMMARY_MAX_TOP_HOLDERS,
} from '../../lib/summarizeInvestorFlows';
import {
    makeHolder,
    makeSnapshot,
    makeTransaction,
    evaluate,
} from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';

describe('summarizeInvestorFlows', () => {
    it('점수표의 종합·축 라벨을 그대로 옮긴다(재계산 없음)', () => {
        const snapshot = makeSnapshot();
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(out.composite).toEqual(card.composite);
        expect(out.axes.institutional).toEqual({
            label: card.institutional.label,
            score: card.institutional.score,
            sufficiency: card.institutional.sufficiency,
        });
        expect(out.freshness).toEqual(card.freshness);
    });

    it('최신 분기 2개만, IN/OUT 방향 라벨과 함께 낸다', () => {
        const out = summarizeInvestorFlows(
            makeSnapshot(),
            evaluate(makeSnapshot())
        );
        expect(out.institutional.quarters).toHaveLength(SUMMARY_MAX_QUARTERS);
        expect(out.institutional.quarters[0].period).toBe('2026-09-30');
        expect(out.institutional.quarters[0].netFlow).toBe('IN');
    });

    it('상위 보유 기관·내부자 거래·신호를 상한으로 자른다', () => {
        const snapshot = makeSnapshot({
            institutional: {
                quarters: makeSnapshot().institutional.quarters,
                topHolders: Array.from({ length: 30 }, (_, i) =>
                    makeHolder({ cik: String(i), filerName: `H${i}` })
                ),
                topHoldersPeriod: '2026-06-30',
            },
            insider: {
                transactions: Array.from({ length: 40 }, (_, i) =>
                    makeTransaction({
                        date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
                    })
                ),
            },
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.institutional.topHolders).toHaveLength(
            SUMMARY_MAX_TOP_HOLDERS
        );
        expect(out.insider.recentTransactions).toHaveLength(
            SUMMARY_MAX_INSIDER_TRANSACTIONS
        );
        expect(out.signals.length).toBeLessThanOrEqual(SUMMARY_MAX_SIGNALS);
    });

    it('긴 이름은 잘라 컨텍스트를 지킨다', () => {
        const snapshot = makeSnapshot({
            institutional: {
                quarters: makeSnapshot().institutional.quarters,
                topHolders: [makeHolder({ filerName: 'X'.repeat(200) })],
                topHoldersPeriod: '2026-06-30',
            },
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.institutional.topHolders[0].name.length).toBeLessThanOrEqual(
            26
        );
    });

    it('FINRA 꺼짐(null)이면 short 블록이 null이다', () => {
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        const out = summarizeInvestorFlows(
            snapshot,
            evaluateInvestorFlows(snapshot, { includeFinraData: false })
        );
        expect(out.short).toBeNull();
        expect(out.axes.short.sufficiency).toBe('insufficient');
    });

    it('FINRA 켜짐이면 최신 잔고와 공매도 비율을 점수표(core) 값 그대로 낸다', () => {
        const snapshot = makeSnapshot();
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(out.short?.interest).toEqual({
            settlementDate: '2026-09-15',
            shortQty: 128_000_000,
            pctOfFloat: card.short.metrics.shortInterestPctFloat,
            daysToCover: card.short.metrics.daysToCover,
            changeVsPrevious: {
                previousDate: '2026-08-15',
                sharesChange: 6_000_000,
                pct: (6_000_000 / 122_000_000) * 100,
            },
            recentChangePct: card.short.metrics.shortInterestChangePct,
            trend: card.short.metrics.shortInterestTrend,
        });
        expect(out.short?.interest?.pctOfFloat).toBe(0.86);
        expect(out.short?.offExchangeVolume?.shortRatio).toBe(
            card.short.metrics.shortVolumeRatio
        );
        expect(out.short?.note).toMatch(/off-exchange/);
    });

    it('13D/G 조회 실패(null)는 []로 위장하지 않고 null로 전달한다', () => {
        const snapshot = makeSnapshot({ largeHolders: null });
        expect(
            summarizeInvestorFlows(snapshot, evaluate(snapshot)).largeHolders
        ).toBeNull();
    });

    it('빈 스냅샷도 던지지 않는다(전 축 insufficient)', () => {
        const snapshot = makeSnapshot({
            institutional: {
                quarters: [],
                topHolders: [],
                topHoldersPeriod: null,
            },
            insider: { transactions: [] },
            largeHolders: [],
            shortInterest: [],
            shortVolume: [],
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.institutional.quarters).toEqual([]);
        expect(out.signals.filter(s => s.id !== 'data_stale')).toEqual([]);
    });
});
