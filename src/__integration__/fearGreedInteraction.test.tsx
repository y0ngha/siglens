import { render, screen } from '@testing-library/react';
import { FearGreedHero } from '@/widgets/fear-greed/FearGreedHero';
import { FearGreedGauge } from '@/widgets/fear-greed/FearGreedGauge';
import type { FearGreedLabel, FearGreedSnapshot } from '@y0ngha/siglens-core';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL/fear-greed',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@/entities/fear-greed', () => ({
    FEAR_GREED_SCORE_BOUNDARIES: {
        EXTREME_FEAR_MAX: 25,
        FEAR_MAX: 45,
        NEUTRAL_MAX: 55,
        GREED_MAX: 75,
    },
}));

vi.mock('@/shared/lib/fearGreedLabels', () => ({
    SENTIMENT_LABEL_TEXT: {
        extreme_fear: '극도의 공포',
        fear: '공포',
        neutral: '중립',
        greed: '탐욕',
        extreme_greed: '극도의 탐욕',
    },
}));

describe('Fear & Greed Interaction', () => {
    describe('FearGreedGauge', () => {
        it('renders gauge with score value', () => {
            render(
                <FearGreedGauge
                    score={45}
                    label={'fear' as FearGreedLabel}
                    size="hero"
                />
            );
            expect(screen.getByText('45')).toBeInTheDocument();
        });

        it('renders gauge at mini size', () => {
            render(
                <FearGreedGauge
                    score={75}
                    label={'greed' as FearGreedLabel}
                    size="mini"
                    periodLabel="1주"
                />
            );
            expect(screen.getByText('75')).toBeInTheDocument();
            expect(screen.getByText('1주')).toBeInTheDocument();
        });

        it('renders extreme fear score', () => {
            render(
                <FearGreedGauge
                    score={10}
                    label={'extreme_fear' as FearGreedLabel}
                    size="hero"
                />
            );
            expect(screen.getByText('10')).toBeInTheDocument();
        });
    });

    describe('FearGreedHero', () => {
        it('renders hero with snapshot data', () => {
            const snapshot = {
                score: 50,
                label: 'neutral' as FearGreedLabel,
                confidence: 'high',
                groups: [],
                sampleSize: 100,
                warning: null,
            } as unknown as FearGreedSnapshot;
            render(<FearGreedHero snapshot={snapshot} />);
            const matches = screen.getAllByText('50');
            expect(matches.length).toBeGreaterThanOrEqual(1);
        });
    });
});
