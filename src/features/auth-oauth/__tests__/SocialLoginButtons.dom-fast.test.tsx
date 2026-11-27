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

    it('기본값은 위쪽 구분선을 그린다(로그인 화면은 폼 아래에 붙는다)', () => {
        const { container } = render(<SocialLoginButtons />);
        expect(container.querySelectorAll('div.border-t').length).toBe(1);
    });

    it("divider='none'이면 위쪽 구분선을 그리지 않는다", () => {
        const { container } = render(<SocialLoginButtons divider="none" />);
        expect(container.querySelectorAll('div.border-t').length).toBe(0);
        expect(screen.getByText('Google로 계속하기')).toBeInTheDocument();
    });

    it('renders Google icon SVG', () => {
        render(<SocialLoginButtons />);
        const svg = document.querySelector('svg[aria-hidden]');
        expect(svg).not.toBeNull();
    });
});
