import { render, screen } from '@testing-library/react';
import { OAuthAccountCard } from '@/features/auth-oauth-consent/ui/OAuthAccountCard';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

describe('OAuthAccountCard', () => {
    const baseProps = {
        provider: 'google' as const,
        email: 'new@example.com',
    };

    it('renders the profile email', () => {
        render(<OAuthAccountCard {...baseProps} />);
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
    });

    it('renders the brand label for a known provider', () => {
        render(<OAuthAccountCard {...baseProps} />);
        expect(screen.getByText('Google 계정으로 가입')).toBeInTheDocument();
    });

    it('falls back to the provider identifier when no label is defined', () => {
        render(
            <OAuthAccountCard
                {...baseProps}
                // SupportedOAuthProvider로 캐스트해 TS를 맞추고, 런타임의 `??` 폴백을 본다.
                provider={'unknown_provider' as 'google'}
            />
        );
        expect(
            screen.getByText('unknown_provider 계정으로 가입')
        ).toBeInTheDocument();
    });

    /**
     * 회귀: provider 이름과 번역 조각을 공백으로 이어 붙여, 영어에서
     * "Google Sign up with account"처럼 어순이 깨졌다. 이름은 문구 안의 자리표시자다.
     */
    it('places the provider name per the locale word order', () => {
        renderWithIntl(<OAuthAccountCard {...baseProps} />, { locale: 'en' });
        expect(
            screen.getByText('Sign up with your Google account')
        ).toBeInTheDocument();
    });

    it('renders the avatar image when avatarUrl is provided', () => {
        const { container } = render(
            <OAuthAccountCard
                {...baseProps}
                avatarUrl="https://example.com/avatar.png"
            />
        );
        // next/image는 장식용 alt=""인 <img>를 그리므로 태그로 찾는다.
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img).toHaveClass('rounded-full');
        expect(container.querySelector('div[aria-hidden="true"]')).toBeNull();
    });

    it('reserves the avatar slot with a placeholder when avatarUrl is absent', () => {
        const { container } = render(<OAuthAccountCard {...baseProps} />);
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('div[aria-hidden="true"]')).toHaveClass(
            'size-8',
            'rounded-full'
        );
    });

    it('renders the name when it is provided', () => {
        render(<OAuthAccountCard {...baseProps} name="Hong Gildong" />);
        expect(screen.getByText('Hong Gildong')).toBeInTheDocument();
    });

    it('omits the name line when name is absent', () => {
        const { container } = render(<OAuthAccountCard {...baseProps} />);
        expect(screen.queryByText('Hong Gildong')).toBeNull();
        // 이메일·provider 문구 두 줄만 남는다.
        expect(container.querySelectorAll('p')).toHaveLength(2);
    });
});
