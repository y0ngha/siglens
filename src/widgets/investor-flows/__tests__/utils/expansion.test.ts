import { describe, expect, it } from 'vitest';
import { FTD_LOOKBACK_DAYS } from '@/entities/investor-flows/lib/snapshot/short';
import { buildAxisEvidence } from '../../utils/axisEvidence';
import { buildFailsToDeliverSeries } from '../../utils/failsToDeliver';
import { buildOptionsRows, OPTIONS_QUARTERS_SHOWN } from '../../utils/options';
import {
    buildOfferingRows,
    buildProposedSaleRows,
    MAX_OFFERING_ROWS,
    MAX_PROPOSED_SALE_ROWS,
    OFFERING_TONE,
} from '../../utils/secFilings';
import { formatComponentValue } from '../../utils/squeeze';
import {
    evaluate,
    makeEmptySnapshot,
    makeExpandedSnapshot,
    makeFailsToDeliver,
    makeOffering,
    makeOptionsQuarter,
    makeProposedSale,
    makeThresholdList,
} from '../fixtures/flowsFixtures';

describe('buildFailsToDeliverSeries', () => {
    it('sorts settlement dates oldest first and exposes the latest row and the max', () => {
        const series = buildFailsToDeliverSeries(
            makeFailsToDeliver().toReversed()
        );
        expect(series.rows.map(r => r.settlementDate)).toEqual([
            '2026-08-28',
            '2026-09-10',
            '2026-09-18',
            '2026-09-24',
            '2026-09-30',
        ]);
        expect(series.latest?.settlementDate).toBe('2026-09-30');
        expect(series.maxQty).toBe(4_200_000);
        expect(series.windowDays).toBe(FTD_LOOKBACK_DAYS);
    });

    it('has no latest row and a zero max when there were no fails', () => {
        const series = buildFailsToDeliverSeries([]);
        expect(series.latest).toBeNull();
        expect(series.maxQty).toBe(0);
    });
});

describe('buildOptionsRows', () => {
    it('lists the newest quarters first, up to OPTIONS_QUARTERS_SHOWN', () => {
        const quarters = [
            '2025-06-30',
            '2025-09-30',
            '2025-12-31',
            '2026-03-31',
            '2026-06-30',
        ].map(period => makeOptionsQuarter({ period }));
        const rows = buildOptionsRows(quarters);
        expect(rows).toHaveLength(OPTIONS_QUARTERS_SHOWN);
        expect(rows[0].period).toBe('2026-06-30');
    });

    it('drops a quarter with neither puts nor calls (no report is not "$0")', () => {
        expect(
            buildOptionsRows([
                makeOptionsQuarter({ putValueUsd: 0, callValueUsd: 0 }),
            ])
        ).toEqual([]);
    });
});

describe('SEC filing rows', () => {
    it('Form 144: newest first, capped, with the omitted count', () => {
        const sales = Array.from(
            { length: MAX_PROPOSED_SALE_ROWS + 2 },
            (_, i) =>
                makeProposedSale({
                    filingDate: `2026-09-${String(i + 1).padStart(2, '0')}`,
                })
        );
        const { rows, omittedCount } = buildProposedSaleRows(sales);
        expect(rows).toHaveLength(MAX_PROPOSED_SALE_ROWS);
        expect(rows[0].filingDate).toBe('2026-09-12');
        expect(omittedCount).toBe(2);
    });

    it('offerings: newest first, capped, with the omitted count', () => {
        const filings = Array.from({ length: MAX_OFFERING_ROWS + 1 }, (_, i) =>
            makeOffering({
                filingDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
            })
        );
        const { rows, omittedCount } = buildOfferingRows(filings);
        expect(rows).toHaveLength(MAX_OFFERING_ROWS);
        expect(rows[0].filingDate).toBe('2026-08-11');
        expect(omittedCount).toBe(1);
    });

    it('marks only actual issuance kinds (ATM, underwritten, best efforts) with the issuance tone', () => {
        expect(
            Object.entries(OFFERING_TONE)
                .filter(([, tone]) => tone === 'issuance')
                .map(([kind]) => kind)
                .sort()
        ).toEqual(['atm', 'best_efforts', 'underwritten']);
    });
});

describe('formatComponentValue', () => {
    it.each([
        ['short_interest_pct_float', 19.5, 'percent', '19.50%'],
        ['price_change_20d', 12.34, 'signedPercent', '+12.3%'],
        ['days_to_cover', 7.04, 'days', '7.0'],
        ['off_exchange_short_ratio_z', 2.46, 'z', '2.5'],
        ['volume_ratio', 3, 'multiple', '3.0'],
        ['threshold_list_days', 15, 'tradingDays', '15'],
        ['threshold_list_days', 0, 'notListed', ''],
    ] as const)(
        '%s keeps the core value in its own unit',
        (id, value, unit, text) => {
            expect(formatComponentValue(id, value, 'en')).toEqual({
                unit,
                value: text,
            });
        }
    );
});

describe('buildAxisEvidence — expansion lines', () => {
    it('dilution: filings in the window and the issuance split come from core metrics', () => {
        const card = evaluate(makeExpandedSnapshot());
        const lines = buildAxisEvidence(card, 'dilution', 'en');
        expect(lines[0]).toEqual({
            id: 'dilutionFilings',
            values: {
                count: String(card.dilution.metrics?.filingsInWindow),
                days: String(card.freshness.dilutionWindow.days),
            },
        });
        expect(lines.map(l => l.id)).toContain('dilutionIssuance');
    });

    it('dilution: no lines when the axis is insufficient', () => {
        expect(
            buildAxisEvidence(evaluate(makeEmptySnapshot()), 'dilution', 'en')
        ).toEqual([]);
    });

    it('insider: adds the Form 144 count and value', () => {
        const card = evaluate(makeExpandedSnapshot());
        const line = buildAxisEvidence(card, 'insider', 'en').find(
            l => l.id === 'insiderProposedSales'
        );
        expect(line?.values.count).toBe(
            String(card.insider.metrics?.proposedSaleCount)
        );
    });

    it('institutional: adds the 13F put/call ratio when core has one', () => {
        const card = evaluate(makeExpandedSnapshot());
        expect(card.institutional.metrics.putCallValueRatio).not.toBeNull();
        expect(
            buildAxisEvidence(card, 'institutional', 'en').map(l => l.id)
        ).toContain('putCallRatio');
    });

    it('short: adds the threshold streak only while listed', () => {
        const listed = evaluate(
            makeExpandedSnapshot({ thresholdList: makeThresholdList() })
        );
        expect(
            buildAxisEvidence(listed, 'short', 'en').find(
                l => l.id === 'thresholdListed'
            )?.values.days
        ).toBe('15');
        const notListed = evaluate(makeExpandedSnapshot());
        expect(
            buildAxisEvidence(notListed, 'short', 'en').map(l => l.id)
        ).not.toContain('thresholdListed');
    });
});
