import { render, screen } from '@testing-library/react';

vi.mock('@/app/reset-password/ResetPasswordContent', () => ({
    ResetPasswordContent: () => <div data-testid="reset-password-content" />,
}));
vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: ({
        title,
        subtitle,
        children,
        footer,
    }: {
        title: string;
        subtitle: string;
        children: React.ReactNode;
        footer?: React.ReactNode;
    }) => (
        <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {children}
            {footer}
        </div>
    ),
}));
vi.mock('@/shared/ui/auth/AuthFormSkeleton', () => ({
    AuthFormSkeleton: ({ rows }: { rows?: number }) => (
        <div data-testid="skeleton" data-rows={rows} />
    ),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
    }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={href}>{children}</a>,
}));

import ResetPasswordPage from '@/app/reset-password/page';

describe('ResetPasswordPage render', () => {
    it('renders the page shell with title and subtitle', () => {
        render(<ResetPasswordPage />);
        expect(
            screen.getByRole('heading', { name: '새 비밀번호 설정' })
        ).toBeInTheDocument();
        expect(
            screen.getByText('이전 비밀번호와 다른 값으로 설정해주세요')
        ).toBeInTheDocument();
    });

    it('renders the ResetPasswordContent within a Suspense boundary', () => {
        render(<ResetPasswordPage />);
        expect(
            screen.getByTestId('reset-password-content')
        ).toBeInTheDocument();
    });

    it('renders the forgot-password link in the footer', () => {
        render(<ResetPasswordPage />);
        const link = screen.getByRole('link', {
            name: '재설정 링크 다시 받기 →',
        });
        expect(link).toHaveAttribute('href', '/forgot-password');
    });
});
