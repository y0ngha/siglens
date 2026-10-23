import { describe, expect, it } from 'vitest';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import { buildSummaryHeadline } from '../buildSummaryHeadline';

describe('buildSummaryHeadline', () => {
    it('is null when there is no subject to compare', () => {
        expect(
            buildSummaryHeadline({
                ...BENCHMARK_FIXTURE,
                targets: BENCHMARK_FIXTURE.targets.filter(
                    t => t.id !== 'siglens'
                ),
            })
        ).toBeNull();
    });

    it('shows every non-baseline competitor, however many there are', () => {
        const extra = Array.from({ length: 5 }, (_, i) => ({
            ...BENCHMARK_FIXTURE.headline[0]!,
            target: `x${i}`,
        }));
        const headline = buildSummaryHeadline({
            ...BENCHMARK_FIXTURE,
            targets: [
                ...BENCHMARK_FIXTURE.targets,
                ...extra.map((c, i) => ({
                    id: c.target,
                    label: `X${i}`,
                    model: 'm',
                    isBaseline: false,
                })),
            ],
            headline: [...BENCHMARK_FIXTURE.headline, ...extra],
        });
        expect(headline!.competitors).toHaveLength(2 + extra.length);
        expect(headline!.competitors.map(c => c.target.id)).not.toContain(
            'deepseek'
        );
    });
});
