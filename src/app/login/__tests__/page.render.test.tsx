import { render, screen } from '@testing-library/react';

vi.mock('@/app/login/LoginContent', () => ({
    LoginContent: () => <div data-testid="login-content" />,
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

import LoginPage from '@/app/login/page';

describe('LoginPage render', () => {
    it('renders the page shell with title and subtitle', () => {
        render(<LoginPage />);
        expect(
            screen.getByRole('heading', { name: '다시 만나서 반가워요' })
        ).toBeInTheDocument();
        expect(
            screen.getByText('이메일과 비밀번호로 로그인')
        ).toBeInTheDocument();
    });

    it('renders the LoginContent within a Suspense boundary', () => {
        render(<LoginPage />);
        expect(screen.getByTestId('login-content')).toBeInTheDocument();
    });

    it('renders the forgot-password link in the footer', () => {
        render(<LoginPage />);
        const link = screen.getByRole('link', {
            name: '비밀번호를 잊으셨나요?',
        });
        expect(link).toHaveAttribute('href', '/forgot-password');
    });

    it('renders the signup link in the footer', () => {
        render(<LoginPage />);
        const link = screen.getByRole('link', { name: '회원가입 →' });
        expect(link).toHaveAttribute('href', '/signup');
    });
});
