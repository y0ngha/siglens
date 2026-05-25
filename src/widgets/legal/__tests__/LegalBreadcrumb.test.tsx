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
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { LegalBreadcrumb } from '../LegalBreadcrumb';

describe('LegalBreadcrumb', () => {
    it('renders a breadcrumb navigation', () => {
        render(<LegalBreadcrumb pageTitle="개인정보처리방침" />);

        expect(
            screen.getByRole('navigation', { name: /breadcrumb/ })
        ).toBeInTheDocument();
    });

    it('renders the site name as a link to home', () => {
        render(<LegalBreadcrumb pageTitle="이용약관" />);

        const homeLink = screen.getByRole('link', { name: /Siglens/ });
        expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders the current page title with aria-current', () => {
        render(<LegalBreadcrumb pageTitle="이용약관" />);

        const currentItem = screen.getByText('이용약관');
        expect(currentItem.closest('li')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('renders a separator between items', () => {
        render(<LegalBreadcrumb pageTitle="개인정보처리방침" />);

        expect(screen.getByText('/')).toBeInTheDocument();
    });
});
