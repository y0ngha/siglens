import { describe, expect, it } from 'vitest';
import type { BenchmarkContrast } from '../../types';
import { BENCHMARK_FIXTURE } from '../../__tests__/fixtures/benchmarkFixture';
import {
    buildBenchmarkHeadline,
    classifyContrast,
    withSubjectLabel,
} from '../benchmarkHeadline';

function contrast(
    overrides: Partial<BenchmarkContrast> = {}
): BenchmarkContrast {
    return {
        target: 'gpt',
        diff: 0.1,
        ci95: [0.05, 0.15],
        pHolm: 0.01,
        n: 10,
        ...overrides,
    };
}

describe('classifyContrast', () => {
    it('is ahead when the interval is above zero and p is significant', () => {
        expect(classifyContrast(contrast())).toBe('ahead');
    });

    it('is behind when the interval is below zero and p is significant', () => {
        expect(
            classifyContrast(contrast({ ci95: [-0.2, -0.05], diff: -0.1 }))
        ).toBe('behind');
    });

    it('is a tie when the interval straddles zero', () => {
        expect(classifyContrast(contrast({ ci95: [-0.05, 0.15] }))).toBe('tie');
    });

    it('is a tie when the interval clears zero but p is not significant', () => {
        expect(classifyContrast(contrast({ pHolm: 0.2 }))).toBe('tie');
    });

    it('never calls an untested comparison ahead, however clear its interval', () => {
        expect(classifyContrast(contrast({ pHolm: null }))).toBe('untested');
        expect(
            classifyContrast(
                contrast({ pHolm: null, ci95: [-0.3, -0.2], diff: -0.25 })
            )
        ).toBe('untested');
    });

    it('treats p exactly at the significance level as not significant', () => {
        expect(classifyContrast(contrast({ pHolm: 0.05 }))).toBe('tie');
    });
});

describe('classifyContrast on displayed values', () => {
    it('reads a p that displays as 0.050 as not significant', () => {
        expect(classifyContrast(contrast({ pHolm: 0.0496 }))).toBe('tie');
    });

    it('does not let a CI bound displaying 0.000 exclude zero', () => {
        expect(classifyContrast(contrast({ ci95: [0.0004, 0.15] }))).toBe(
            'tie'
        );
        expect(classifyContrast(contrast({ ci95: [-0.2, -0.0003] }))).toBe(
            'tie'
        );
    });

    it('still calls a bound that displays above zero ahead', () => {
        expect(classifyContrast(contrast({ ci95: [0.0006, 0.15] }))).toBe(
            'ahead'
        );
    });
});

describe('buildBenchmarkHeadline', () => {
    const headline = buildBenchmarkHeadline(BENCHMARK_FIXTURE);

    it('names the subject from the targets list', () => {
        expect(headline?.subject.label).toBe('AlphaAI');
    });

    it('splits baselines from competitors', () => {
        expect(headline?.competitors.map(e => e.target.id)).toEqual([
            'gpt',
            'gemini',
        ]);
        expect(headline?.baselines.map(e => e.target.id)).toEqual(['deepseek']);
    });

    it('counts verdicts over competitors only', () => {
        expect(headline?.counts).toEqual({
            ahead: 1,
            behind: 0,
            tie: 1,
            untested: 0,
        });
    });

    it('keeps an untested competitor out of the ahead and behind counts', () => {
        const changed = buildBenchmarkHeadline({
            ...BENCHMARK_FIXTURE,
            headline: [contrast({ target: 'gpt', pHolm: null })],
        });
        expect(changed?.counts).toEqual({
            ahead: 0,
            behind: 0,
            tie: 0,
            untested: 1,
        });
    });

    it('carries the raw contrast so the view formats the figures', () => {
        expect(headline?.competitors[0]?.contrast).toBe(
            BENCHMARK_FIXTURE.headline[0]
        );
    });

    it('marks the baseline comparison as untested', () => {
        expect(headline?.baselines[0]?.verdict).toBe('untested');
    });

    it('reads the subject L5 judged score from the breakdown', () => {
        expect(headline?.l5Score).toBe(0.88);
    });

    it('changes when the data changes', () => {
        const changed = buildBenchmarkHeadline({
            ...BENCHMARK_FIXTURE,
            headline: [contrast({ target: 'gpt', diff: 0.777 })],
        });
        expect(changed?.competitors[0]?.contrast.diff).toBe(0.777);
    });

    it('skips contrasts against unknown targets', () => {
        const changed = buildBenchmarkHeadline({
            ...BENCHMARK_FIXTURE,
            headline: [contrast({ target: 'nobody' })],
        });
        expect(changed?.competitors).toEqual([]);
    });

    it('returns null when the subject is not among the targets', () => {
        expect(
            buildBenchmarkHeadline({
                ...BENCHMARK_FIXTURE,
                targets: BENCHMARK_FIXTURE.targets.filter(
                    t => t.id !== 'siglens'
                ),
            })
        ).toBeNull();
    });
});

describe('withSubjectLabel', () => {
    it('renames only the subject and leaves the input untouched', () => {
        const renamed = withSubjectLabel(BENCHMARK_FIXTURE, 'SIGLENS AI');
        expect(renamed.targets.find(t => t.id === 'siglens')?.label).toBe(
            'SIGLENS AI'
        );
        expect(
            renamed.targets.filter(t => t.id !== 'siglens').map(t => t.label)
        ).toEqual(
            BENCHMARK_FIXTURE.targets
                .filter(t => t.id !== 'siglens')
                .map(t => t.label)
        );
        expect(
            BENCHMARK_FIXTURE.targets.find(t => t.id === 'siglens')?.label
        ).toBe('AlphaAI');
    });
});
