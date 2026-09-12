import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/features/auth-logout/actions/logoutAction', () => ({
    logoutAction: vi.fn(),
}));
import { AiHeader } from '@/widgets/agent-chat/AiHeader';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

describe('AiHeader', () => {
    it('signed out: main-host login with a handoff next', () => {
        wrap(
            <AiHeader
                signedIn={false}
                siteUrl="https://siglens.io"
                localePrefix=""
                currentPath="/c/abc"
                onOpenSidebar={vi.fn()}
            />
        );
        const login = screen.getByRole('link', { name: /로그인/ });
        expect(login).toHaveAttribute(
            'href',
            'https://siglens.io/login?next=' +
                encodeURIComponent(
                    '/api/auth/handoff?to=ai&next=' +
                        encodeURIComponent('/c/abc')
                )
        );
    });

    it('signed in: main-host absolute account link and a logout button', () => {
        wrap(
            <AiHeader
                signedIn
                siteUrl="https://siglens.io"
                localePrefix="/en"
                currentPath="/"
                onOpenSidebar={vi.fn()}
            />
        );
        expect(screen.getByRole('link', { name: /계정/ })).toHaveAttribute(
            'href',
            'https://siglens.io/en/account'
        );
        expect(
            screen.getByRole('button', { name: /로그아웃/ })
        ).toBeInTheDocument();
        expect(screen.getAllByText('SiglensAI').length).toBeGreaterThan(0);
    });
});
