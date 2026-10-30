import { describe, expect, it } from 'vitest';
import { BENCHMARK_PUBLISHED } from '@/shared/config/benchmark';
import { AI_INDEXABLE_PATHS } from '@/shared/config/aiHost';
import { BENCHMARK_RELEASE } from '../release';

describe('benchmark publication gate', () => {
    it('BENCHMARK_PUBLISHED mirrors whether a release is wired in', () => {
        expect(BENCHMARK_PUBLISHED).toBe(BENCHMARK_RELEASE !== null);
    });

    it('lists /benchmark in the ai sitemap paths only while published', () => {
        expect(AI_INDEXABLE_PATHS.includes('/benchmark')).toBe(
            BENCHMARK_PUBLISHED
        );
    });
});
