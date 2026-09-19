import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ko from '../../../../messages/ko.json';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({ namespace }: { locale: string; namespace: string }) =>
            createTranslator({ locale: 'ko', messages: ko, namespace } as never)
    ),
}));

import { AiAboutPage } from '../AiAboutPage';
import { getAboutFaq } from '../lib/aboutContent';

async function renderPage(localePrefix = '') {
    const locale = localePrefix === '/en' ? 'en' : 'ko';
    render(
        await AiAboutPage({
            locale,
            siteUrl: 'https://siglens.io',
            localePrefix,
            faq: await getAboutFaq(locale),
        })
    );
}

describe('AiAboutPage', () => {
    beforeAll(() => {
        // ChatReplay checks this on mount; stay still so the rendered frame is stable.
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })
        );
    });

    it('lays out the approved sections in order', async () => {
        await renderPage();
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: '궁금한 종목, 지금 물어보세요',
            })
        ).toBeInTheDocument();
        const h2s = screen
            .getAllByRole('heading', { level: 2 })
            .map(h => h.textContent);
        expect(h2s).toEqual([
            '이런 점이 답답했다면',
            '답하기 전에 이런 걸 찾아봐요',
            '자주 묻는 질문',
            'SIGLENS에서 더 보기',
            '지금 바로 물어보세요',
        ]);
    });

    it('plays a whole example conversation in the server HTML (first scenario, complete)', async () => {
        await renderPage();
        const region = screen.getByRole('region', {
            name: 'SIGLENS AI 예시 대화',
        });
        expect(region).toHaveTextContent('삼성전자 요즘 흐름 어때?');
        expect(region).toHaveTextContent('71,800원');
        expect(region).toHaveTextContent('기준 2026-09-18 종가');
        // Markup tags are parsed, never shown as text.
        expect(region.textContent).not.toMatch(/<\/?(b|up|down)>/);
    });

    it('lists the eight data sources and the five complaints', async () => {
        await renderPage();
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
        expect(screen.getAllByText('불편했던 점')).toHaveLength(5);
    });

    it('renders the same FAQ the JSON-LD is built from', async () => {
        await renderPage();
        const faq = await getAboutFaq('ko');
        expect(faq).toHaveLength(8);
        for (const { question, answer } of faq) {
            const summary = screen.getByText(question);
            expect(summary.closest('details')).toHaveTextContent(answer);
        }
        expect(faq.find(f => f.question === '돈이 드나요?')?.answer).toContain(
            '하루 10번'
        );
    });

    it('sends every CTA to the chat home of the page locale', async () => {
        await renderPage();
        for (const name of [
            '물어보기',
            'SIGLENS AI에게 물어보기',
            'SIGLENS AI 열기',
        ])
            expect(screen.getByRole('link', { name })).toHaveAttribute(
                'href',
                '/'
            );
        const more = screen.getByRole('navigation', {
            name: 'SIGLENS에서 더 보기',
        });
        expect(
            within(more).getByRole('link', { name: '한국 주식 시장 분석' })
        ).toHaveAttribute('href', 'https://siglens.io/market/kr');
    });

    it('keeps the locale on every link for a non-default locale', async () => {
        await renderPage('/en');
        for (const name of [
            '물어보기',
            'SIGLENS AI에게 물어보기',
            'SIGLENS AI 열기',
        ])
            expect(screen.getByRole('link', { name })).toHaveAttribute(
                'href',
                '/en'
            );
        const more = screen.getByRole('navigation', {
            name: 'SIGLENS에서 더 보기',
        });
        expect(
            within(more).getByRole('link', { name: '한국 주식 시장 분석' })
        ).toHaveAttribute('href', 'https://siglens.io/en/market/kr');
    });
});
