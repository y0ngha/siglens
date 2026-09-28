import { createTranslator } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { describe, expect, it, vi } from 'vitest';
import ko from '../../../../../messages/ko.json';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({ namespace }: { locale: string; namespace: string }) =>
            createTranslator({ locale: 'ko', messages: ko, namespace } as never)
    ),
}));

import {
    buildReportScenarios,
    EMPTY_SKILL_COUNTS,
    getAboutFaq,
} from '../aboutContent';

const COUNTS = {
    ...EMPTY_SKILL_COUNTS,
    indicators: 39,
    candlesticks: 8,
    patterns: 17,
};

describe('getAboutFaq', () => {
    it('returns the catalog questions in order, fully resolved', async () => {
        const faq = await getAboutFaq('ko');
        expect(faq).toHaveLength(7);
        expect(faq[0]).toEqual({
            question: ko.views.about.faq.whatQ,
            answer: ko.views.about.faq.whatA,
        });
        for (const { question, answer } of faq) {
            expect(`${question}${answer}`).not.toMatch(/[{}]/);
        }
    });
});

describe('buildReportScenarios', () => {
    it('covers a US stock, a Korean stock and a coin, with parsed lines', async () => {
        const t = await getTranslations({
            locale: 'ko',
            namespace: 'views.about',
        });
        const scenarios = buildReportScenarios(t, COUNTS);

        expect(scenarios.map(s => s.question)).toEqual([
            'AAPL',
            '005930.KS',
            'BTCUSD',
        ]);
        expect(new Set(scenarios.map(s => s.id)).size).toBe(3);
        for (const s of scenarios) {
            expect(s.lines).toHaveLength(5);
            const text = s.lines
                .flatMap(l => l.segments.map(x => x.text))
                .join('');
            expect(text).not.toMatch(/<\/?(b|up|down)>/);
            expect(s.summary).toBe(`${s.tools.length}단계를 거쳐 분석했어요`);
            // The AI step is how the report gets written, not what it rests on.
            expect(s.sources).not.toContain('AI 리포트');
        }
    });

    it('fills step subjects from the live skill counts', async () => {
        const t = await getTranslations({
            locale: 'ko',
            namespace: 'views.about',
        });
        const [aapl] = buildReportScenarios(t, COUNTS);
        expect(aapl!.tools.map(x => x.subject)).toEqual([
            '일봉',
            '39종',
            '25종',
            'AAPL',
            '',
        ]);
    });

    it('gives the coin a news step instead of financials', async () => {
        const t = await getTranslations({
            locale: 'ko',
            namespace: 'views.about',
        });
        const btc = buildReportScenarios(t, COUNTS)[2]!;
        const labels = btc.tools.map(x => x.label);
        expect(labels).toContain('뉴스');
        expect(labels).not.toContain('재무·뉴스');
    });
});
