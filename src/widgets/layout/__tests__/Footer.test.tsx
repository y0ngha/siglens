vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('../ContactDialog', () => ({
    ContactDialog: ({ triggerLabel }: { triggerLabel: string }) => (
        <button type="button">{triggerLabel}</button>
    ),
}));
vi.mock('../CurrentYear', () => ({
    CurrentYear: () => <>2026</>,
}));
vi.mock('@/shared/ui/DotSeparator', () => ({
    DotSeparator: () => <span aria-hidden="true">·</span>,
}));
vi.mock('@/shared/lib/legal', () => ({
    INVESTMENT_DISCLAIMER: '투자 면책 고지 텍스트',
    PRIVACY_PATH: '/privacy',
    PRIVACY_TITLE: '개인정보처리방침',
    TERMS_PATH: '/terms',
    TERMS_TITLE: '이용약관',
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { Footer } from '../Footer';
import { ALL_NAV_REGION_LINKS } from '@/shared/config/assetClassNav';

describe('Footer', () => {
    it('renders the investment disclaimer', () => {
        render(<Footer />);

        expect(screen.getByText('투자 면책 고지 텍스트')).toBeInTheDocument();
    });

    it('renders the copyright with year', () => {
        render(<Footer />);

        expect(screen.getByText(/© 2026 Siglens/)).toBeInTheDocument();
    });

    it('renders the privacy policy link', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /개인정보처리방침/ });
        expect(link).toHaveAttribute('href', '/privacy');
    });

    it('renders the terms link', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /이용약관/ });
        expect(link).toHaveAttribute('href', '/terms');
    });

    it('renders the contact dialog trigger', () => {
        render(<Footer />);

        expect(
            screen.getByRole('button', { name: /문의하기/ })
        ).toBeInTheDocument();
    });

    it('has a navigation landmark for site info', () => {
        render(<Footer />);

        expect(
            screen.getByRole('navigation', { name: /사이트 정보/ })
        ).toBeInTheDocument();
    });

    it('renders the /economy link with 미국 경제 label', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /미국 경제/ });
        expect(link).toHaveAttribute('href', '/economy');
    });

    it('renders the US news link with its full label', () => {
        render(<Footer />);

        // `/news`는 3지역 상위 허브이고 미국 카테고리 목록은 `/news/us`가 잇는다.
        const link = screen.getByRole('link', { name: '미국 시장 뉴스' });
        expect(link).toHaveAttribute('href', '/news/us');
    });

    it('uses the full label for every region link, not the short one', () => {
        // 푸터는 버티컬 그룹핑 없이 평탄하게 나열한다 — 짧은 라벨(`미국`/`한국`)만
        // 쓰면 `미국 · 한국 · 미국 · 한국`이 되어 뜻을 잃는다.
        render(<Footer />);

        for (const region of ALL_NAV_REGION_LINKS) {
            const link = screen.getByRole('link', { name: region.fullLabel });
            expect(link).toHaveAttribute('href', region.href);
        }
    });

    /**
     * 저작권 표기가 `© 2026` / `Siglens` 두 줄로 쪼개졌다(2026-08-25 사용자 제보
     * 스크린샷). 오른쪽 nav가 링크 12개짜리 `flex-wrap`이라 `justify-between`
     * 아래에서 짧은 이 문단이 대신 밀린 것 — 줄바꿈은 긴 쪽(nav)이 감당해야 한다.
     */
    it('저작권 표기는 줄바꿈되지 않는다 (nav에 밀려 쪼개지던 회귀)', () => {
        const { container } = render(<Footer />);

        const copyright = Array.from(container.querySelectorAll('p')).find(el =>
            el.textContent?.includes('Siglens')
        );
        expect(copyright).toBeDefined();
        expect(copyright!.className).toContain('shrink-0');
        expect(copyright!.className).toContain('whitespace-nowrap');
    });

    it('exposes both market regions', () => {
        render(<Footer />);

        expect(
            screen.getByRole('link', { name: '미국 시장 분석' })
        ).toHaveAttribute('href', '/market');
        expect(
            screen.getByRole('link', { name: '한국 시장 분석' })
        ).toHaveAttribute('href', '/market/kr');
    });
});
