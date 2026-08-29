import { render, screen } from '@testing-library/react';
import { FearGreedHero } from '@/widgets/fear-greed/FearGreedHero';
import { FearGreedGauge } from '@/widgets/fear-greed/FearGreedGauge';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';

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

// SENTIMENT_LABEL_KEY는 실제 `shared.enumLabel` 카탈로그 키 문자열이다 —
// 이 값 자체를 mock으로 지어내면 실제 tLabel(useTranslations)이 조회에
// 실패해 MISSING_MESSAGE로 렌더된다.
vi.mock('@/shared/lib/fearGreedLabels', () => ({
    SENTIMENT_LABEL_KEY: {
        EXTREME_FEAR: 'fearGreed.extremeFear',
        FEAR: 'fearGreed.fear',
        NEUTRAL: 'fearGreed.neutral',
        GREED: 'fearGreed.greed',
        EXTREME_GREED: 'fearGreed.extremeGreed',
    },
}));

describe('Fear & Greed Interaction', () => {
    describe('FearGreedGauge', () => {
        it('renders gauge with score value', () => {
            render(<FearGreedGauge score={45} label="FEAR" size="hero" />);
            expect(screen.getByText('45')).toBeInTheDocument();
        });

        it('renders gauge at mini size', () => {
            render(
                <FearGreedGauge
                    score={75}
                    label="GREED"
                    size="mini"
                    periodLabel="1주"
                />
            );
            expect(screen.getByText('75')).toBeInTheDocument();
            expect(screen.getByText('1주')).toBeInTheDocument();
        });

        it('renders extreme fear score', () => {
            render(
                <FearGreedGauge score={10} label="EXTREME_FEAR" size="hero" />
            );
            expect(screen.getByText('10')).toBeInTheDocument();
        });
    });

    describe('FearGreedHero', () => {
        it('renders hero with snapshot data', () => {
            const snapshot = {
                score: 50,
                label: 'NEUTRAL',
                confidence: 'normal',
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
