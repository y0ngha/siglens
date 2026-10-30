import { render, screen } from '@testing-library/react';
import { ProfileCard } from '@/widgets/fundamental/sections/ProfileCard';
import type { FundamentalProfile } from '@y0ngha/siglens-core';

const BASE: FundamentalProfile = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    marketCap: 3_000_000_000_000,
    ceo: 'Tim Cook',
    website: 'https://www.apple.com',
    description: null,
};

function renderProfile(overrides: Partial<FundamentalProfile>) {
    return render(
        <ProfileCard
            profile={{ ...BASE, ...overrides }}
            descriptionSlot={null}
        />
    );
}

describe('ProfileCard — 웹사이트·CEO 정규화', () => {
    it('스킴 없는 웹사이트는 https를 붙인 링크로 그린다', () => {
        renderProfile({ website: 'www.apple.com' });

        const link = screen.getByRole('link', { name: 'www.apple.com' });
        expect(link).toHaveAttribute('href', 'https://www.apple.com');
    });

    it('표시 텍스트에서 스킴을 뗀다', () => {
        renderProfile({ website: 'http://example.com' });

        expect(
            screen.getByRole('link', { name: 'example.com' })
        ).toHaveAttribute('href', 'http://example.com');
    });

    it.each(['javascript:alert(1)', 'mailto:ir@apple.com', '   ', ''])(
        'http(s)가 아니거나 빈 웹사이트(%j)는 행을 숨긴다',
        website => {
            renderProfile({ website });

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        }
    );

    it.each(['', '   '])('빈 CEO(%j)는 행을 숨긴다', ceo => {
        renderProfile({ ceo });

        expect(screen.queryByText('CEO')).not.toBeInTheDocument();
    });

    it('CEO 이름은 공백을 다듬어 그린다', () => {
        renderProfile({ ceo: '  Tim Cook ' });

        expect(screen.getByText('Tim Cook')).toBeInTheDocument();
    });
});
