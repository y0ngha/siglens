vi.mock('@/widgets/home/HeroIllustration', () => ({
    HeroIllustration: () => <div data-testid="hero-illustration" />,
}));
vi.mock('@/features/ticker-search/ui/SymbolSearchPanel', () => ({
    SymbolSearchPanel: () => <input aria-label="종목 검색" />,
}));

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Locale } from '@/shared/i18n/locales';
import { HomeHero } from '@/app/[locale]/(home)/_components/HomeHero';

const COPY = {
    aiTeaser: 'AI에게 물어보세요',
    eyebrow: '언제 살지보다 어떤 가격을 지켜볼지',
    headline: '주식과 코인의 가격대 지도',
    intro: '지표 13개로 분석합니다.',
    introTail: '무료입니다.',
};

const QUICK_LINKS = [
    { href: '/market', label: '미국 시장' },
    { href: '/news', label: '미국 뉴스' },
];

function renderHero(locale: Locale = 'ko') {
    return render(
        <HomeHero locale={locale} copy={COPY} quickLinks={QUICK_LINKS} />
    );
}

describe('HomeHero', () => {
    it('H1은 헤드라인과 로케일 브랜드명을 함께 담는다', () => {
        renderHero('ko');

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '주식과 코인의 가격대 지도 시그렌즈(SIGLENS)'
        );
    });

    it('눈썹 문구를 H1 위에 그린다', () => {
        renderHero();

        const eyebrow = screen.getByText('언제 살지보다 어떤 가격을 지켜볼지');
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(
            eyebrow.compareDocumentPosition(h1) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('일러스트 래퍼는 lg 이상에서만 보인다', () => {
        renderHero();

        const wrapper = screen.getByTestId('hero-illustration').parentElement;
        expect(wrapper).toHaveClass('hidden', 'lg:block');
    });

    it('소개 문단 두 문장을 NBSP로 잇는다(모바일에서는 <br>이 숨는다)', () => {
        renderHero();

        expect(screen.getByText(/지표 13개로 분석합니다/).textContent).toBe(
            '지표 13개로 분석합니다.\u00a0무료입니다.'
        );
    });

    it('건너뛰기 대상 #search가 포커스를 받을 수 있고 검색 패널을 담는다', () => {
        const { container } = renderHero();

        const target = container.querySelector('#search');
        expect(target).toHaveAttribute('tabindex', '-1');
        expect(target).toContainElement(
            screen.getByRole('textbox', { name: '종목 검색' })
        );
    });

    it('빠른 이동 링크를 받은 라벨·목적지로 그린다', () => {
        renderHero();

        expect(screen.getByRole('link', { name: '미국 시장' })).toHaveAttribute(
            'href',
            '/market'
        );
        expect(screen.getByRole('link', { name: '미국 뉴스' })).toHaveAttribute(
            'href',
            '/news'
        );
    });

    it('SIGLENS AI 안내 줄은 ai 호스트의 로케일 경로로 간다', () => {
        renderHero('en');

        const teaser = screen.getByRole('link', { name: /AI에게 물어보세요/ });
        expect(teaser).toHaveAttribute('href', 'https://ai.siglens.io/en');
    });

    it('DOM 순서는 H1, 검색, 일러스트다(모바일에서 그림이 먼저 오지 않는다)', () => {
        renderHero();

        const h1 = screen.getByRole('heading', { level: 1 });
        const search = screen.getByRole('textbox', { name: '종목 검색' });
        const illustration = screen.getByTestId('hero-illustration');
        const follows = (a: Node, b: Node): boolean =>
            Boolean(
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
            );

        expect(follows(h1, search)).toBe(true);
        expect(follows(search, illustration)).toBe(true);
    });
});
