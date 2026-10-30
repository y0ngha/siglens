vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args.filter(a => typeof a === 'string' && a.length > 0).join(' '),
}));
vi.mock('../LegalBreadcrumb', () => ({
    LegalBreadcrumb: ({ pageTitle }: { pageTitle: string }) => (
        <nav data-testid="breadcrumb">{pageTitle}</nav>
    ),
}));

import { render, screen } from '@testing-library/react';

import { LOCALE_HREFLANG } from '@/shared/i18n/locales';
import { LegalPageShell } from '../LegalPageShell';

const BASE_PROPS = {
    breadcrumbTitle: '이용약관',
    eyebrow: 'TERMS OF SERVICE',
    title: '이용약관',
    intro: <span>서비스 이용 조건입니다.</span>,
    effectiveDate: '2025년 1월 1일',
    toc: [
        { id: 'section-1', label: '제1조 총칙' },
        { id: 'section-2', label: '제2조 정의' },
    ],
    bodyLocale: 'ko' as const,
    children: <p>약관 본문</p>,
};

describe('LegalPageShell', () => {
    it('renders the breadcrumb', () => {
        render(<LegalPageShell {...BASE_PROPS} />);

        expect(screen.getByTestId('breadcrumb')).toHaveTextContent('이용약관');
    });

    it('renders the eyebrow and title', () => {
        render(<LegalPageShell {...BASE_PROPS} />);

        expect(screen.getByText('TERMS OF SERVICE')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: /이용약관/ })
        ).toBeInTheDocument();
    });

    it('renders the effective date', () => {
        render(<LegalPageShell {...BASE_PROPS} />);

        expect(screen.getByText(/시행일: 2025년 1월 1일/)).toBeInTheDocument();
    });

    it('renders the table of contents with links', () => {
        render(<LegalPageShell {...BASE_PROPS} />);

        expect(
            screen.getByRole('navigation', { name: /목차/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /제1조 총칙/ })
        ).toHaveAttribute('href', '#section-1');
        expect(
            screen.getByRole('link', { name: /제2조 정의/ })
        ).toHaveAttribute('href', '#section-2');
    });

    it('renders children content', () => {
        render(<LegalPageShell {...BASE_PROPS} />);

        expect(screen.getByText('약관 본문')).toBeInTheDocument();
    });

    it('marks the TOC list and the body with the language the body is written in', () => {
        // /zh/terms가 번역 없이 한국어 원문을 내면 본문·목차 라벨은 한국어다.
        render(<LegalPageShell {...BASE_PROPS} bodyLocale="ko" />);

        expect(screen.getByRole('list')).toHaveAttribute(
            'lang',
            LOCALE_HREFLANG.ko
        );
        expect(screen.getByText('약관 본문').parentElement).toHaveAttribute(
            'lang',
            LOCALE_HREFLANG.ko
        );
    });

    it('uses the BCP-47 tag of the body locale (zh → zh-Hans)', () => {
        render(<LegalPageShell {...BASE_PROPS} bodyLocale="zh" />);

        expect(screen.getByRole('list')).toHaveAttribute(
            'lang',
            LOCALE_HREFLANG.zh
        );
        expect(screen.getByText('약관 본문').parentElement).toHaveAttribute(
            'lang',
            LOCALE_HREFLANG.zh
        );
    });

    it('gives the TOC its own top margin only when no notice sits above it', () => {
        const { rerender } = render(<LegalPageShell {...BASE_PROPS} />);
        expect(
            screen.getByRole('navigation', { name: /목차/ }).className
        ).toContain('mt-8');

        rerender(<LegalPageShell {...BASE_PROPS} topNotice={<div>Top</div>} />);
        expect(
            screen.getByRole('navigation', { name: /목차/ }).className
        ).not.toContain('mt-8');
    });

    it('renders topNotice and bottomNotice when provided', () => {
        render(
            <LegalPageShell
                {...BASE_PROPS}
                topNotice={<div data-testid="top-notice">Top</div>}
                bottomNotice={<div data-testid="bottom-notice">Bottom</div>}
            />
        );

        expect(screen.getByTestId('top-notice')).toBeInTheDocument();
        expect(screen.getByTestId('bottom-notice')).toBeInTheDocument();
    });
});
