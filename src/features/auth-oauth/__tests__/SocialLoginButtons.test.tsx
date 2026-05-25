import { render, screen } from '@testing-library/react';
import { SocialLoginButtons } from '@/features/auth-oauth/ui/SocialLoginButtons';

describe('SocialLoginButtons', () => {
    it('renders Google login button', () => {
        render(<SocialLoginButtons />);
        expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });

    it('links to Google OAuth start endpoint', () => {
        render(<SocialLoginButtons />);
        const link = screen.getByText('Continue with Google').closest('a');
        expect(link).toHaveAttribute('href', '/api/auth/google/start');
    });

    it('appends next query param when next prop is provided', () => {
        render(<SocialLoginButtons next="/premium" />);
        const link = screen.getByText('Continue with Google').closest('a');
        expect(link).toHaveAttribute(
            'href',
            '/api/auth/google/start?next=%2Fpremium'
        );
    });

    it('sets rel="nofollow" on provider links', () => {
        render(<SocialLoginButtons />);
        const link = screen.getByText('Continue with Google').closest('a');
        expect(link).toHaveAttribute('rel', 'nofollow');
    });

    it('renders Google icon SVG', () => {
        render(<SocialLoginButtons />);
        const svg = document.querySelector('svg[aria-hidden]');
        expect(svg).not.toBeNull();
    });
});
