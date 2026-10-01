import { describe, it, expect } from 'vitest';
import {
    assignBlind,
    metricsOf,
    renderAnswerKey,
    renderBlindReport,
    type CategoryComparison,
    type DigestVariantRun,
} from '../abDigestReport';

function run(over: Partial<DigestVariantRun>): DigestVariantRun {
    return {
        reasoning: true,
        latencyMs: 1000,
        usage: { promptTokens: 900, cachedTokens: 100, outputTokens: 500 },
        status: 'done',
        currentDriverKo: '서술',
        keyEventsKo: ['하나', '둘'],
        upcomingEventsKo: [],
        overallSentiment: 'bullish',
        ...over,
    };
}

const COMPARISON: CategoryComparison = {
    category: 'stock',
    label: '미국 주식',
    newsCount: 25,
    on: run({ reasoning: true, currentDriverKo: 'ON-TEXT', latencyMs: 9000 }),
    off: run({
        reasoning: false,
        currentDriverKo: 'OFF-TEXT',
        latencyMs: 3000,
        usage: { promptTokens: 900, cachedTokens: 100, outputTokens: 200 },
    }),
};

describe('metricsOf', () => {
    it('입력 토큰은 일반+캐시 합, 서술은 글자(코드포인트) 수로 센다', () => {
        const m = metricsOf(run({ currentDriverKo: '가나다' }));
        expect(m.inputTokens).toBe(1000);
        expect(m.outputTokens).toBe(500);
        expect(m.driverChars).toBe(3);
        expect(m.keyEvents).toBe(2);
    });

    it('usage를 못 잡았으면 토큰은 null', () => {
        const m = metricsOf(run({ usage: null }));
        expect(m.inputTokens).toBeNull();
        expect(m.outputTokens).toBeNull();
    });
});

describe('assignBlind', () => {
    it('주입한 난수로 카테고리마다 A의 정체를 정한다', () => {
        const values = [0.1, 0.9];
        const out = assignBlind(['stock', 'crypto'], () => values.shift() ?? 0);
        expect(out).toEqual([
            { category: 'stock', aIsReasoningOn: true },
            { category: 'crypto', aIsReasoningOn: false },
        ]);
    });
});

describe('renderBlindReport', () => {
    it('A/B 순서는 배정을 따르고, 추론 여부·토큰·지연은 드러내지 않는다', () => {
        const md = renderBlindReport(
            [COMPARISON],
            [{ category: 'stock', aIsReasoningOn: false }],
            new Date('2026-10-01T00:00:00Z')
        );
        expect(md.indexOf('OFF-TEXT')).toBeLessThan(md.indexOf('ON-TEXT'));
        expect(md).not.toMatch(/추론 ON|reasoning|토큰|latency|9000|9,000/);
    });

    it('배정이 빠진 카테고리는 조용히 넘기지 않고 던진다', () => {
        expect(() => renderBlindReport([COMPARISON], [], new Date())).toThrow(
            'no blind assignment for stock'
        );
    });
});

describe('renderAnswerKey', () => {
    it('라벨-변형 대응과 정량 지표를 싣는다', () => {
        const md = renderAnswerKey(
            [COMPARISON],
            [{ category: 'stock', aIsReasoningOn: true }]
        );
        expect(md).toContain('| stock | A | ON | 9,000 | 1,000 | 500 | n/a |');
        expect(md).toContain('| stock | B | OFF | 3,000 | 1,000 | 200 | n/a |');
    });

    it('단가를 주면 호출당 비용을 계산한다', () => {
        const md = renderAnswerKey(
            [COMPARISON],
            [{ category: 'stock', aIsReasoningOn: true }],
            { input: 1, output: 2 }
        );
        // (1000×1 + 500×2) / 1e6 = 0.002
        expect(md).toContain('$0.00200');
    });
});
