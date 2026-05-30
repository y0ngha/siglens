import { describe, it, expect, afterEach } from 'vitest';
import {
    isE2E,
    e2eCachedTechnical,
    e2eCachedOverall,
    e2eCachedFundamental,
    e2eCachedNews,
    e2eCachedOptions,
    e2eForcedOptionsError,
} from '@/shared/api/e2eAnalysisStub';

describe('isE2E', () => {
    const originalE2E = process.env.E2E_TEST;

    afterEach(() => {
        if (originalE2E === undefined) {
            delete process.env.E2E_TEST;
        } else {
            process.env.E2E_TEST = originalE2E;
        }
    });

    it('returns true when E2E_TEST=1', () => {
        process.env.E2E_TEST = '1';
        expect(isE2E()).toBe(true);
    });

    it('returns false when E2E_TEST is unset', () => {
        delete process.env.E2E_TEST;
        expect(isE2E()).toBe(false);
    });

    it('returns false when E2E_TEST is a non-"1" value', () => {
        process.env.E2E_TEST = 'true';
        expect(isE2E()).toBe(false);
    });
});

describe('e2eCached* fixture getters', () => {
    it('e2eCachedTechnical returns a cached technical result', () => {
        const result = e2eCachedTechnical();
        expect(result.status).toBe('cached');
        if (result.status !== 'cached') throw new Error('unreachable');
        // technical AnalysisResponse anchor fields the E2E specs assert on.
        expect(result.result.summary).toContain('E2E 고정 분석 결과');
        expect(result.result.trend).toBe('neutral');
    });

    it('e2eCachedOverall returns a cached overall result', () => {
        const result = e2eCachedOverall();
        expect(result.status).toBe('cached');
        expect(result.result.headlineKo).toContain('E2E 고정 분석 결과');
    });

    it('e2eCachedFundamental returns a cached fundamental result', () => {
        const result = e2eCachedFundamental();
        expect(result.status).toBe('cached');
        if (result.status !== 'cached') throw new Error('unreachable');
        // fundamental FundamentalAnalysisResponse anchor fields.
        expect(result.result.overallConclusionKo).toContain(
            'E2E 고정 분석 결과'
        );
        expect(result.result.overallSentiment).toBe('neutral');
    });

    it('e2eCachedNews returns a cached news result', () => {
        const result = e2eCachedNews();
        expect(result.status).toBe('cached');
        if (result.status !== 'cached') throw new Error('unreachable');
        // news NewsAnalysisResponse anchor fields.
        expect(result.result.currentDriverKo).toContain('E2E 고정 분석 결과');
        expect(result.result.overallSentiment).toBe('neutral');
    });

    it('e2eCachedOptions returns a cached options result', () => {
        const result = e2eCachedOptions();
        expect(result.status).toBe('cached');
        if (result.status !== 'cached') throw new Error('unreachable');
        // options OptionsAnalysisResponse anchor field.
        expect(result.result.summary).toContain('E2E 고정 분석 결과');
    });

    it('returns a stable fixture reference across calls (no per-call rebuild)', () => {
        const a = e2eCachedTechnical();
        const b = e2eCachedTechnical();
        if (a.status !== 'cached' || b.status !== 'cached') {
            throw new Error('unreachable: stub always returns cached');
        }
        expect(a.result).toBe(b.result);
    });
});

describe('e2eForcedOptionsError (resilience seam)', () => {
    it('returns a no_chains_error result that drives the options error boundary', () => {
        const result = e2eForcedOptionsError();
        // useOptionsAnalysis throws on this status → OptionsAiAnalysisError ("다시 시도").
        expect(result.status).toBe('no_chains_error');
        expect(result.code).toBe('no_options_chains');
        expect(result.error).toBe('E2E 강제 분석 실패 (resilience 테스트용)');
    });
});
