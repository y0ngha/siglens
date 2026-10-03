vi.mock('@/shared/ui/LocaleLink', () => ({
    LocaleLink: ({
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
vi.mock('@/widgets/legal/LegalBreadcrumb', () => ({
    LegalBreadcrumb: ({ pageTitle }: { pageTitle: string }) => (
        <nav data-testid="breadcrumb">{pageTitle}</nav>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LegalUnavailable } from '@/widgets/legal/LegalUnavailable';

const LINKS = [
    { href: '/terms', label: '이용약관' },
    { href: '/privacy', label: '개인정보처리방침' },
] as const;

function renderUnavailable() {
    render(
        <LegalUnavailable
            breadcrumbTitle="이용약관"
            eyebrow="TERMS OF SERVICE"
            title="이용약관"
            links={LINKS}
        />
    );
}

describe('LegalUnavailable', () => {
    it('문서 제목을 h1으로, 안내문을 role="status"로 낸다', () => {
        renderUnavailable();

        expect(
            screen.getByRole('heading', { level: 1, name: '이용약관' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('status', { name: '약관 불러오기 안내' })
        ).toHaveTextContent('약관 전문을 불러오는 중이에요');
    });

    it('두 문서로 가는 링크를 남긴다', () => {
        renderUnavailable();

        expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute(
            'href',
            '/terms'
        );
        expect(
            screen.getByRole('link', { name: '개인정보처리방침' })
        ).toHaveAttribute('href', '/privacy');
    });
});
