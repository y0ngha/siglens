import { describe, expect, it } from 'vitest';
import type { FmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import {
    classifyProfile,
    isBlanketOutage,
    isTransientOutageChunk,
    mappingKey,
} from '../../lib/cusipMapPlan';
import {
    INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO,
    INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS,
} from '../../lib/investorFlowsPolicy';

const profile = (
    over: Partial<FmpProfileIdentifiers> = {}
): FmpProfileIdentifiers => ({
    cusip: null,
    isin: null,
    isEtf: false,
    isFund: false,
    ...over,
});

describe('mappingKey', () => {
    it('joins the CUSIP and symbol', () => {
        expect(mappingKey({ cusip: '037833100', symbol: 'AAPL' })).toBe(
            '037833100|AAPL'
        );
    });
});

describe('classifyProfile', () => {
    it('misses a missing profile', () => {
        expect(classifyProfile(null)).toEqual({
            kind: 'miss',
            reason: 'noProfile',
        });
    });

    it('misses an ETF and a fund as not common stock', () => {
        expect(classifyProfile(profile({ isEtf: true }))).toEqual({
            kind: 'miss',
            reason: 'notCommonStock',
        });
        expect(classifyProfile(profile({ isFund: true }))).toEqual({
            kind: 'miss',
            reason: 'notCommonStock',
        });
    });

    it('prefers the FMP CUSIP over the ISIN', () => {
        expect(
            classifyProfile(
                profile({ cusip: '594918104', isin: 'US0378331005' })
            )
        ).toEqual({ kind: 'fmp', cusip: '594918104' });
    });

    it('derives a CUSIP from the ISIN for OpenFIGI verification', () => {
        expect(classifyProfile(profile({ isin: 'US0378331005' }))).toEqual({
            kind: 'figi',
            cusip: '037833100',
        });
    });

    it('misses a profile with neither a CUSIP nor a usable ISIN', () => {
        expect(classifyProfile(profile({ isin: 'GB0002634946' }))).toEqual({
            kind: 'miss',
            reason: 'noCusip',
        });
    });
});

describe('isTransientOutageChunk', () => {
    const errors = {
        isRateLimitError: (e: unknown) => e === 'rate',
        isTransientError: (e: unknown) => e === 'rate' || e === 'boom',
    };
    const rejected = (reason: unknown): PromiseRejectedResult => ({
        status: 'rejected',
        reason,
    });
    const fulfilled: PromiseFulfilledResult<unknown> = {
        status: 'fulfilled',
        value: null,
    };

    it('is true when every call failed with a transient error', () => {
        expect(
            isTransientOutageChunk([rejected('boom'), rejected('boom')], errors)
        ).toBe(true);
    });

    it('is false for an empty chunk', () => {
        expect(isTransientOutageChunk([], errors)).toBe(false);
    });

    it('is false when any call succeeded', () => {
        expect(
            isTransientOutageChunk([rejected('boom'), fulfilled], errors)
        ).toBe(false);
    });

    it('is false when a rate limit is among the failures', () => {
        expect(
            isTransientOutageChunk([rejected('boom'), rejected('rate')], errors)
        ).toBe(false);
    });

    it('is false for a non-transient failure', () => {
        expect(isTransientOutageChunk([rejected('other')], errors)).toBe(false);
    });
});

describe('isBlanketOutage', () => {
    it('needs the minimum number of attempts', () => {
        const attempts = INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS - 1;
        expect(isBlanketOutage(attempts, attempts)).toBe(false);
    });

    it('is true when nearly all of enough attempts failed', () => {
        const attempts = INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS;
        expect(
            isBlanketOutage(
                attempts,
                Math.ceil(attempts * INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO)
            )
        ).toBe(true);
    });

    it('is false when the failure ratio is below the threshold', () => {
        const attempts = 100;
        expect(
            isBlanketOutage(
                attempts,
                attempts * INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO - 1
            )
        ).toBe(false);
    });
});
