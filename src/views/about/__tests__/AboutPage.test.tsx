import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import ko from '../../../../messages/ko.json';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({ namespace }: { locale: string; namespace: string }) =>
            createTranslator({ locale: 'ko', messages: ko, namespace } as never)
    ),
}));

import { AboutPage } from '../AboutPage';
import { EMPTY_SKILL_COUNTS, getAboutFaq } from '../lib/aboutContent';

const COUNTS = {
    ...EMPTY_SKILL_COUNTS,
    indicators: 39,
    candlesticks: 8,
    patterns: 17,
    strategies: 8,
};

async function renderPage() {
    renderWithIntl(
        await AboutPage({
            locale: 'ko',
            title: 'Siglens 소개',
            counts: COUNTS,
            faq: await getAboutFaq('ko'),
            updatedAt: '2026년 9월 24일',
        })
    );
}

describe('AboutPage', () => {
    beforeAll(() => {
        // ReportReplay checks this on mount; stay still so the frame is stable.
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })
        );
    });

    it('lays out one h1 and the sections in order', async () => {
        await renderPage();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            ko.views.about.hero.title
        );
        expect(
            screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
        ).toEqual([
            ko.views.about.replay.title,
            ko.views.about.pain.title,
            ko.views.about.data.title,
            ko.views.about.method.title,
            ko.views.about.operator.title,
            ko.views.about.limits.title,
            ko.views.about.faq.title,
            ko.views.about.more.title,
            ko.views.about.end.title,
        ]);
        // The header already has search; the hero is headline and lede only.
        expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('interpolates the live skill counts', async () => {
        await renderPage();
        expect(
            screen.getByText(
                '가격과 거래량으로 이동평균, RSI, MACD 같은 보조지표 39종을 계산해요.'
            )
        ).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/\{\w+\}/);
    });

    it('server-renders a whole example report', async () => {
        await renderPage();
        const region = screen.getByRole('region', {
            name: ko.views.about.replay.region,
        });
        expect(region).toHaveTextContent('siglens.io/AAPL');
        expect(region).toHaveTextContent('50일 이동평균선');
        expect(region).toHaveTextContent('+6.2%');
    });

    it('keeps the E-E-A-T content: operator links, method, limits, disclaimer', async () => {
        await renderPage();
        expect(
            screen.getByRole('link', { name: ko.views.about.operator.email })
        ).toHaveAttribute('href', 'mailto:dev.y0ngha@gmail.com');
        expect(
            screen.getByRole('link', { name: ko.views.about.operator.github })
        ).toHaveAttribute('href', 'https://github.com/y0ngha');
        expect(
            screen.getByText(ko.views.about.method.freshQuote)
        ).toBeInTheDocument();
        expect(
            screen.getByText(ko.views.about.limits.levels)
        ).toBeInTheDocument();
        expect(
            screen.getByText(ko.views.about.limits.disclaimer, { exact: false })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: ko.views.about.limits.terms })
        ).toHaveAttribute('href', '/terms');
    });

    it('lists eight data tiles, each linking into a real ticker tab', async () => {
        await renderPage();
        const tiles = screen.getAllByRole('heading', { level: 3 });
        // 8 data tiles + 3 method steps + the freshness box.
        expect(tiles).toHaveLength(12);
        expect(
            screen.getByRole('link', { name: '삼성전자 재무제표 보기' })
        ).toHaveAttribute('href', '/005930.KS/financials');
        expect(
            screen.getByRole('link', { name: '엔비디아 옵션 보기' })
        ).toHaveAttribute('href', '/NVDA/options');
    });

    it('renders the same FAQ the JSON-LD is built from', async () => {
        await renderPage();
        const faq = await getAboutFaq('ko');
        const section = screen
            .getByRole('heading', { name: ko.views.about.faq.title })
            .closest('section')!;
        for (const { question, answer } of faq) {
            expect(within(section).getByText(question)).toBeInTheDocument();
            expect(within(section).getByText(answer)).toBeInTheDocument();
        }
    });

    it('links across to the SIGLENS AI about page', async () => {
        await renderPage();
        expect(
            screen.getByRole('link', { name: ko.views.about.more.ai })
        ).toHaveAttribute('href', 'https://ai.siglens.io/about');
    });
});
