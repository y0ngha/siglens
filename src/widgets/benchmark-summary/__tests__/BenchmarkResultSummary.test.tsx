import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import ko from '../../../../messages/ko.json';
import en from '../../../../messages/en.json';

const CATALOGS = { ko, en } as const;

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({
            locale,
            namespace,
        }: {
            locale: 'ko' | 'en';
            namespace: string;
        }) =>
            createTranslator({
                locale,
                messages: CATALOGS[locale],
                namespace,
            } as never)
    ),
}));

import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import { BenchmarkResultSummary } from '../BenchmarkResultSummary';

const AI_SITE = 'https://ai.test';
const w = ko.widgets['benchmark-summary'];

async function renderSummary(
    props: Partial<Parameters<typeof BenchmarkResultSummary>[0]> = {}
) {
    const locale = props.locale ?? 'ko';
    const element = await BenchmarkResultSummary({
        release: BENCHMARK_FIXTURE,
        locale: 'ko',
        aiSiteUrl: AI_SITE,
        ...props,
    });
    if (element === null) return null;
    return renderWithIntl(element, { locale });
}

describe('BenchmarkResultSummary', () => {
    it('shows one card per competitor plus the L5 card, from the data', async () => {
        await renderSummary();
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(3);
        expect(within(items[0]!).getByText('BetaGPT 대비')).toBeTruthy();
        expect(within(items[0]!).getByText('+0.123')).toBeTruthy();
        expect(within(items[1]!).getByText('GammaGem 대비')).toBeTruthy();
        expect(within(items[1]!).getByText('−0.037')).toBeTruthy();
        expect(within(items[2]!).getByText(w.l5)).toBeTruthy();
        expect(within(items[2]!).getByText('0.880')).toBeTruthy();
    });

    it('states each comparison own question count on its card', async () => {
        await renderSummary({
            release: {
                ...BENCHMARK_FIXTURE,
                headline: BENCHMARK_FIXTURE.headline.map(c =>
                    c.target === 'gemini' ? { ...c, n: 27 } : c
                ),
            },
        });
        const items = screen.getAllByRole('listitem');
        expect(within(items[0]!).getByText('공통 문항 40개')).toBeTruthy();
        expect(within(items[1]!).getByText('공통 문항 27개')).toBeTruthy();
    });

    it('does not quote the release item count as the comparison basis', async () => {
        const { container } = (await renderSummary())!;
        const intro = screen.getByRole('heading', {
            name: w.title,
        }).nextElementSibling!;
        expect(intro.textContent).toBe(
            '같은 질문으로 잰 객관 점수 차이입니다. 양수면 시그렌즈 AI 쪽이 높습니다.'
        );
        expect(container.textContent).not.toContain(
            `${BENCHMARK_FIXTURE.items.length}개`
        );
    });

    it('names the subject with the brand, not the data label', async () => {
        const { container } = (await renderSummary())!;
        expect(container.textContent).toContain('시그렌즈 AI');
        expect(container.textContent).not.toContain('AlphaAI');
    });

    it('leaves the baseline out of the summary', async () => {
        await renderSummary();
        expect(screen.queryByText(/DeltaBase/)).toBeNull();
    });

    it('shows a card for every competitor and folds to three columns past four cards', async () => {
        const base = BENCHMARK_FIXTURE.headline[0]!;
        const targets = [
            ...BENCHMARK_FIXTURE.targets,
            { id: 'x1', label: 'X1', model: 'm', isBaseline: false },
            { id: 'x2', label: 'X2', model: 'm', isBaseline: false },
        ];
        await renderSummary({
            release: {
                ...BENCHMARK_FIXTURE,
                targets,
                headline: [
                    base,
                    { ...base, target: 'gemini' },
                    { ...base, target: 'x1' },
                    { ...base, target: 'x2' },
                ],
            },
        });
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(5);
        expect(screen.getByText('X2 대비')).toBeTruthy();
        expect(items[0]!.parentElement!.className).toContain('lg:grid-cols-3');
    });

    it('links to the ai-host benchmark page with an absolute URL', async () => {
        await renderSummary();
        expect(
            screen.getByRole('link', { name: w.more }).getAttribute('href')
        ).toBe(`${AI_SITE}/benchmark`);
    });

    it('keeps the locale prefix on the link', async () => {
        await renderSummary({ locale: 'en' });
        expect(
            screen
                .getByRole('link', {
                    name: en.widgets['benchmark-summary'].more,
                })
                .getAttribute('href')
        ).toBe(`${AI_SITE}/en/benchmark`);
    });

    it('renders nothing when the subject is missing from the data', async () => {
        const result = await renderSummary({
            release: {
                ...BENCHMARK_FIXTURE,
                targets: BENCHMARK_FIXTURE.targets.filter(
                    t => t.id !== 'siglens'
                ),
            },
        });
        expect(result).toBeNull();
    });

    it('centers the heading only when asked', async () => {
        await renderSummary({ centered: true });
        expect(
            screen.getByRole('heading', { name: w.title }).className
        ).toContain('text-center');
    });
});
