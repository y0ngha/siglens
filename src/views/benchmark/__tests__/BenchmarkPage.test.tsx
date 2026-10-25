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
import type { BenchmarkRelease } from '@/entities/benchmark/types';
import { BenchmarkPage } from '../BenchmarkPage';

const SITE = 'https://site.test';
const AI_SITE = 'https://ai.test';
const p = ko.views.benchmark;

async function renderPage(
    overrides: {
        locale?: 'ko' | 'en';
        release?: BenchmarkRelease;
    } = {}
) {
    const locale = overrides.locale ?? 'ko';
    renderWithIntl(
        await BenchmarkPage({
            release: overrides.release ?? BENCHMARK_FIXTURE,
            locale,
            siteUrl: SITE,
            aiSiteUrl: AI_SITE,
        }),
        { locale }
    );
}

describe('BenchmarkPage', () => {
    it('has one h1 and the sections in reading order', async () => {
        await renderPage();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
        ).toEqual([
            p.headline.title,
            p.breakdown.title,
            p.method.title,
            p.prereg.title,
            p.downloads.title,
            p.items.title,
        ]);
    });

    describe('hero', () => {
        it('names both dates when grading was finalized later', async () => {
            await renderPage();
            expect(
                screen.getByText(
                    /2099-01-10~2099-01-12에 측정하고 채점했습니다\./
                )
            ).toBeTruthy();
        });

        it('names the date once when measured and graded on the same day', async () => {
            await renderPage({
                release: { ...BENCHMARK_FIXTURE, scoredAt: '2099-01-10' },
            });
            expect(
                screen.getByText(/2099-01-10에 측정하고 채점했습니다\./)
            ).toBeTruthy();
            expect(screen.queryByText(/~2099-01-10/)).toBeNull();
        });
    });

    describe('headline', () => {
        it('builds the summary sentence from the data', async () => {
            await renderPage();
            expect(
                screen.getByText(
                    '시그렌즈 AI의 객관 점수를 경쟁 모델 2종과 비교하면, 유의하게 앞선 모델이 1종, 차이를 확정하지 못한 모델이 1종, 뒤처진 모델이 0종입니다.'
                )
            ).toBeTruthy();
        });

        it('reads figures from the release, not from the page', async () => {
            await renderPage({
                release: {
                    ...BENCHMARK_FIXTURE,
                    headline: [
                        {
                            target: 'gpt',
                            diff: 0.777,
                            ci95: [0.7, 0.8],
                            pHolm: 0.0001,
                            n: 99,
                        },
                    ],
                },
            });
            const table = screen.getByRole('table', {
                name: p.headline.competitors,
            });
            expect(within(table).getByText('+0.777')).toBeTruthy();
            expect(within(table).getByText('[+0.700, +0.800]')).toBeTruthy();
            expect(within(table).getByText('<0.001')).toBeTruthy();
            expect(within(table).getByText('99')).toBeTruthy();
        });

        it('lists competitors and the baseline in separate tables', async () => {
            await renderPage();
            const competitors = screen.getByRole('table', {
                name: p.headline.competitors,
            });
            const baselines = screen.getByRole('table', {
                name: p.headline.baselines,
            });
            expect(
                within(competitors).getAllByRole('rowgroup')[1]?.children
            ).toHaveLength(2);
            expect(within(baselines).getByText('DeltaBase')).toBeTruthy();
            expect(within(baselines).getByText('+0.456')).toBeTruthy();
            expect(within(competitors).queryByText('DeltaBase')).toBeNull();
        });

        it('marks each comparison with its reading', async () => {
            await renderPage();
            const table = screen.getByRole('table', {
                name: p.headline.competitors,
            });
            const ahead = within(table).getByText('BetaGPT').closest('tr')!;
            expect(
                within(ahead).getByText(p.headline.verdict.ahead)
            ).toBeTruthy();
            const tie = within(table).getByText('GammaGem').closest('tr')!;
            expect(within(tie).getByText(p.headline.verdict.tie)).toBeTruthy();
        });

        it('reads an untested baseline as neither ahead nor behind', async () => {
            await renderPage();
            const table = screen.getByRole('table', {
                name: p.headline.baselines,
            });
            const row = within(table).getByText('DeltaBase').closest('tr')!;
            expect(
                within(row).getByText(p.headline.verdict.untested)
            ).toBeTruthy();
            expect(
                within(row).queryByText(p.headline.verdict.ahead)
            ).toBeNull();
        });
    });

    describe('breakdown', () => {
        it('has a table per grouping with one column per target', async () => {
            await renderPage();
            const byLevel = screen.getByRole('table', {
                name: '레벨별 객관 점수 (오답 −1점)',
            });
            expect(
                within(byLevel)
                    .getAllByRole('columnheader')
                    .map(h => h.textContent)
            ).toEqual([
                '레벨',
                '시그렌즈 AI',
                'BetaGPT',
                'GammaGem',
                'DeltaBase',
            ]);
            expect(within(byLevel).getByText('0.910')).toBeTruthy();
        });

        it('leads the level table with the overall primary score', async () => {
            await renderPage();
            const first = screen
                .getByRole('table', { name: /레벨별/ })
                .querySelector('tbody tr')!;
            expect(first.querySelector('th')!.textContent).toBe(
                p.breakdown.rowOverall
            );
            expect(
                [...first.querySelectorAll('td')].map(td => td.textContent)
            ).toEqual(['0.640', '0.500', '0.580', '0.230']);
        });

        it('shows an empty cell for a missing score and bolds the best one', async () => {
            await renderPage();
            const l3 = screen
                .getByRole('table', { name: /레벨별/ })
                .querySelectorAll('tbody tr')[3]!;
            const cells = [...l3.querySelectorAll('td')];
            expect(cells[2]!.textContent).toBe('—');
            expect(cells[0]!.className).toContain('font-semibold');
            expect(cells[1]!.className).not.toContain('font-semibold');
        });

        it('shows label counts per target', async () => {
            await renderPage();
            const counts = screen.getByRole('table', {
                name: p.breakdown.counts,
            });
            const gpt = within(counts).getByText('BetaGPT').closest('tr')!;
            expect(
                [...gpt.querySelectorAll('td')].map(td => td.textContent)
            ).toEqual(['1', '1', '2', '1', '0', '0']);
        });

        it('names the judged levels', async () => {
            await renderPage();
            const judged = screen.getByRole('table', {
                name: p.breakdown.judged,
            });
            expect(within(judged).getByText(p.levels.L5)).toBeTruthy();
            expect(within(judged).getByText('0.880')).toBeTruthy();
        });
    });

    describe('methodology', () => {
        it('reports pool sizes and the vendor mismatch count from the data', async () => {
            await renderPage();
            expect(screen.getByText(/A 3 · B 1/)).toBeTruthy();
            expect(
                screen.getByText(
                    '공식값으로 다시 확인한 미국 문항 중 잠정값과 달랐던 문항은 2개입니다.'
                )
            ).toBeTruthy();
        });

        it('omits the mismatch sentence when the count is unknown', async () => {
            await renderPage({
                release: {
                    ...BENCHMARK_FIXTURE,
                    methodology: {
                        ...BENCHMARK_FIXTURE.methodology,
                        vendorMismatchCount: null,
                    },
                },
            });
            expect(screen.queryByText(/잠정값과 달랐던 문항/)).toBeNull();
        });

        it('renders no breadcrumb on the shared view', async () => {
            await renderPage();
            expect(screen.queryByRole('navigation')).toBeNull();
        });

        it('states how many times each item was asked from the data', async () => {
            await renderPage({
                release: {
                    ...BENCHMARK_FIXTURE,
                    methodology: {
                        ...BENCHMARK_FIXTURE.methodology,
                        rounds: 2,
                    },
                },
            });
            expect(
                screen.getByText(/문항마다 대상별로 2번씩 물었습니다/)
            ).toBeTruthy();
        });

        it('names the measured SiglensAI version and its date apart from the others', async () => {
            await renderPage({
                release: {
                    ...BENCHMARK_FIXTURE,
                    methodology: {
                        ...BENCHMARK_FIXTURE.methodology,
                        rounds: 1,
                    },
                },
            });
            expect(
                screen.getByText(/문항마다 대상별로 한 번씩 물었습니다/)
            ).toBeTruthy();
            expect(
                screen.getByText(
                    /다른 모델은 2099-01-10에, 시그렌즈 AI는 v9\.9\.9 버전을 2099-01-11에 측정했습니다\./
                )
            ).toBeTruthy();
            expect(
                screen.getByText(/이전에 측정한 결과를 본 뒤 고친 버전입니다/)
            ).toBeTruthy();
        });

        it('injects lambda as an argument', async () => {
            await renderPage({
                release: {
                    ...BENCHMARK_FIXTURE,
                    methodology: {
                        ...BENCHMARK_FIXTURE.methodology,
                        lambda: 2,
                    },
                },
            });
            expect(screen.getByText(/오답 −2점을 줍니다/)).toBeTruthy();
        });

        it('builds main-site and ai-site links from the props', async () => {
            await renderPage();
            expect(
                screen
                    .getByRole('link', { name: p.method.siteMethodology })
                    .getAttribute('href')
            ).toBe(`${SITE}/methodology`);
            expect(
                screen
                    .getByRole('link', { name: p.method.aiAbout })
                    .getAttribute('href')
            ).toBe(`${AI_SITE}/about`);
        });

        it('keeps the locale prefix on those links for a non-default locale', async () => {
            await renderPage({ locale: 'en' });
            expect(
                screen
                    .getByRole('link', {
                        name: en.views.benchmark.method.siteMethodology,
                    })
                    .getAttribute('href')
            ).toBe(`${SITE}/en/methodology`);
        });
    });

    describe('pre-registration and downloads', () => {
        it('links the data licence (CC BY 4.0) and states the disclaimer', async () => {
            await renderPage();
            const licence = screen.getByRole('link', { name: 'CC BY 4.0' });
            expect(licence.getAttribute('href')).toBe(
                'https://creativecommons.org/licenses/by/4.0/'
            );
            expect(licence.getAttribute('rel')).toContain('license');
            expect(screen.getByText(p.downloads.disclaimer)).toBeTruthy();
        });

        it('links BENCHMARK.md and no unpublished code directory', async () => {
            await renderPage();
            expect(
                screen
                    .getByRole('link', { name: p.method.designDoc })
                    .getAttribute('href')
            ).toMatch(/\/blob\/master\/BENCHMARK\.md$/);
            const hrefs = screen
                .getAllByRole('link')
                .map(link => link.getAttribute('href') ?? '');
            expect(
                hrefs.some(href => href.includes('/tree/master/benchmark'))
            ).toBe(false);
        });

        it('shows the hash, gist and proof file from the data', async () => {
            await renderPage();
            expect(screen.getByText('a'.repeat(64))).toBeTruthy();
            expect(
                screen
                    .getByRole('link', {
                        name: BENCHMARK_FIXTURE.prereg.gistUrl,
                    })
                    .getAttribute('href')
            ).toBe(BENCHMARK_FIXTURE.prereg.gistUrl);
            expect(
                screen
                    .getByRole('link', { name: p.prereg.otsLink })
                    .getAttribute('href')
            ).toBe(BENCHMARK_FIXTURE.prereg.otsPath);
        });

        it('links the zip as a download', async () => {
            await renderPage();
            const zip = screen.getByRole('link', { name: p.downloads.zip });
            expect(zip.getAttribute('href')).toBe(
                BENCHMARK_FIXTURE.downloads.zipPath
            );
            expect(zip.hasAttribute('download')).toBe(true);
        });
    });

    describe('explorer', () => {
        it('server-renders every question of the release', async () => {
            await renderPage();
            for (const item of BENCHMARK_FIXTURE.items) {
                expect(screen.getByText(item.question)).toBeTruthy();
            }
        });
    });

    describe('language note', () => {
        it('is absent in Korean', async () => {
            await renderPage();
            expect(screen.queryByRole('note')).toBeNull();
        });

        it('appears for other locales and says the data is Korean', async () => {
            await renderPage({ locale: 'en' });
            expect(screen.getByRole('note').textContent).toBe(
                en.views.benchmark.koreanNote
            );
        });
    });
});
