import { render, screen } from '@testing-library/react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';

vi.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- test mock
        return <img {...props} />;
    },
}));

vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));

describe('AuthCardShell', () => {
    it('renders the title', () => {
        render(<AuthCardShell title="Sign In">content</AuthCardShell>);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'Sign In'
        );
    });

    it('renders the subtitle when provided', () => {
        render(
            <AuthCardShell title="Sign In" subtitle="Welcome back">
                content
            </AuthCardShell>
        );
        expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });

    it('does not render subtitle when not provided', () => {
        render(<AuthCardShell title="Sign In">content</AuthCardShell>);
        expect(screen.queryByText('Welcome back')).not.toBeInTheDocument();
    });

    it('renders children', () => {
        render(
            <AuthCardShell title="Sign In">
                <span data-testid="child">Form here</span>
            </AuthCardShell>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
        render(
            <AuthCardShell title="Sign In" footer={<span>Footer</span>}>
                content
            </AuthCardShell>
        );
        expect(screen.getByText('Footer')).toBeInTheDocument();
    });

    it('does not render footer when not provided', () => {
        const { container } = render(
            <AuthCardShell title="Sign In">content</AuthCardShell>
        );
        expect(container.querySelector('footer')).toBeNull();
    });

    it('renders the site logo image', () => {
        const { container } = render(
            <AuthCardShell title="Sign In">content</AuthCardShell>
        );
        // alt="" makes the image role="presentation", so we query by tag
        const img = container.querySelector('img[src="/icon96.png"]');
        expect(img).toBeInTheDocument();
    });

    it('renders the site name', () => {
        render(<AuthCardShell title="Sign In">content</AuthCardShell>);
        expect(screen.getByText('Siglens')).toBeInTheDocument();
    });

    it('has a main landmark', () => {
        render(<AuthCardShell title="Sign In">content</AuthCardShell>);
        expect(screen.getByRole('main')).toBeInTheDocument();
    });
});
