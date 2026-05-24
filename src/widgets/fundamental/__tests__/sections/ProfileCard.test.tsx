/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/widgets/fundamental/sections/EmptySectionCard';
import { ProfileCard } from '@/widgets/fundamental/sections/ProfileCard';
import type { FundamentalProfile } from '@y0ngha/siglens-core';

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
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
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
});
