import { describe, expect, it } from 'vitest';
import {
    planPositionApplication,
    type AmendmentFiling,
} from '../../lib/amendmentPlan';

const original = (over: Partial<AmendmentFiling> = {}): AmendmentFiling => ({
    accession: '0000000001-26-000001',
    filingDate: '2026-08-01',
    submissionType: '13F-HR',
    amendmentType: null,
    ...over,
});
const restatement = (over: Partial<AmendmentFiling> = {}): AmendmentFiling =>
    original({
        accession: '0000000001-26-000002',
        filingDate: '2026-08-10',
        submissionType: '13F-HR/A',
        amendmentType: 'RESTATEMENT',
        ...over,
    });
const newHoldings = (over: Partial<AmendmentFiling> = {}): AmendmentFiling =>
    restatement({
        accession: '0000000001-26-000003',
        amendmentType: 'NEW HOLDINGS',
        ...over,
    });

describe('planPositionApplication', () => {
    describe('original 13F-HR', () => {
        it('replaces (fills) when nothing was applied before', () => {
            expect(planPositionApplication(original(), [])).toBe('replace');
        });

        it('merges when another filing for the same (cik, period) is already applied', () => {
            expect(
                planPositionApplication(original(), [
                    newHoldings({ filingDate: '2026-07-01' }),
                ])
            ).toBe('merge');
        });

        it('is skipped when a later RESTATEMENT is already applied', () => {
            expect(planPositionApplication(original(), [restatement()])).toBe(
                'skip'
            );
        });
    });

    describe('RESTATEMENT', () => {
        it('replaces the positions', () => {
            expect(planPositionApplication(restatement(), [original()])).toBe(
                'replace'
            );
        });

        it('loses to a later RESTATEMENT (the later one wins)', () => {
            const later = restatement({
                accession: '0000000001-26-000009',
                filingDate: '2026-09-01',
            });
            expect(planPositionApplication(restatement(), [later])).toBe(
                'skip'
            );
        });

        it('wins over an earlier RESTATEMENT', () => {
            const earlier = restatement({
                accession: '0000000001-26-000000',
                filingDate: '2026-08-05',
            });
            expect(planPositionApplication(restatement(), [earlier])).toBe(
                'replace'
            );
        });

        it('breaks a same-day tie by accession order', () => {
            const sameDayLater = restatement({
                accession: '0000000001-26-000099',
            });
            expect(planPositionApplication(restatement(), [sameDayLater])).toBe(
                'skip'
            );
        });
    });

    describe('NEW HOLDINGS', () => {
        it('merges (adds) into the existing positions', () => {
            expect(planPositionApplication(newHoldings(), [original()])).toBe(
                'merge'
            );
        });

        it('is superseded by a later RESTATEMENT', () => {
            const later = restatement({
                accession: '0000000001-26-000009',
                filingDate: '2026-09-01',
            });
            expect(
                planPositionApplication(newHoldings(), [original(), later])
            ).toBe('skip');
        });

        it('still merges after an earlier RESTATEMENT', () => {
            const earlier = restatement({
                filingDate: '2026-08-05',
                accession: '0000000001-26-000000',
            });
            expect(planPositionApplication(newHoldings(), [earlier])).toBe(
                'merge'
            );
        });
    });

    describe('amendment without a known type', () => {
        it('is treated as non-destructive NEW HOLDINGS (merge), never as a replace', () => {
            const unknown = restatement({ amendmentType: null });
            expect(planPositionApplication(unknown, [original()])).toBe(
                'merge'
            );
        });

        it('an existing unknown-type amendment does not block later filings', () => {
            const unknownExisting = restatement({
                amendmentType: null,
                filingDate: '2026-09-01',
            });
            expect(planPositionApplication(original(), [unknownExisting])).toBe(
                'merge'
            );
        });
    });

    it('does not count the incoming accession itself as an earlier filing (retry of the same accession)', () => {
        const self = original();
        expect(planPositionApplication(self, [self])).toBe('replace');
    });
});
