vi.mock('../demos/registry', () => ({
    getGuideDemo: vi.fn((category: string, slug: string) =>
        category === 'indicators' && slug === 'rsi'
            ? { bars: [], overlays: [] }
            : null
    ),
}));
vi.mock('../ui/GuideDemoChart', () => ({
    GuideDemoChart: ({
        title,
        caption,
    }: {
        title: string;
        caption: string | null;
    }) => (
        <figure data-testid="demo-chart" aria-label={title}>
            {caption}
        </figure>
    ),
}));

import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import { aiAskUrl } from '@/shared/config/aiHost';
import type { Locale } from '@/shared/i18n/locales';
import type { GuideEntry } from '@/entities/guide/types';
import ko from '../../../../messages/ko.json';
import en from '../../../../messages/en.json';
import { GuideEntryPage } from '../GuideEntryPage';
import { guideEntry } from './guideFixtures';

const g = ko.views.guide;

const RSI = guideEntry({
    slug: 'rsi',
    title: 'RSI',
    aliases: ['상대강도지수', 'RSI 14'],
    summary: '과열과 과매도를 가늠하는 지표예요.',
    demoCaption: '설명용으로 만든 가상의 봉이에요.',
    bodyMd: [
        '## 어떻게 계산하나',
        '',
        '평균 상승폭과 하락폭의 비율이에요. 자세한 내용은 [MACD](/guide/indicators/macd)를 보세요.',
        '',
        '| 구간 | 해석 |',
        '| --- | --- |',
        '| 70 위 | 과열 |',
        '',
        '## 무엇을 말해 주나',
        '',
        '- 70 위는 과열이에요.',
    ].join('\n'),
    faq: [
        {
            q: 'RSI가 70을 넘으면 팔아야 하나요?',
            a: '자동으로 하락 신호는 아니에요.',
        },
        { q: '기간은 얼마가 좋나요?', a: '14가 표준이에요.' },
    ],
    related: ['macd', 'ghost'],
});
const ADX = guideEntry({ slug: 'adx', order: 0 });
const MACD = guideEntry({ slug: 'macd', order: 2, title: 'MACD' });
const DOJI = guideEntry({
    slug: 'doji',
    category: 'candlesticks',
    title: '도지',
});
const CATALOG = [DOJI, ADX, RSI, MACD];

async function renderEntry(
    entry: GuideEntry = RSI,
    locale: Locale = 'ko',
    catalog: readonly GuideEntry[] = CATALOG
) {
    const tree = await GuideEntryPage({ locale, entry, catalog });
    return renderWithIntl(
        (await resolveAsyncServerTree(tree)) as ReactElement,
        { locale }
    );
}

describe('GuideEntryPage', () => {
    it('h1은 하나이고 항목 제목이다', async () => {
        await renderEntry();

        expect(
            screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)
        ).toEqual(['RSI']);
    });

    it('브레드크럼은 홈 › 가이드 › 분류 › 항목이다', async () => {
        await renderEntry();

        const nav = screen.getByRole('navigation', {
            name: /breadcrumb|경로|브레드/i,
        });
        const items = within(nav)
            .getAllByRole('listitem')
            .map(li => li.textContent)
            .filter(text => text !== '/');
        expect(items).toEqual([
            'SIGLENS',
            g.hubTitle,
            g.categoryIndicators,
            'RSI',
        ]);
        expect(
            within(nav).getByRole('link', { name: g.hubTitle })
        ).toHaveAttribute('href', '/guide');
        expect(
            within(nav).getByRole('link', { name: g.categoryIndicators })
        ).toHaveAttribute('href', '/guide/indicators');
    });

    it('다른 이름·요약·업데이트 날짜를 보여 준다', async () => {
        await renderEntry();

        expect(screen.getByText('상대강도지수')).toBeInTheDocument();
        expect(screen.getByText('RSI 14')).toBeInTheDocument();
        expect(screen.getByText(RSI.summary)).toBeInTheDocument();
        const time = screen.getByText(/마지막 업데이트/);
        expect(time.tagName).toBe('TIME');
        expect(time).toHaveAttribute('datetime', RSI.updatedAt);
        expect(time).toHaveTextContent('2026년 10월 10일');
    });

    it('다른 이름이 없으면 그 줄을 그리지 않는다', async () => {
        await renderEntry(MACD);

        expect(screen.queryByText(g.aliasesLabel)).toBeNull();
    });

    it('데모가 있으면 차트를 제목·캡션과 함께 그린다', async () => {
        await renderEntry();

        const chart = screen.getByTestId('demo-chart');
        expect(chart).toHaveAttribute('aria-label', 'RSI');
        expect(chart).toHaveTextContent('설명용으로 만든 가상의 봉이에요.');
    });

    it('데모가 없으면 차트 자리를 비운다', async () => {
        await renderEntry(MACD);

        expect(screen.queryByTestId('demo-chart')).toBeNull();
    });

    it('본문은 서버에서 진짜 h2와 표로 그린다', async () => {
        await renderEntry();

        expect(
            screen.getByRole('heading', { level: 2, name: '어떻게 계산하나' })
        ).toHaveAttribute('id', '어떻게-계산하나');
        const table = screen.getByRole('table');
        expect(
            within(table).getByRole('columnheader', { name: '구간' })
        ).toBeInTheDocument();
        expect(
            within(table).getByRole('cell', { name: '과열' })
        ).toBeInTheDocument();
    });

    it('본문 속 /guide 링크는 내부 링크다', async () => {
        await renderEntry();

        const hrefs = screen
            .getAllByRole('link', { name: 'MACD' })
            .map(a => a.getAttribute('href'));
        expect(hrefs).toContain('/guide/indicators/macd');
    });

    it('본문 h2로 만든 차례가 같은 id를 가리킨다', async () => {
        await renderEntry();

        const toc = screen.getByRole('navigation', { name: g.tocLabel });
        expect(
            within(toc).getByRole('link', { name: '어떻게 계산하나' })
        ).toHaveAttribute('href', '#어떻게-계산하나');
        expect(
            within(toc).getByRole('link', { name: '무엇을 말해 주나' })
        ).toHaveAttribute('href', '#무엇을-말해-주나');
    });

    describe('FAQ', () => {
        it('질문마다 접히는 details이고 답변은 HTML에 있다', async () => {
            const { container } = await renderEntry();

            const items = container.querySelectorAll('details');
            expect(items).toHaveLength(2);
            expect(items[0]).toHaveTextContent(
                'RSI가 70을 넘으면 팔아야 하나요?'
            );
            expect(items[0]).toHaveTextContent(
                '자동으로 하락 신호는 아니에요.'
            );
            expect(items[0]).not.toHaveAttribute('open');
        });

        it('FAQ가 없으면 섹션도 없다', async () => {
            await renderEntry(MACD);

            expect(
                screen.queryByRole('heading', { level: 2, name: g.faqHeading })
            ).toBeNull();
        });
    });

    describe('이어 보기', () => {
        it('related는 존재하는 항목만 카드로 보여 준다', async () => {
            await renderEntry();

            const section = screen
                .getByRole('heading', { level: 2, name: g.relatedHeading })
                .closest('section') as HTMLElement;
            const cards = within(section).getAllByRole('heading', { level: 3 });
            expect(cards.map(c => c.textContent)).toEqual(['MACD']);
            expect(
                within(section).getByRole('link', { name: /MACD/ })
            ).toHaveAttribute('href', '/guide/indicators/macd');
        });

        it('같은 분류의 이전·다음 항목으로 가는 링크를 둔다', async () => {
            await renderEntry();

            const pager = screen.getByRole('navigation', {
                name: g.paginationLabel,
            });
            expect(
                within(pager).getByRole('link', {
                    name: new RegExp(g.previousLabel),
                })
            ).toHaveAttribute('href', '/guide/indicators/adx');
            expect(
                within(pager).getByRole('link', {
                    name: new RegExp(g.nextLabel),
                })
            ).toHaveAttribute('href', '/guide/indicators/macd');
        });

        it('분류의 처음 항목에는 이전 링크가 없다', async () => {
            await renderEntry(ADX);

            const pager = screen.getByRole('navigation', {
                name: g.paginationLabel,
            });
            expect(
                within(pager).queryByRole('link', {
                    name: new RegExp(g.previousLabel),
                })
            ).toBeNull();
        });

        it('이웃도 related도 없는 항목은 둘 다 그리지 않는다', async () => {
            await renderEntry(DOJI);

            expect(
                screen.queryByRole('navigation', { name: g.paginationLabel })
            ).toBeNull();
            expect(
                screen.queryByRole('heading', {
                    level: 2,
                    name: g.relatedHeading,
                })
            ).toBeNull();
        });
    });

    it('종목 검색 안내는 홈으로 가는 링크다', async () => {
        await renderEntry();

        expect(screen.getByRole('link', { name: g.ctaButton })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('투자 고지 문구를 싣는다', async () => {
        await renderEntry();

        expect(
            screen.getByText(ko.shared.lib.legal.investmentDisclaimer)
        ).toBeInTheDocument();
    });

    describe('AI 플로팅 버튼', () => {
        it('가이드 질문을 미리 채워 ai.siglens.io로 보낸다', async () => {
            await renderEntry();

            const fab = document.querySelector('[data-ask-ai-fab]');
            expect(fab).toHaveAttribute(
                'href',
                aiAskUrl(
                    '/',
                    ko.widgets['ask-ai-fab'].guideQuestion.replace(
                        '{title}',
                        'RSI'
                    )
                )
            );
        });

        it('비-ko 로케일은 접두 경로와 그 로케일 문구를 쓴다', async () => {
            await renderEntry(RSI, 'en');

            const fab = document.querySelector('[data-ask-ai-fab]');
            const href = new URL(fab?.getAttribute('href') ?? '');
            expect(href.pathname).toBe('/en');
            expect(href.searchParams.get('q')).toBe(
                en.widgets['ask-ai-fab'].guideQuestion.replace('{title}', 'RSI')
            );
        });
    });

    it('비-ko 로케일은 그 로케일 문구로 렌더하고 링크에 접두사를 붙인다', async () => {
        await renderEntry(RSI, 'en');

        expect(
            screen.getByRole('link', { name: en.views.guide.ctaButton })
        ).toHaveAttribute('href', '/en');
        const categoryLinks = screen.getAllByRole('link', {
            name: en.views.guide.categoryIndicators,
        });
        expect(categoryLinks.length).toBeGreaterThan(0);
        for (const link of categoryLinks) {
            expect(link).toHaveAttribute('href', '/en/guide/indicators');
        }
    });
});
