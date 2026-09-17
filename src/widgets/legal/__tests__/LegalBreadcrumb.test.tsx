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

import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../messages/ko.json';
import { LegalBreadcrumb } from '../LegalBreadcrumb';
import { SITE_NAME } from '@/shared/lib/seo';

const NAV_LABEL = messages.shared.ui.Breadcrumb['46c31f'];

function renderCrumb(pageTitle: string) {
    render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <LegalBreadcrumb pageTitle={pageTitle} />
        </NextIntlClientProvider>
    );
}

describe('LegalBreadcrumb', () => {
    it('renders a breadcrumb navigation', () => {
        renderCrumb('개인정보처리방침');

        expect(
            screen.getByRole('navigation', { name: NAV_LABEL })
        ).toBeInTheDocument();
    });

    it('renders the site name as a link to home', () => {
        renderCrumb('이용약관');

        const homeLink = screen.getByRole('link', { name: SITE_NAME });
        expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders the current page title with aria-current', () => {
        renderCrumb('이용약관');

        const currentItem = screen.getByText('이용약관');
        expect(currentItem.closest('li')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('renders a separator between items', () => {
        renderCrumb('개인정보처리방침');

        expect(screen.getByText('/')).toBeInTheDocument();
    });
});
