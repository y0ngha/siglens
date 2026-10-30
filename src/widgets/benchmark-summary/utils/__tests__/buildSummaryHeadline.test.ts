import { describe, expect, it } from 'vitest';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import { BENCHMARK_EMPTY_CELL } from '@/shared/lib/benchmarkFormat';
import { buildSummaryHeadline } from '../buildSummaryHeadline';

const BRAND = 'Brand AI';

describe('buildSummaryHeadline', () => {
    it('is null when there is no subject to compare', () => {
        expect(
            buildSummaryHeadline(
                {
                    ...BENCHMARK_FIXTURE,
                    targets: BENCHMARK_FIXTURE.targets.filter(
                        t => t.id !== 'siglens'
                    ),
                },
                BRAND
            )
        ).toBeNull();
    });

    it('names the subject with the given label and keeps competitor data labels', () => {
        const headline = buildSummaryHeadline(BENCHMARK_FIXTURE, BRAND)!;
        expect(headline.subject.label).toBe(BRAND);
        expect(headline.competitors.map(c => c.target.label)).toEqual([
            'BetaGPT',
            'GammaGem',
        ]);
    });

    it('formats each competitor with its own diff, interval and verdict', () => {
        const headline = buildSummaryHeadline(BENCHMARK_FIXTURE, BRAND)!;
        expect(
            headline.competitors.map(c => [
                c.target.id,
                c.diffText,
                c.ciText,
                c.verdict,
            ])
        ).toEqual([
            ['gpt', '+0.123', '[+0.051, +0.198]', 'ahead'],
            ['gemini', '−0.037', '[−0.110, +0.020]', 'tie'],
        ]);
    });

    it('carries the per-comparison question count, not the release item count', () => {
        const headline = buildSummaryHeadline(
            {
                ...BENCHMARK_FIXTURE,
                headline: BENCHMARK_FIXTURE.headline.map(c =>
                    c.target === 'gemini' ? { ...c, n: 27 } : c
                ),
            },
            BRAND
        )!;
        expect(
            headline.competitors.map(c => [c.target.id, c.questionCount])
        ).toEqual([
            ['gpt', 40],
            ['gemini', 27],
        ]);
    });

    it('formats the subject L5 score', () => {
        expect(buildSummaryHeadline(BENCHMARK_FIXTURE, BRAND)!.l5Text).toBe(
            '0.880'
        );
    });

    it('shows the empty placeholder when the subject has no L5 score', () => {
        const { judged } = BENCHMARK_FIXTURE.breakdown;
        const headline = buildSummaryHeadline(
            {
                ...BENCHMARK_FIXTURE,
                breakdown: {
                    ...BENCHMARK_FIXTURE.breakdown,
                    judged: {
                        ...judged,
                        L5: { ...judged.L5, siglens: null },
                    },
                },
            },
            BRAND
        )!;
        expect(headline.l5Text).toBe(BENCHMARK_EMPTY_CELL);
    });

    it('shows every non-baseline competitor, however many there are', () => {
        const extra = Array.from({ length: 5 }, (_, i) => ({
            ...BENCHMARK_FIXTURE.headline[0]!,
            target: `x${i}`,
        }));
        const headline = buildSummaryHeadline(
            {
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
            },
            BRAND
        );
        expect(headline!.competitors).toHaveLength(2 + extra.length);
        expect(headline!.competitors.map(c => c.target.id)).not.toContain(
            'deepseek'
        );
    });
});
