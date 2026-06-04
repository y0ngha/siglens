import { render, screen } from '@testing-library/react';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import {
    BriefingCard,
    BriefingLoadingCard,
    BriefingErrorCard,
} from '@/widgets/dashboard/BriefingCard';

const BRIEFING: MarketBriefingResponse = {
    summary: 'Markets rallied today',
    dominantThemes: ['AI', 'Earnings'],
    sectorAnalysis: {
        leadingSectors: ['XLK', 'XLF'],
        laggingSectors: ['XLE'],
        performanceDescription: 'Tech led the way',
    },
    volatilityAnalysis: { vixLevel: 14.5, description: 'Low volatility' },
    riskSentiment: 'Risk on mode',
};

describe('BriefingCard', () => {
    it('renders summary text', () => {
        render(
            <BriefingCard
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('Markets rallied today')).toBeInTheDocument();
    });

    it('renders dominant themes as badges', () => {
        render(
            <BriefingCard
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('AI')).toBeInTheDocument();
        expect(screen.getByText('Earnings')).toBeInTheDocument();
    });

    it('renders leading and lagging sectors', () => {
        render(
            <BriefingCard
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('XLK·XLF')).toBeInTheDocument();
        expect(screen.getByText('XLE')).toBeInTheDocument();
    });

    it('renders VIX level', () => {
        render(
            <BriefingCard
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText(/VIX 14\.50/)).toBeInTheDocument();
    });

    it('renders risk sentiment', () => {
        render(
            <BriefingCard
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('Risk on mode')).toBeInTheDocument();
    });

    it('renders generated date in KST', () => {
        render(
            <BriefingCard
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText(/기준/)).toBeInTheDocument();
    });

    it('hides timestamp when generatedAt is empty string', () => {
        render(<BriefingCard briefing={BRIEFING} generatedAt="" />);
        expect(screen.queryByText(/기준/)).not.toBeInTheDocument();
    });

    it('hides timestamp when generatedAt is invalid date string', () => {
        render(<BriefingCard briefing={BRIEFING} generatedAt="not-a-date" />);
        expect(screen.queryByText(/기준/)).not.toBeInTheDocument();
    });

    it('hides summary when empty', () => {
        const briefing: MarketBriefingResponse = {
            ...BRIEFING,
            summary: '',
        };
        render(
            <BriefingCard
                briefing={briefing}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(
            screen.queryByText('Markets rallied today')
        ).not.toBeInTheDocument();
    });
});

describe('BriefingLoadingCard', () => {
    it('renders loading state with status role', () => {
        render(<BriefingLoadingCard />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/브리핑 생성 중/)).toBeInTheDocument();
    });
});

describe('BriefingErrorCard', () => {
    it('renders error state with alert role', () => {
        render(<BriefingErrorCard />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument();
    });
});
