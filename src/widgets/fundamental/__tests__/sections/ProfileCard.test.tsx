import { render, screen } from '@testing-library/react';
import { ProfileCard } from '@/widgets/fundamental/sections/ProfileCard';
import type { FundamentalProfile } from '@y0ngha/siglens-core';
import { koMessage } from '@/shared/test-utils/koMessage';

const SAMPLE_PROFILE: FundamentalProfile = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    marketCap: 3_000_000_000_000,
    ceo: 'Tim Cook',
    website: 'https://www.apple.com',
    description: 'Apple designs consumer electronics.',
};

describe('ProfileCard', () => {
    it('renders company name and metadata when profile is provided', () => {
        render(
            <ProfileCard
                profile={SAMPLE_PROFILE}
                descriptionSlot={<p>설명</p>}
            />
        );
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        expect(screen.getByText('(AAPL)')).toBeInTheDocument();
        expect(screen.getByText('Tim Cook')).toBeInTheDocument();
    });

    it('renders empty state heading and message when profile is null', () => {
        render(
            <ProfileCard
                profile={null}
                descriptionSlot={<p data-testid="slot">slot</p>}
            />
        );
        expect(
            screen.getByRole('heading', { name: '회사 프로필' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                koMessage('widgets.financials.section.emptySection')
            )
        ).toBeInTheDocument();
    });

    it('omits industry separator when industry is empty string', () => {
        const profile: FundamentalProfile = {
            ...SAMPLE_PROFILE,
            industry: '',
        };
        render(<ProfileCard profile={profile} descriptionSlot={<p>설명</p>} />);
        // Should show sector without trailing " / ..."
        expect(screen.getByText('Technology')).toBeInTheDocument();
        expect(screen.queryByText(/\//)).not.toBeInTheDocument();
    });

    it('hides CEO and website when they are null', () => {
        const profile: FundamentalProfile = {
            ...SAMPLE_PROFILE,
            ceo: null,
            website: null,
        };
        render(<ProfileCard profile={profile} descriptionSlot={<p>설명</p>} />);
        expect(screen.queryByText('Tim Cook')).not.toBeInTheDocument();
        expect(screen.queryByText('apple.com')).not.toBeInTheDocument();
    });

    it('still renders descriptionSlot in empty state (tree shape stability)', () => {
        render(
            <ProfileCard
                profile={null}
                descriptionSlot={<p data-testid="slot">slot</p>}
            />
        );
        expect(screen.getByTestId('slot')).toBeInTheDocument();
    });

    it('한국 상장 종목은 시가총액을 US$가 아닌 원화(₩)로 렌더한다 (뮤테이션 감사: profile.symbol → "AAPL" 생존자)', () => {
        // 이 PR이 고친 정확한 버그: `시가총액 US$1802.5조`. formatCompactCurrency는
        // profile.symbol에서 통화를 유도하므로, 그 배선이 끊기면(symbol이 항상
        // 'AAPL'로 하드코딩되면) 이 테스트가 실패해야 한다.
        const profile: FundamentalProfile = {
            ...SAMPLE_PROFILE,
            symbol: '005930.KS',
            companyName: 'Samsung Electronics',
        };
        render(<ProfileCard profile={profile} descriptionSlot={<p>설명</p>} />);
        expect(screen.getByText('₩3조')).toBeInTheDocument();
        expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    });
});
