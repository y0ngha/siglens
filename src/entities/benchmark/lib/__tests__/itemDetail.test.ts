import { describe, expect, it } from 'vitest';
import { benchmarkItemDetailPath, isBenchmarkItemDetail } from '../itemDetail';
import { BENCHMARK_DETAIL_FIXTURE } from '../../__tests__/fixtures/benchmarkFixture';

describe('benchmarkItemDetailPath', () => {
    it('builds the static file path under the round directory', () => {
        expect(benchmarkItemDetailPath('2099-01', 'q-001')).toBe(
            '/benchmark/2099-01/items/q-001.json'
        );
    });

    it('encodes characters that would escape the directory', () => {
        expect(benchmarkItemDetailPath('2099-01', '../x')).toBe(
            '/benchmark/2099-01/items/..%2Fx.json'
        );
    });
});

describe('isBenchmarkItemDetail', () => {
    it('accepts the fixture', () => {
        expect(isBenchmarkItemDetail(BENCHMARK_DETAIL_FIXTURE)).toBe(true);
    });

    it.each([
        ['null', null],
        ['array', []],
        ['missing judgements', { qid: 'q', targets: {} }],
        [
            'unknown verdict',
            {
                qid: 'q',
                judgements: [],
                targets: {
                    a: [
                        {
                            round: 1,
                            answerText: 'x',
                            extracted: [
                                {
                                    part: 'p',
                                    value: null,
                                    verdict: 'maybe',
                                    reason: null,
                                },
                            ],
                        },
                    ],
                },
            },
        ],
        [
            'judgement with an L1 level',
            {
                qid: 'q',
                targets: {},
                judgements: [
                    {
                        target: 'a',
                        level: 'L1',
                        round: 1,
                        judge: 'j',
                        score: 1,
                        why: 'w',
                    },
                ],
            },
        ],
        [
            'judgement without a round',
            {
                qid: 'q',
                targets: {},
                judgements: [
                    {
                        target: 'a',
                        level: 'L5',
                        judge: 'j',
                        score: 1,
                        why: 'w',
                    },
                ],
            },
        ],
        [
            'judgement with round 0',
            {
                qid: 'q',
                targets: {},
                judgements: [
                    {
                        target: 'a',
                        level: 'L5',
                        judge: 'j',
                        round: 0,
                        score: 1,
                        why: 'w',
                    },
                ],
            },
        ],
    ])('rejects %s', (_name, value) => {
        expect(isBenchmarkItemDetail(value)).toBe(false);
    });
});
