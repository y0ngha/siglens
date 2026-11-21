import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    // `AuthCrossLink`가 `next`를 읽어 링크에 이어 붙인다 — 셸 렌더 테스트도
    // 라우터 컨텍스트가 필요하다.
    useSearchParams: () => new URLSearchParams(),
}));
const { suspendRef } = vi.hoisted(() => ({ suspendRef: { value: false } }));
vi.mock('@/app/[locale]/signup/SignupContent', () => ({
    SignupContent: () => {
        // 영원히 끝나지 않는 Promise를 던져 Suspense fallback 상태를 만든다.
        if (suspendRef.value) throw new Promise<never>(() => {});
        return <div data-testid="signup-content" />;
    },
}));
vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: ({
        title,
        subtitle,
        subtitleClassName,
        children,
        footer,
    }: {
        title: string;
        subtitle: string;
        subtitleClassName?: string;
        children: React.ReactNode;
        footer?: React.ReactNode;
    }) => (
        <div>
            <h1>{title}</h1>
            <p data-testid="subtitle" className={subtitleClassName}>
                {subtitle}
            </p>
            {children}
            {footer}
        </div>
    ),
}));
vi.mock('@/shared/ui/auth/AuthFormSkeleton', () => ({
    AuthFormSkeleton: ({
        rows,
        leadingAction,
    }: {
        rows?: number;
        leadingAction?: boolean;
    }) => (
        <div
            data-testid="skeleton"
            data-rows={rows}
            data-leading-action={String(leadingAction === true)}
        />
    ),
}));
vi.mock('@/shared/lib/seo', () => ({
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

import SignupPage from '@/app/[locale]/signup/page';

describe('SignupPage render', () => {
    beforeEach(() => {
        suspendRef.value = false;
    });

    it('renders the page shell with title and subtitle', async () => {
        render(await SignupPage({ params: Promise.resolve({ locale: 'ko' }) }));
        expect(
            screen.getByRole('heading', {
                name: '회원이 되면 더 많은 걸 볼 수 있어요',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '가입은 무료예요. 가입하지 않아도 지금처럼 차트와 AI 분석을 볼 수 있어요.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByText('이메일로 시작하기')).not.toBeInTheDocument();
    });

    it('subtitle wraps anywhere so ja/zh text cannot overflow narrow screens', async () => {
        render(await SignupPage({ params: Promise.resolve({ locale: 'ko' }) }));
        expect(screen.getByTestId('subtitle')).toHaveClass('wrap-anywhere');
    });

    it('renders the member benefits outside the Suspense boundary', async () => {
        suspendRef.value = true;
        render(await SignupPage({ params: Promise.resolve({ locale: 'ko' }) }));
        expect(
            screen.getByRole('heading', { level: 2, name: '회원 혜택' })
        ).toBeInTheDocument();
        expect(screen.queryByTestId('signup-content')).not.toBeInTheDocument();
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveAttribute('data-rows', '1');
        expect(skeleton).toHaveAttribute('data-leading-action', 'true');
    });

    it('renders the SignupContent within a Suspense boundary', async () => {
        render(await SignupPage({ params: Promise.resolve({ locale: 'ko' }) }));
        expect(screen.getByTestId('signup-content')).toBeInTheDocument();
    });

    it('renders the login link in the footer', async () => {
        render(await SignupPage({ params: Promise.resolve({ locale: 'ko' }) }));
        const link = screen.getByRole('link', { name: '로그인 →' });
        expect(link).toHaveAttribute('href', '/login');
    });
});
