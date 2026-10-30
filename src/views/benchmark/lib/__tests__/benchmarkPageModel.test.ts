import { describe, expect, it } from 'vitest';
import { BENCHMARK_SIGNIFICANCE_LEVEL } from '@/entities/benchmark/lib/benchmarkHeadline';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import {
    buildBenchmarkPageModel,
    formatBenchmarkPoolSummary,
} from '../benchmarkPageModel';

describe('buildBenchmarkPageModel', () => {
    it('renames only the subject in the release it returns', () => {
        const { release } = buildBenchmarkPageModel(BENCHMARK_FIXTURE, 'Brand');
        expect(release.targets.map(target => target.label)).toEqual([
            'Brand',
            'BetaGPT',
            'GammaGem',
            'DeltaBase',
        ]);
    });

    it('fills the summary from the headline counts under the new subject name', () => {
        const { headline } = buildBenchmarkPageModel(
            BENCHMARK_FIXTURE,
            'Brand'
        );
        expect(headline?.summary).toEqual({
            subject: 'Brand',
            count: 2,
            ahead: 1,
            tie: 1,
            behind: 0,
        });
        expect(headline?.significanceLevel).toBe(BENCHMARK_SIGNIFICANCE_LEVEL);
    });

    it('formats each comparison row and keeps competitors and baselines apart', () => {
        const { headline } = buildBenchmarkPageModel(
            BENCHMARK_FIXTURE,
            'Brand'
        );
        expect(headline?.groups.map(group => group.key)).toEqual([
            'competitors',
            'baselines',
        ]);
        expect(headline?.groups[0]?.rows[0]).toEqual({
            id: 'gpt',
            label: 'BetaGPT',
            diffText: '+0.123',
            ciText: '[+0.051, +0.198]',
            pText: '0.004',
            n: 40,
            verdict: 'ahead',
        });
        expect(headline?.groups[1]?.rows.map(row => row.verdict)).toEqual([
            'untested',
        ]);
    });

    it('drops a comparison group that has no rows', () => {
        const { headline } = buildBenchmarkPageModel(
            {
                ...BENCHMARK_FIXTURE,
                headline: BENCHMARK_FIXTURE.headline.filter(
                    contrast => contrast.target !== 'deepseek'
                ),
            },
            'Brand'
        );
        expect(headline?.groups.map(group => group.key)).toEqual([
            'competitors',
        ]);
    });

    it('has no headline when the subject is missing from the data', () => {
        const { headline } = buildBenchmarkPageModel(
            {
                ...BENCHMARK_FIXTURE,
                targets: BENCHMARK_FIXTURE.targets.filter(
                    target => target.id !== 'siglens'
                ),
            },
            'Brand'
        );
        expect(headline).toBeNull();
    });
});

describe('formatBenchmarkPoolSummary', () => {
    const POOLS = { primary: 1190, aux: 16, L5: 30 };

    it('joins pools with the Korean list conjunction', () => {
        expect(formatBenchmarkPoolSummary(POOLS, 'ko')).toBe(
            'primary 1,190, aux 16 및 L5 30'
        );
    });

    it('joins pools with the English list conjunction', () => {
        expect(formatBenchmarkPoolSummary(POOLS, 'en')).toBe(
            'primary 1,190, aux 16, and L5 30'
        );
    });

    it('uses the ideographic enumeration comma in Japanese', () => {
        expect(formatBenchmarkPoolSummary(POOLS, 'ja')).toBe(
            'primary 1,190、aux 16、L5 30'
        );
    });

    it('uses the ideographic enumeration comma in Chinese', () => {
        expect(formatBenchmarkPoolSummary(POOLS, 'zh')).toBe(
            'primary 1,190、aux 16和L5 30'
        );
    });

    it('is a single entry for a single pool', () => {
        expect(formatBenchmarkPoolSummary({ A: 3 }, 'en')).toBe('A 3');
    });
});
