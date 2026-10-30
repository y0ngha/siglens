import { describe, expect, it } from 'vitest';
import type { AmendmentFiling } from '../../lib/amendmentPlan';
import { INVESTOR_FLOWS_13F_MAX_ATTEMPTS } from '../../lib/investorFlowsPolicy';
import {
    cursorStartDate,
    filingSkipReason,
    isFilingSettled,
    isReingestReplaceCandidate,
} from '../../lib/sec13fIngestPlan';
import type { FilingRecord } from '../../model';

describe('filingSkipReason', () => {
    const floor = '2025-09-30';

    it('returns null for a recent quarter-end holdings report', () => {
        expect(
            filingSkipReason('2026-06-30', '13F HOLDINGS REPORT', floor)
        ).toBeNull();
    });

    it('flags a period that is not a quarter end', () => {
        expect(
            filingSkipReason('2026-07-15', '13F HOLDINGS REPORT', floor)
        ).toBe('non-quarter-period');
    });

    it('flags quarters reported in thousands of dollars', () => {
        expect(
            filingSkipReason('2022-12-31', '13F HOLDINGS REPORT', floor)
        ).toBe('legacy-value-units');
    });

    it('flags quarters older than the retention floor', () => {
        expect(
            filingSkipReason('2025-06-30', '13F HOLDINGS REPORT', floor)
        ).toBe('before-retention');
    });

    it('does not flag the first dollar-valued period when it is still retained', () => {
        expect(
            filingSkipReason('2023-03-31', '13F HOLDINGS REPORT', '2023-03-31')
        ).toBeNull();
    });

    it('flags a notice regardless of letter case', () => {
        expect(filingSkipReason('2026-06-30', '13F notice', floor)).toBe(
            'notice'
        );
    });

    it('accepts a missing report type', () => {
        expect(filingSkipReason('2026-06-30', null, floor)).toBeNull();
    });

    it('prefers the earlier reason when several apply', () => {
        expect(filingSkipReason('2022-12-31', '13F NOTICE', floor)).toBe(
            'legacy-value-units'
        );
    });
});

describe('cursorStartDate', () => {
    it('starts at the backfill start when the ledger is empty', () => {
        expect(cursorStartDate(null, '2026-03-28')).toBe('2026-03-28');
    });

    it('steps back by the overlap from the last filing date', () => {
        expect(cursorStartDate('2026-10-14', '2026-03-28')).toBe('2026-10-11');
    });

    it('never goes back past the backfill start', () => {
        expect(cursorStartDate('2026-03-29', '2026-03-28')).toBe('2026-03-28');
    });
});

describe('isFilingSettled', () => {
    const record = (over: Partial<FilingRecord>): FilingRecord => ({
        accession: '0000000001-26-000001',
        cik: '0000000001',
        period: '2026-06-30',
        filingDate: '2026-08-01',
        submissionType: '13F-HR',
        amendmentType: null,
        attempts: 0,
        processedAt: null,
        ...over,
    });

    it('is false for an unknown accession', () => {
        expect(isFilingSettled(undefined)).toBe(false);
    });

    it('is true once the filing has been processed', () => {
        expect(isFilingSettled(record({ processedAt: new Date() }))).toBe(true);
    });

    it('is true when the attempts are exhausted', () => {
        expect(
            isFilingSettled(
                record({ attempts: INVESTOR_FLOWS_13F_MAX_ATTEMPTS })
            )
        ).toBe(true);
    });

    it('is false for an unprocessed filing with attempts left', () => {
        expect(
            isFilingSettled(
                record({ attempts: INVESTOR_FLOWS_13F_MAX_ATTEMPTS - 1 })
            )
        ).toBe(false);
    });
});

describe('isReingestReplaceCandidate', () => {
    const processed: AmendmentFiling = {
        accession: '0000000001-26-000009',
        filingDate: '2026-08-01',
        submissionType: '13F-HR',
        amendmentType: null,
    };

    it('is true for a replace of an original 13F-HR with an empty ledger', () => {
        expect(isReingestReplaceCandidate('replace', '13F-HR', [])).toBe(true);
    });

    it('is false for merge and skip', () => {
        expect(isReingestReplaceCandidate('merge', '13F-HR', [])).toBe(false);
        expect(isReingestReplaceCandidate('skip', '13F-HR', [])).toBe(false);
    });

    it('is false for an amendment form', () => {
        expect(isReingestReplaceCandidate('replace', '13F-HR/A', [])).toBe(
            false
        );
    });

    it('is false once the ledger holds a processed filing', () => {
        expect(
            isReingestReplaceCandidate('replace', '13F-HR', [processed])
        ).toBe(false);
    });
});
