import { render, screen } from '@testing-library/react';
import { SocialLoginButtons } from '@/features/auth-oauth/ui/SocialLoginButtons';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

describe('SocialLoginButtons', () => {
    it('renders Google login button', () => {
        render(<SocialLoginButtons />);
        expect(screen.getByText('Google로 계속하기')).toBeInTheDocument();
    });

    it('links to Google OAuth start endpoint', () => {
        render(<SocialLoginButtons />);
        const link = screen.getByText('Google로 계속하기').closest('a');
        expect(link).toHaveAttribute('href', '/api/auth/google/start');
    });

    it('appends next query param when next prop is provided', () => {
        render(<SocialLoginButtons next="/premium" />);
        const link = screen.getByText('Google로 계속하기').closest('a');
        expect(link).toHaveAttribute(
            'href',
            '/api/auth/google/start?next=%2Fpremium'
        );
    });

    it('sets rel="nofollow" on provider links', () => {
        render(<SocialLoginButtons />);
        const link = screen.getByText('Google로 계속하기').closest('a');
        expect(link).toHaveAttribute('rel', 'nofollow');
    });

    /** 회귀: 라벨이 'Continue with Google' 영어 고정이라 로케일을 따르지 않았다. */
    it.each([
        ['en', 'Continue with Google'],
        ['ja', 'Googleで続行'],
        ['zh', '使用 Google 继续'],
    ] as const)('localizes the Google label for %s', (locale, label) => {
        renderWithIntl(<SocialLoginButtons />, { locale });
        expect(screen.getByText(label).closest('a')).toHaveAttribute(
            'href',
            '/api/auth/google/start'
        );
    });

    it('renders Google icon SVG', () => {
        render(<SocialLoginButtons />);
        const svg = document.querySelector('svg[aria-hidden]');
        expect(svg).not.toBeNull();
    });
});
