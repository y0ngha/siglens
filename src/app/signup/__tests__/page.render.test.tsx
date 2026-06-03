import { render, screen } from '@testing-library/react';

vi.mock('@/app/signup/SignupContent', () => ({
    SignupContent: () => <div data-testid="signup-content" />,
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

import SignupPage from '@/app/signup/page';

describe('SignupPage render', () => {
    it('renders the page shell with title and subtitle', () => {
        render(<SignupPage />);
        expect(
            screen.getByRole('heading', {
                name: '회원이 되면 더 많은 걸 볼 수 있어요',
            })
        ).toBeInTheDocument();
        expect(screen.getByText('이메일로 시작하기')).toBeInTheDocument();
    });

    it('renders the SignupContent within a Suspense boundary', () => {
        render(<SignupPage />);
        expect(screen.getByTestId('signup-content')).toBeInTheDocument();
    });

    it('renders the login link in the footer', () => {
        render(<SignupPage />);
        const link = screen.getByRole('link', { name: '로그인 →' });
        expect(link).toHaveAttribute('href', '/login');
    });
});
