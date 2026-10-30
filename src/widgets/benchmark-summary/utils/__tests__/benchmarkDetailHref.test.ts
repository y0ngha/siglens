import { describe, expect, it } from 'vitest';
import { buildBenchmarkDetailHref } from '../benchmarkDetailHref';

const AI_SITE = 'https://ai.test';

describe('buildBenchmarkDetailHref', () => {
    it('points the default locale at the unprefixed ai-host path', () => {
        expect(buildBenchmarkDetailHref(AI_SITE, 'ko')).toBe(
            'https://ai.test/benchmark'
        );
    });

    it('keeps the locale prefix for other locales', () => {
        expect(buildBenchmarkDetailHref(AI_SITE, 'ja')).toBe(
            'https://ai.test/ja/benchmark'
        );
    });
});
