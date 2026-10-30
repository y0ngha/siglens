import { describe, expect, it } from 'vitest';
import { assertBenchmarkRelease } from '../assertBenchmarkRelease';
import { BENCHMARK_FIXTURE } from '../../__tests__/fixtures/benchmarkFixture';

/** 픽스처를 깊은 복사해 한 곳만 망가뜨린 입력을 만든다. */
function mutated(mutate: (draft: Record<string, any>) => void): unknown {
    const draft = JSON.parse(JSON.stringify(BENCHMARK_FIXTURE));
    mutate(draft);
    return draft;
}

describe('assertBenchmarkRelease', () => {
    it('returns the fixture unchanged when it is well formed', () => {
        expect(assertBenchmarkRelease(BENCHMARK_FIXTURE)).toBe(
            BENCHMARK_FIXTURE
        );
    });

    it('rejects a non-object', () => {
        expect(() => assertBenchmarkRelease(null)).toThrow(
            'invalid release at release'
        );
    });

    it('rejects a duplicate target id', () => {
        const input = mutated(d => {
            d.targets[1].id = 'siglens';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow('targets[1].id');
    });

    it('rejects a headline contrast against an unknown target', () => {
        const input = mutated(d => {
            d.headline[0].target = 'nobody';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'headline[0].target'
        );
    });

    it('rejects a subject version that is not a release tag', () => {
        const input = mutated(d => {
            d.methodology.subjectVersion = 'latest';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'methodology.subjectVersion'
        );
    });

    it('rejects a subject measurement date that is not ISO', () => {
        const input = mutated(d => {
            d.methodology.subjectMeasuredAt = '10/25';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'methodology.subjectMeasuredAt'
        );
    });

    it('rejects an inverted confidence interval', () => {
        const input = mutated(d => {
            d.headline[0].ci95 = [0.5, 0.1];
        });
        expect(() => assertBenchmarkRelease(input)).toThrow('headline[0].ci95');
    });

    it('rejects a score table missing a target', () => {
        const input = mutated(d => {
            delete d.breakdown.byLevel.L1.gpt;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'breakdown.byLevel.L1.gpt'
        );
    });

    it('rejects a release without the overall score row', () => {
        const input = mutated(d => {
            delete d.breakdown.overall;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'breakdown.overall'
        );
    });

    it('rejects a missing partial count', () => {
        const input = mutated(d => {
            delete d.breakdown.labelCounts.gpt.partial;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'breakdown.labelCounts.gpt.partial'
        );
    });

    it('rejects an objective item labeled correct without full marks', () => {
        const input = mutated(d => {
            d.items[0].results.siglens = { label: 'correct', score: 0 };
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'items[0].results.siglens.label'
        );
    });

    it('accepts a partial objective item with a mixed score', () => {
        const input = mutated(d => {
            d.items[0].results.siglens = { label: 'partial', score: 0 };
        });
        expect(() => assertBenchmarkRelease(input)).not.toThrow();
    });

    it('rejects a judged item whose label is outside its score band', () => {
        const input = mutated(d => {
            d.items[3].results.gpt = { label: 'correct', score: 0.4 };
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'items[3].results.gpt.label'
        );
    });

    it('rejects an unknown verdict label on an item', () => {
        const input = mutated(d => {
            d.items[0].results.gpt.label = 'maybe';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'items[0].results.gpt.label'
        );
    });

    it('rejects an item with no result for a target', () => {
        const input = mutated(d => {
            delete d.items[2].results.deepseek;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'items[2].results.deepseek'
        );
    });

    it('rejects a duplicate qid', () => {
        const input = mutated(d => {
            d.items[1].qid = d.items[0].qid;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow('items[1].qid');
    });

    it('rejects an unparsable scoring date', () => {
        const input = mutated(d => {
            d.scoredAt = 'someday';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow('scoredAt');
    });

    it('rejects a release without the subject target', () => {
        const input = mutated(d => {
            d.targets[0].id = 'renamed';
            d.headline = [];
            d.breakdown = BENCHMARK_FIXTURE.breakdown;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'a target with id siglens'
        );
    });

    it('rejects a headline contrast against the subject itself', () => {
        const input = mutated(d => {
            d.headline[0].target = 'siglens';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'headline[0].target'
        );
    });

    it.each(['measuredAt', 'scoredAt'])(
        'rejects a %s that is not a plain YYYY-MM-DD date',
        field => {
            const input = mutated(d => {
                d[field] = '2099-01-12T00:00:00Z';
            });
            expect(() => assertBenchmarkRelease(input)).toThrow(field);
        }
    );

    it('rejects a zip path outside the round directory', () => {
        const input = mutated(d => {
            d.downloads.zipPath = '/benchmark/2000-01/benchmark.zip';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'downloads.zipPath'
        );
    });

    it('rejects an impossible calendar date', () => {
        const input = mutated(d => {
            d.scoredAt = '2026-02-30';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow('scoredAt');
    });

    it.each(['2099/01', '../x', 'Round-1', '-a', ''])(
        'rejects the round id %j',
        round => {
            const input = mutated(d => {
                d.round = round;
            });
            expect(() => assertBenchmarkRelease(input)).toThrow('round');
        }
    );

    it.each(['zipPath', 'otsPath'])('rejects ".." segments in %s', field => {
        const input = mutated(d => {
            const holder = field === 'zipPath' ? d.downloads : d.prereg;
            holder[field] = '/benchmark/2099-01/../2000-01/x.zip';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(field);
    });

    it.each(['http://gist.example.test/p', 'javascript:alert(1)', 'nope'])(
        'rejects the gist URL %j',
        url => {
            const input = mutated(d => {
                d.prereg.gistUrl = url;
            });
            expect(() => assertBenchmarkRelease(input)).toThrow(
                'prereg.gistUrl'
            );
        }
    );

    it.each(['abc', 'A'.repeat(64), 'g'.repeat(64)])(
        'rejects the combined sha256 %j',
        sha => {
            const input = mutated(d => {
                d.prereg.combinedSha256 = sha;
            });
            expect(() => assertBenchmarkRelease(input)).toThrow(
                'prereg.combinedSha256'
            );
        }
    );

    it.each(['pool', 'template'])(
        'rejects an item %s equal to the filter sentinel',
        field => {
            const input = mutated(d => {
                d.items[0][field] = 'all';
            });
            expect(() => assertBenchmarkRelease(input)).toThrow(
                `items[0].${field}`
            );
        }
    );

    it('rejects a pool size keyed by the filter sentinel', () => {
        const input = mutated(d => {
            d.methodology.poolSizes.all = 3;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'methodology.poolSizes.all'
        );
    });

    it('rejects an OTS path outside the round directory', () => {
        const input = mutated(d => {
            d.prereg.otsPath = 'https://example.com/manifest.sha256.ots';
        });
        expect(() => assertBenchmarkRelease(input)).toThrow('prereg.otsPath');
    });

    it('accepts a null p-value for the baseline comparison', () => {
        expect(BENCHMARK_FIXTURE.headline[2]?.pHolm).toBeNull();
        expect(() => assertBenchmarkRelease(BENCHMARK_FIXTURE)).not.toThrow();
    });

    it('rejects a competitor comparison without a numeric p-value', () => {
        const input = mutated(d => {
            d.headline[0].pHolm = null;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'headline[0].pHolm'
        );
    });

    it('rejects a baseline comparison that carries a p-value', () => {
        const input = mutated(d => {
            d.headline[2].pHolm = 0.01;
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'headline[2].pHolm'
        );
    });

    it('rejects two headline contrasts for the same target', () => {
        const input = mutated(d => {
            d.headline.push({ ...d.headline[0] });
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'headline[3].target'
        );
    });

    it('rejects a second contrast against a baseline', () => {
        const input = mutated(d => {
            d.headline.push({ ...d.headline[2] });
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'headline[3].target'
        );
    });

    it('rejects a headline that omits a competitor', () => {
        const input = mutated(d => {
            d.headline.splice(1, 1);
        });
        expect(() => assertBenchmarkRelease(input)).toThrow(
            'a contrast against competitor gemini'
        );
    });

    it('accepts a headline without the optional baseline contrast', () => {
        const input = mutated(d => {
            d.headline.splice(2, 1);
        });
        expect(() => assertBenchmarkRelease(input)).not.toThrow();
    });
});
