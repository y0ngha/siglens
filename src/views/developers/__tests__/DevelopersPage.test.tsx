import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type { AgentToolSpec } from '@y0ngha/siglens-core';
import { describe, expect, it, vi } from 'vitest';
import { API_ERROR_DOCS } from '@/entities/siglens-api-key/lib/apiErrorCatalog';
import { buildApiToolReferences } from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import {
    API_KEY_MAX_ACTIVE_PER_USER,
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_DOC_PATHS,
    PUBLIC_API_RATE_LIMITS,
} from '@/shared/config/publicApi';
import type { Locale } from '@/shared/i18n/locales';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import en from '../../../../messages/en.json';
import ko from '../../../../messages/ko.json';

const catalogs = { ko, en } as const;

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
                messages: catalogs[locale],
                namespace,
            } as never)
    ),
}));

import { DEVELOPER_SECTION_IDS } from '../lib/developersContent';
import { DevelopersPage } from '../DevelopersPage';

const d = ko.views.developers;

const quote: AgentToolSpec = {
    name: 'get_quote',
    description: 'Latest price for up to 3 symbols.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            symbols: {
                type: 'array',
                description: 'Up to 3 symbols',
                items: { type: 'string' },
            },
        },
        required: ['symbols'],
        additionalProperties: false,
    },
};
const noArgs: AgentToolSpec = {
    name: 'get_economy',
    description: 'Macro snapshot.',
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
    },
};
const fresh: AgentToolSpec = {
    name: 'run_fresh_analysis',
    description: 'Get an AI analysis for a symbol.',
    costClass: 'expensive',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string', description: 'Ticker' },
            kind: {
                type: 'string',
                enum: ['technical', 'news'],
                description: 'Analysis kind',
            },
            model: {
                type: 'string',
                enum: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'],
                description: 'Model',
            },
        },
        required: ['symbol', 'kind'],
        additionalProperties: false,
    },
};

const searchTicker: AgentToolSpec = {
    name: 'search_ticker',
    description: 'Find tickers.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
    },
};

const BASE_URL = 'https://example.test';
const tools = buildApiToolReferences({
    baseUrl: BASE_URL,
    tools: [quote, noArgs, fresh, searchTicker],
});

async function renderPage(locale: Locale = 'ko') {
    renderWithIntl(
        await DevelopersPage({
            locale,
            title: ko.shared.seo.developers.title,
            baseUrl: BASE_URL,
            tools,
            updatedAt: '2026년 10월 15일',
        }),
        locale === 'en' ? { locale: 'en', messages: en } : undefined
    );
}

describe('DevelopersPage', () => {
    it('has exactly one h1 and the eight sections in order, each id on its own h2', async () => {
        await renderPage();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            d.hero.title
        );
        const h2 = screen.getAllByRole('heading', { level: 2 });
        expect(h2.map(h => h.id)).toEqual([...DEVELOPER_SECTION_IDS]);
        expect(h2.map(h => h.textContent)).toEqual([
            d.quickstart.title,
            d.authentication.title,
            d.rateLimits.title,
            d.responses.title,
            d.streaming.title,
            d.localeSection.title,
            d.tools.title,
            d.downloads.title,
        ]);
    });

    it('has one section nav whose links point at those ids (sticky on desktop, stacked below)', async () => {
        await renderPage();
        const nav = screen.getByRole('navigation', { name: d.toc.label });
        const hrefs = within(nav)
            .getAllByRole('link')
            .map(a => a.getAttribute('href'));
        expect(hrefs).toEqual(DEVELOPER_SECTION_IDS.map(id => `#${id}`));
        expect(nav.className).toContain('lg:sticky');
    });

    it('states the BYOK promise and the cached-analysis-is-free promise in the hero', async () => {
        await renderPage();
        expect(screen.getByText(d.hero.byok)).toBeInTheDocument();
        expect(d.hero.byok).toContain('BYOK');
        expect(
            screen.getByRole('link', { name: d.hero.createKey })
        ).toHaveAttribute('href', '/account');
    });

    it('takes the rate limits from the shared constants, not from typed copy', async () => {
        await renderPage();
        const { data, ai } = PUBLIC_API_RATE_LIMITS;
        const text = screen.getByText(/분당/).textContent ?? '';
        expect(text).toContain(`분당 ${data.perMinute}회`);
        expect(text).toContain(`하루 ${data.perDay.toLocaleString('ko-KR')}회`);
        expect(text).toContain(`분당 ${ai.perMinute}회`);
        expect(text).toContain(`하루 ${ai.perDay.toLocaleString('ko-KR')}회`);
        // 카탈로그 원문에는 숫자가 박혀 있지 않다(I18-6).
        expect(d.rateLimits.body).not.toMatch(/\d/);
    });

    it('passes the key limit into the first quick-start step', async () => {
        await renderPage();
        expect(
            screen.getByText(
                new RegExp(`최대 ${API_KEY_MAX_ACTIVE_PER_USER}개까지`)
            )
        ).toBeInTheDocument();
    });

    it('lists every cataloged error code with its status in the errors table', async () => {
        await renderPage();
        const table = screen.getByRole('table', {
            name: d.responses.tableCaption,
        });
        for (const { code, status, summary } of API_ERROR_DOCS) {
            const row = within(table)
                .getByRole('rowheader', { name: `${status} ${code}` })
                .closest('tr')!;
            expect(row).toHaveTextContent(summary);
        }
    });

    it('adds the run_fresh_analysis streaming note only to the codes the catalog marks as streamed', async () => {
        await renderPage();
        const table = screen.getByRole('table', {
            name: d.responses.tableCaption,
        });
        for (const { code, status, streamed } of API_ERROR_DOCS) {
            const row = within(table)
                .getByRole('rowheader', { name: `${status} ${code}` })
                .closest('tr')!;
            if (streamed === true)
                expect(row).toHaveTextContent(d.responses.streamedNote);
            else expect(row).not.toHaveTextContent(d.responses.streamedNote);
        }
        expect(
            API_ERROR_DOCS.filter(doc => doc.streamed).map(doc => doc.code)
        ).toEqual([
            'tool_timeout',
            'tool_failed',
            'analysis_failed',
            'provider_error',
        ]);
    });

    it('lists the rate-limit headers including the AI ones', async () => {
        await renderPage();
        const table = screen.getByRole('table', {
            name: d.rateLimits.tableCaption,
        });
        for (const name of [
            'X-RateLimit-Limit',
            'X-RateLimit-AI-Limit',
            'X-RateLimit-AI-Remaining',
            'X-RateLimit-AI-Reset',
            'Retry-After',
        ])
            expect(
                within(table).getByRole('rowheader', { name })
            ).toBeInTheDocument();
    });

    it('explains streaming: 200 first, whitespace keepalive, and the error field on 200', async () => {
        await renderPage();
        const section = document
            .getElementById('streaming')!
            .closest('section')!;
        expect(section).toHaveTextContent('HTTP 200');
        expect(section).toHaveTextContent('error 필드');
        // 예시는 긴 요청용 `--max-time`과 error 분기를 담는다.
        const example = within(section).getByRole('region', {
            name: d.streaming.exampleLabel,
        });
        expect(example).toHaveTextContent(
            `--max-time ${FRESH_ANALYSIS_DEADLINE_SECONDS}`
        );
        expect(section).toHaveTextContent(
            String(FRESH_ANALYSIS_DEADLINE_SECONDS)
        );
        expect(example).toHaveTextContent('/tools/run_fresh_analysis');
    });

    it('renders one reference card per tool, in the given order, with an anchor each', async () => {
        await renderPage();
        const cards = screen.getAllByRole('article');
        expect(cards.map(card => card.querySelector('h3')?.id)).toEqual([
            'tool-get_quote',
            'tool-get_economy',
            'tool-run_fresh_analysis',
            'tool-search_ticker',
        ]);
        const index = screen.getByRole('list', { name: d.tools.indexLabel });
        expect(
            within(index)
                .getAllByRole('link')
                .map(a => a.getAttribute('href'))
        ).toEqual([
            '#tool-get_quote',
            '#tool-get_economy',
            '#tool-run_fresh_analysis',
            '#tool-search_ticker',
        ]);
    });

    it('shows the core description untranslated, the argument table and a curl example per tool', async () => {
        await renderPage();
        const card = screen.getByRole('article', { name: /get_quote/ });
        const original = within(card).getByText(quote.description);
        expect(original).toHaveAttribute('lang', 'en');
        const table = within(card).getByRole('table');
        const row = within(table)
            .getByRole('rowheader', { name: /symbols/ })
            .closest('tr')!;
        expect(row).toHaveTextContent('array of string');
        expect(row).toHaveTextContent(d.tools.required);
        expect(row).toHaveTextContent('Up to 3 symbols');
        const curl = within(card).getByRole('region', {
            name: 'get_quote curl 예시',
        });
        expect(curl).toHaveTextContent(
            `curl -s -X POST ${BASE_URL}/api/v1/tools/get_quote`
        );
        expect(curl).toHaveTextContent(
            'Authorization: Bearer $SIGLENS_API_KEY'
        );
    });

    it('leads each card with the plain-language summary and folds the agent-facing original into a closed disclosure', async () => {
        await renderPage();
        const card = screen.getByRole('article', { name: /get_quote/ });
        const summary = within(card).getByText(d.tools.summaries.get_quote);
        expect(summary.tagName).toBe('P');
        expect(summary.closest('details')).toBeNull();
        const details = card.querySelector('details')!;
        expect(details.open).toBe(false);
        expect(
            within(details).getByText(d.tools.agentDescriptionToggle).tagName
        ).toBe('SUMMARY');
        expect(details).toHaveTextContent(quote.description);
        // 요약은 영어 원문과 다른 문장이고, 원문은 접힌 곳에만 있다.
        expect(d.tools.summaries.get_quote).not.toBe(quote.description);
        expect(within(card).getAllByText(quote.description)).toHaveLength(1);
    });

    it('localizes the summary for the page language', async () => {
        await renderPage('en');
        const card = screen.getByRole('article', { name: /get_quote/ });
        expect(
            within(card).getByText(
                en.views.developers.tools.summaries.get_quote
            )
        ).toBeInTheDocument();
        expect(card).toHaveTextContent(
            en.views.developers.tools.agentDescriptionToggle
        );
    });

    it('falls back to the original description when a tool has no summary key', async () => {
        const unknown: AgentToolSpec = {
            name: 'get_unlisted_tool',
            description: 'A tool the catalog does not know yet.',
            costClass: 'free',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
        };
        renderWithIntl(
            await DevelopersPage({
                locale: 'ko',
                title: ko.shared.seo.developers.title,
                baseUrl: BASE_URL,
                tools: buildApiToolReferences({
                    baseUrl: BASE_URL,
                    tools: [unknown],
                }),
                updatedAt: '2026년 10월 15일',
            })
        );
        const card = screen.getByRole('article', { name: /get_unlisted_tool/ });
        expect(within(card).getByText(unknown.description)).toBeInTheDocument();
        expect(card.querySelector('details')).toBeNull();
    });

    it('says so when a tool takes no arguments instead of drawing an empty table', async () => {
        await renderPage();
        const card = screen.getByRole('article', { name: /get_economy/ });
        expect(within(card).getByText(d.tools.noArgs)).toBeInTheDocument();
        expect(within(card).queryByRole('table')).toBeNull();
    });

    it('collapses a long enum into a preview plus a native disclosure, and leaves short enums alone', async () => {
        await renderPage();
        const card = screen.getByRole('article', {
            name: /run_fresh_analysis/,
        });
        const row = within(card)
            .getByRole('rowheader', { name: /model/ })
            .closest('tr')!;
        expect(row).toHaveTextContent('"m1" | "m2" | "m3"');
        const details = row.querySelector('details')!;
        expect(details.open).toBe(false);
        expect(within(details).getByText('나머지 5개 보기').tagName).toBe(
            'SUMMARY'
        );
        expect(details).toHaveTextContent('"m4" | "m5" | "m6" | "m7" | "m8"');
        // 값 2개짜리(kind)는 접지 않는다.
        const kind = within(card)
            .getByRole('rowheader', { name: /kind/ })
            .closest('tr')!;
        expect(kind.querySelector('details')).toBeNull();
        expect(kind).toHaveTextContent('"technical" | "news"');
    });

    it('marks only run_fresh_analysis as BYOK, with the BYOK note', async () => {
        await renderPage();
        const freshCard = screen.getByRole('article', {
            name: /run_fresh_analysis/,
        });
        expect(
            within(freshCard).getByText(d.tools.byokBadge)
        ).toBeInTheDocument();
        expect(
            within(freshCard).getByText(d.tools.byokNote)
        ).toBeInTheDocument();
        for (const name of [/get_quote/, /get_economy/])
            expect(
                within(screen.getByRole('article', { name })).queryByText(
                    d.tools.byokBadge
                )
            ).toBeNull();
    });

    it('offers openapi.json, openapi.yaml and SKILL.md as same-origin downloads', async () => {
        await renderPage();
        const downloads = document
            .getElementById('downloads')!
            .closest('section')!;
        const links = within(downloads).getAllByRole('link');
        expect(
            links.map(a => [a.getAttribute('href'), a.getAttribute('download')])
        ).toEqual([
            [
                `${PUBLIC_API_BASE_PATH}${PUBLIC_API_DOC_PATHS.openapiJson}`,
                'openapi.json',
            ],
            [
                `${PUBLIC_API_BASE_PATH}${PUBLIC_API_DOC_PATHS.openapiYaml}`,
                'openapi.yaml',
            ],
            [
                `${PUBLIC_API_BASE_PATH}${PUBLIC_API_DOC_PATHS.skill}`,
                'SKILL.md',
            ],
        ]);
    });

    it('gives the quick start a key link to /account, the env var and a skill install command', async () => {
        await renderPage();
        const quickstart = document
            .getElementById('quickstart')!
            .closest('section')!;
        expect(
            within(quickstart).getByRole('link', {
                name: d.quickstart.step1Link,
            })
        ).toHaveAttribute('href', '/account');
        expect(
            within(quickstart).getByRole('region', {
                name: d.quickstart.step2Label,
            })
        ).toHaveTextContent('export SIGLENS_API_KEY=slk_');
        const skill = within(quickstart).getByRole('region', {
            name: d.quickstart.skillLabel,
        });
        expect(skill).toHaveTextContent(`${BASE_URL}/api/v1/skill`);
        expect(skill).toHaveTextContent('~/.claude/skills/siglens/SKILL.md');
    });

    it('picks the quick-start call example by tool name, not by list position', async () => {
        await renderPage();
        const quickstart = document
            .getElementById('quickstart')!
            .closest('section')!;
        const example = within(quickstart).getByRole('region', {
            name: d.quickstart.toolLabel.replace('{name}', 'search_ticker'),
        });
        expect(example).toHaveTextContent('/tools/search_ticker');
        expect(
            within(quickstart).queryByRole('region', {
                name: d.quickstart.toolLabel.replace('{name}', 'get_quote'),
            })
        ).toBeNull();
    });

    it('prints the update date from the prop', async () => {
        await renderPage();
        expect(
            screen.getByText('마지막 업데이트 2026년 10월 15일')
        ).toBeInTheDocument();
    });

    it('renders in English with the same structure and formatted limits', async () => {
        await renderPage('en');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            en.views.developers.hero.title
        );
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(
            DEVELOPER_SECTION_IDS.length
        );
        expect(
            screen.getByText(/Tool calls are limited to/).textContent
        ).toContain(
            `${PUBLIC_API_RATE_LIMITS.data.perDay.toLocaleString('en-US')} per day`
        );
    });
});
