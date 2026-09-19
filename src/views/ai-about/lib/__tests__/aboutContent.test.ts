import { createTranslator } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { describe, expect, it, vi } from 'vitest';
import { GUEST_TURNS_PER_DAY } from '@/widgets/agent-chat';
import ko from '../../../../../messages/ko.json';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({ namespace }: { locale: string; namespace: string }) =>
            createTranslator({ locale: 'ko', messages: ko, namespace } as never)
    ),
}));

import { buildScenarios, getAboutFaq, getAboutSeoCopy } from '../aboutContent';

describe('getAboutSeoCopy', () => {
    it('resolves the seo copy from the ko catalog', async () => {
        const copy = await getAboutSeoCopy('ko');
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.description.length).toBeGreaterThan(0);
        expect(copy.ogLabel.length).toBeGreaterThan(0);
        expect(copy).toEqual({
            title: ko.views['ai-about'].seo.title,
            description: ko.views['ai-about'].seo.description,
            ogLabel: ko.views['ai-about'].seo.ogLabel,
        });
    });
});

describe('getAboutFaq', () => {
    it('returns 8 items, with the price answer carrying the guest turn count', async () => {
        const faq = await getAboutFaq('ko');
        expect(faq).toHaveLength(8);
        const price = faq.find(
            f => f.question === ko.views['ai-about'].faq.priceQ
        );
        expect(price?.answer).toContain(String(GUEST_TURNS_PER_DAY));
        expect(price?.answer).not.toContain('{guest}');
    });
});

describe('buildScenarios', () => {
    it('builds 5 scenarios with unique ids and parsed, markup-free lines', async () => {
        const t = await getTranslations({
            locale: 'ko',
            namespace: 'views.ai-about',
        });
        const scenarios = buildScenarios(t);

        expect(scenarios).toHaveLength(5);
        expect(new Set(scenarios.map(s => s.id)).size).toBe(5);

        for (const scenario of scenarios) {
            for (const line of scenario.lines) {
                expect(line.segments.length).toBeGreaterThan(0);
                for (const segment of line.segments)
                    expect(segment.text).not.toMatch(/<\/?(b|up|down)>/);
            }

            for (const tool of scenario.tools)
                expect(tool.pendingLabel).toContain(tool.label);

            for (const tool of scenario.tools)
                expect(scenario.summary).toContain(tool.label);

            expect(scenario.asOf.startsWith('기준')).toBe(true);
        }
    });
});
