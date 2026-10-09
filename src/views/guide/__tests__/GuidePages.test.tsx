import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import type { Locale } from '@/shared/i18n/locales';
import ko from '../../../../messages/ko.json';
import ja from '../../../../messages/ja.json';
import { GuideCategoryPage } from '../GuideCategoryPage';
import { GuideHubPage } from '../GuideHubPage';
import { GuideUnavailablePage } from '../GuideUnavailablePage';
import { guideEntry } from './guideFixtures';

const g = ko.views.guide;

const ENTRIES = [
    guideEntry({ slug: 'doji', category: 'candlesticks', title: '도지' }),
    guideEntry({ slug: 'rsi', title: 'RSI', bodyMd: '무거운 본문' }),
    guideEntry({ slug: 'macd', title: 'MACD', order: 2 }),
    guideEntry({
        slug: 'fibonacci',
        category: 'strategies',
        title: '피보나치',
    }),
];

async function renderServer(
    tree: Promise<React.JSX.Element>,
    locale: Locale = 'ko'
) {
    return renderWithIntl(
        (await resolveAsyncServerTree(await tree)) as ReactElement,
        { locale }
    );
}

describe('GuideHubPage', () => {
    it('h1과 소개 문장을 보여 준다', async () => {
        await renderServer(GuideHubPage({ locale: 'ko', entries: ENTRIES }));

        expect(
            screen.getByRole('heading', { level: 1, name: g.hubTitle })
        ).toBeInTheDocument();
        expect(screen.getByText(g.hubIntro)).toBeInTheDocument();
    });

    it('브레드크럼의 마지막 마디가 현재 위치다', async () => {
        await renderServer(GuideHubPage({ locale: 'ko', entries: ENTRIES }));

        const nav = screen.getByRole('navigation', {
            name: /경로|breadcrumb/i,
        });
        expect(within(nav).getByText(g.hubTitle)).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('모든 항목을 분류 섹션 아래 링크로 싣는다(크롤 가능)', async () => {
        await renderServer(GuideHubPage({ locale: 'ko', entries: ENTRIES }));

        for (const entry of ENTRIES) {
            expect(
                screen.getByRole('link', { name: new RegExp(entry.title) })
            ).toHaveAttribute('href', `/guide/${entry.category}/${entry.slug}`);
        }
    });

    it('일본어 로케일은 일본어 문구와 접두사 링크를 쓴다', async () => {
        await renderServer(
            GuideHubPage({ locale: 'ja', entries: ENTRIES }),
            'ja'
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: ja.views.guide.hubTitle,
            })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /RSI/ })).toHaveAttribute(
            'href',
            '/ja/guide/indicators/rsi'
        );
    });
});

describe('GuideCategoryPage', () => {
    async function renderCategory() {
        return renderServer(
            GuideCategoryPage({
                locale: 'ko',
                category: 'indicators',
                entries: ENTRIES,
            })
        );
    }

    it('h1은 분류 이름이고 소개 단락이 있다', async () => {
        await renderCategory();

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: g.categoryIndicators,
            })
        ).toBeInTheDocument();
        expect(screen.getByText(g.categoryIntroIndicators)).toBeInTheDocument();
    });

    it('브레드크럼은 가이드 허브로 되돌아가는 링크를 가진다', async () => {
        await renderCategory();

        const nav = screen.getByRole('navigation', {
            name: /경로|breadcrumb/i,
        });
        expect(
            within(nav).getByRole('link', { name: g.hubTitle })
        ).toHaveAttribute('href', '/guide');
    });

    it('그 분류의 카드만 보여 준다', async () => {
        await renderCategory();

        expect(
            screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
        ).toEqual(['RSI', 'MACD']);
    });

    it('다른 분류 세 곳으로 가는 타일을 보여 준다(자기 자신은 뺀다)', async () => {
        await renderCategory();

        const nav = screen.getByRole('navigation', { name: g.otherCategories });
        expect(
            within(nav)
                .getAllByRole('link')
                .map(a => a.getAttribute('href'))
        ).toEqual([
            '/guide/candlesticks',
            '/guide/chart-patterns',
            '/guide/strategies',
        ]);
        expect(
            within(nav).getByRole('link', { name: /전략·이론/ })
        ).toHaveTextContent('1개 항목');
    });
});

describe('GuideUnavailablePage', () => {
    it('빈 화면이 아니라 안내와 홈으로 가는 길을 낸다', async () => {
        await renderServer(GuideUnavailablePage({ locale: 'ko' }));

        expect(
            screen.getByRole('heading', { level: 1, name: g.hubTitle })
        ).toBeInTheDocument();
        expect(screen.getByText(g.unavailableTitle)).toBeInTheDocument();
        expect(screen.getByText(g.unavailableBody)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: g.unavailableHome })
        ).toHaveAttribute('href', '/');
    });
});
