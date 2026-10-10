import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { aiAskUrl } from '@/shared/config/aiHost';
import type { GuideEntrySummary } from '@/entities/guide/types';
import ko from '../../../../../messages/ko.json';
import { GuideBrowser } from '../GuideBrowser';
import { GUIDE_CARD_ALIAS_LIMIT } from '../GuideCard';

const g = ko.views.guide;

function summary(
    overrides: Partial<GuideEntrySummary> & { slug: string }
): GuideEntrySummary {
    return {
        category: 'indicators',
        order: 1,
        title: overrides.slug,
        aliases: [],
        summary: `${overrides.slug} 요약`,
        updatedAt: '2026-10-10T00:00:00.000Z',
        ...overrides,
    };
}

const ENTRIES: GuideEntrySummary[] = [
    summary({
        slug: 'doji',
        category: 'candlesticks',
        title: '도지',
        aliases: ['십자형'],
    }),
    summary({
        slug: 'double-bottom',
        category: 'chart-patterns',
        title: '이중바닥',
        aliases: ['더블 바텀', 'W 패턴'],
    }),
    summary({
        slug: 'rsi',
        title: 'RSI',
        aliases: ['상대강도지수'],
        summary: '과열과 과매도를 가늠하는 지표예요.',
    }),
    summary({ slug: 'macd', title: 'MACD', order: 2 }),
    summary({
        slug: 'elliott-wave',
        category: 'strategies',
        title: '엘리엇 파동',
    }),
];

const LABELS = {
    candlesticks: g.categoryCandlesticks,
    'chart-patterns': g.categoryChartPatterns,
    indicators: g.categoryIndicators,
    strategies: g.categoryStrategies,
};

function renderBrowser(fixedCategory?: GuideEntrySummary['category']) {
    return render(
        <GuideBrowser
            entries={ENTRIES}
            categoryLabels={LABELS}
            fixedCategory={fixedCategory}
        />
    );
}

const cardTitles = () =>
    screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);

beforeEach(() => {
    window.history.replaceState(null, '', '/guide');
});

describe('GuideBrowser — 필터가 없을 때', () => {
    it('분류별 섹션(h2)으로 모든 카드를 그린다', () => {
        renderBrowser();

        const headings = screen
            .getAllByRole('heading', { level: 2 })
            .map(h => h.textContent);
        expect(headings).toEqual([
            `${g.categoryCandlesticks} 1개 항목`,
            `${g.categoryChartPatterns} 1개 항목`,
            `${g.categoryIndicators} 2개 항목`,
            `${g.categoryStrategies} 1개 항목`,
        ]);
        expect(cardTitles()).toEqual([
            '도지',
            '이중바닥',
            'RSI',
            'MACD',
            '엘리엇 파동',
        ]);
    });

    it('카드는 항목 페이지로 가는 링크다', () => {
        renderBrowser();

        expect(screen.getByRole('link', { name: /이중바닥/ })).toHaveAttribute(
            'href',
            '/guide/chart-patterns/double-bottom'
        );
    });

    it('섹션마다 분류 허브로 가는 "전체 보기" 링크가 있다', () => {
        renderBrowser();

        expect(
            screen.getByRole('link', {
                name: g.viewAllInCategory.replace(
                    '{name}',
                    g.categoryIndicators
                ),
            })
        ).toHaveAttribute('href', '/guide/indicators');
    });

    it('항목 개수를 알린다', () => {
        renderBrowser();

        expect(screen.getByRole('status')).toHaveTextContent('5개 항목');
    });

    it('분류 칩마다 개수를 보여 주고 "전체"가 눌려 있다', () => {
        renderBrowser();

        const all = screen.getByRole('button', { name: /^전체/ });
        expect(all).toHaveAttribute('aria-pressed', 'true');
        expect(all).toHaveTextContent('5');
        expect(
            screen.getByRole('button', {
                name: new RegExp(g.categoryIndicators),
            })
        ).toHaveTextContent('2');
    });
});

describe('GuideBrowser — 서버 렌더', () => {
    it('URL에 필터가 있어도 첫 HTML은 전체 목록이다(ISR 정적 HTML 유지)', () => {
        window.history.replaceState(null, '', '/guide?q=rsi&c=indicators');

        const html = renderToString(
            <IntlTestProvider>
                <GuideBrowser entries={ENTRIES} categoryLabels={LABELS} />
            </IntlTestProvider>
        );

        for (const title of [
            '도지',
            '이중바닥',
            'RSI',
            'MACD',
            '엘리엇 파동',
        ]) {
            expect(html).toContain(title);
        }
        expect(html).toContain('href="/guide/strategies/elliott-wave"');
    });
});

describe('GuideBrowser — 검색', () => {
    it('입력하면 이름·다른 이름·요약으로 거르고 개수를 갱신한다', async () => {
        renderBrowser();

        await userEvent.type(
            screen.getByRole('searchbox', { name: g.searchLabel }),
            '더블 바텀'
        );

        expect(cardTitles()).toEqual(['이중바닥']);
        expect(screen.getByRole('status')).toHaveTextContent('1개 항목');
        expect(
            screen.getByRole('heading', { level: 2, name: g.resultsHeading })
        ).toBeInTheDocument();
    });

    it('결과는 이름 일치가 요약 일치보다 앞선다', async () => {
        renderBrowser();

        await userEvent.type(
            screen.getByRole('searchbox', { name: g.searchLabel }),
            'rsi'
        );

        expect(cardTitles()[0]).toBe('RSI');
    });

    it('질의를 URL ?q= 에 history.replaceState로 쓴다', async () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        renderBrowser();

        fireEvent.change(
            screen.getByRole('searchbox', { name: g.searchLabel }),
            { target: { value: 'macd' } }
        );

        expect(replaceState).toHaveBeenLastCalledWith(
            null,
            '',
            '/guide?q=macd'
        );
    });

    it('마운트 후 URL의 ?q=·?c= 값을 적용한다', () => {
        window.history.replaceState(null, '', '/guide?q=rsi&c=indicators');
        renderBrowser();

        expect(screen.getByRole('searchbox')).toHaveValue('rsi');
        expect(cardTitles()).toEqual(['RSI']);
        expect(
            screen.getByRole('button', {
                name: new RegExp(g.categoryIndicators),
            })
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('알 수 없는 ?c= 는 전체로 본다', () => {
        window.history.replaceState(null, '', '/guide?c=bogus');
        renderBrowser();

        expect(cardTitles()).toHaveLength(5);
        expect(screen.getByRole('button', { name: /^전체/ })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });
});

describe('GuideBrowser — 분류 칩', () => {
    it('칩을 누르면 그 분류만 보이고 ?c= 에 쓴다', async () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        renderBrowser();

        await userEvent.click(
            screen.getByRole('button', {
                name: new RegExp(g.categoryCandlesticks),
            })
        );

        expect(cardTitles()).toEqual(['도지']);
        expect(replaceState).toHaveBeenLastCalledWith(
            null,
            '',
            '/guide?c=candlesticks'
        );
    });

    it('"전체"로 돌아오면 쿼리스트링이 사라진다', async () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        renderBrowser();

        await userEvent.click(
            screen.getByRole('button', {
                name: new RegExp(g.categoryIndicators),
            })
        );
        await userEvent.click(screen.getByRole('button', { name: /^전체/ }));

        expect(replaceState).toHaveBeenLastCalledWith(null, '', '/guide');
        expect(cardTitles()).toHaveLength(5);
    });

    it('질의와 분류는 함께 걸린다', async () => {
        renderBrowser();

        await userEvent.click(
            screen.getByRole('button', {
                name: new RegExp(g.categoryIndicators),
            })
        );
        await userEvent.type(screen.getByRole('searchbox'), 'm');

        expect(cardTitles()).toEqual(['MACD']);
    });
});

describe('GuideBrowser — 결과가 없을 때', () => {
    it('AI에게 묻는 링크와 필터 지우기를 보여 준다', async () => {
        renderBrowser();

        await userEvent.type(screen.getByRole('searchbox'), '없는용어');

        expect(
            screen.getByRole('heading', { level: 2, name: g.emptyTitle })
        ).toBeInTheDocument();
        const ask = screen.getByRole('link', { name: g.emptyAskAi });
        expect(ask).toHaveAttribute(
            'href',
            aiAskUrl('/', g.emptyAiQuestion.replace('{query}', '없는용어'))
        );
        expect(ask).toHaveAttribute('target', '_blank');
        expect(ask).toHaveAttribute('rel', 'nofollow noopener noreferrer');
        expect(screen.getByRole('status')).toHaveTextContent('0개 항목');
    });

    it('필터 지우기는 질의·분류·URL을 모두 되돌린다', async () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        renderBrowser();

        await userEvent.type(screen.getByRole('searchbox'), '없는용어');
        await userEvent.click(
            screen.getByRole('button', { name: g.emptyReset })
        );

        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(cardTitles()).toHaveLength(5);
        expect(replaceState).toHaveBeenLastCalledWith(null, '', '/guide');
    });
});

describe('GuideBrowser — 분류 허브(fixedCategory)', () => {
    it('칩 없이 그 분류의 카드만 보여 준다', () => {
        renderBrowser('indicators');

        expect(screen.queryByRole('group', { name: g.filterLabel })).toBeNull();
        expect(cardTitles()).toEqual(['RSI', 'MACD']);
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: g.categoryListHeading.replace(
                    '{name}',
                    g.categoryIndicators
                ),
            })
        ).toBeInTheDocument();
    });

    it('카드에는 분류 라벨을 중복해서 달지 않는다', () => {
        renderBrowser('indicators');

        const card = screen.getByRole('link', { name: /RSI/ });
        expect(within(card).queryByText(g.categoryIndicators)).toBeNull();
    });

    it('?c= 가 있어도 분류를 바꾸지 않는다', () => {
        window.history.replaceState(null, '', '/guide/indicators?c=strategies');
        renderBrowser('indicators');

        expect(cardTitles()).toEqual(['RSI', 'MACD']);
    });

    it('질의는 ?q= 로만 쓴다', () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        window.history.replaceState(null, '', '/guide/indicators');
        renderBrowser('indicators');

        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'rsi' },
        });

        expect(replaceState).toHaveBeenLastCalledWith(
            null,
            '',
            '/guide/indicators?q=rsi'
        );
    });
});

describe('GuideBrowser — 제목 중복·카드 별칭', () => {
    it('분류 허브의 목록 제목(h2)은 h1과 같은 글자가 아니다', () => {
        renderBrowser('indicators');

        const h2 = screen.getByRole('heading', { level: 2 });
        expect(h2).toHaveTextContent(
            g.categoryListHeading.replace('{name}', g.categoryIndicators)
        );
        expect(h2.textContent).not.toBe(g.categoryIndicators);
    });

    it('카드는 다른 이름을 GUIDE_CARD_ALIAS_LIMIT개까지만 싣는다', () => {
        const aliases = Array.from(
            { length: GUIDE_CARD_ALIAS_LIMIT + 2 },
            (_, i) => `별칭${i}`
        );
        render(
            <GuideBrowser
                entries={[
                    summary({
                        slug: 'many',
                        title: '많은 별칭',
                        aliases,
                    }),
                ]}
                categoryLabels={LABELS}
            />
        );

        expect(
            screen.getByText(
                aliases.slice(0, GUIDE_CARD_ALIAS_LIMIT).join(' · ')
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText(new RegExp(aliases[GUIDE_CARD_ALIAS_LIMIT]))
        ).toBeNull();
    });
});
