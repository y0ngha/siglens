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
import koMessages from '../../../../messages/ko.json';
import { LegalUnavailable } from '@/widgets/legal/LegalUnavailable';

const LEGAL_MESSAGES = koMessages.widgets.legal;

const LINKS = [
    { href: '/terms', label: '이용약관' },
    { href: '/privacy', label: '개인정보처리방침' },
] as const;

function renderUnavailable(title = '이용약관', eyebrow = 'TERMS OF SERVICE') {
    render(
        <LegalUnavailable
            breadcrumbTitle={title}
            eyebrow={eyebrow}
            title={title}
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
            screen.getByRole('status', {
                name: LEGAL_MESSAGES.unavailableNoticeLabel,
            })
        ).toHaveTextContent(LEGAL_MESSAGES.unavailableNotice);
    });

    it('개인정보처리방침에서도 안내문이 "약관"이라 부르지 않는다', () => {
        // 같은 안내가 /privacy에도 나가므로 문서 종류를 특정하는 낱말을 쓰면 안 된다.
        renderUnavailable('개인정보처리방침', 'PRIVACY POLICY');

        const status = screen.getByRole('status', {
            name: LEGAL_MESSAGES.unavailableNoticeLabel,
        });
        expect(status).toHaveAccessibleName('문서 불러오기 안내');
        expect(status).toHaveTextContent(
            '문서 전문을 불러오는 중이에요. 잠시 후 이 페이지를 다시 열어 주세요.'
        );
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
