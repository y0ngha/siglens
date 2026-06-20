vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction: vi.fn().mockResolvedValue(undefined),
    ensureEconomicEventsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/economy/lib/resolveIndicatorLabels', () => ({
    resolveIndicatorLabels: vi.fn().mockResolvedValue({}),
}));

import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomicCalendarEventWithAnalysis } from '@/entities/economy/model';
import { EconomicCalendarGrid } from '@/widgets/economy/sections/EconomicCalendarGrid';

function ev(
    over: Partial<EconomicCalendarEventWithAnalysis> = {}
): EconomicCalendarEventWithAnalysis {
    return {
        date: '2026-06-20 08:30:00',
        event: 'Core CPI MoM (May)',
        impact: 'High',
        actual: 0.4,
        estimate: 0.3,
        previous: 0.2,
        unit: '%',
        sentiment: null,
        summaryKo: null,
        interpretationKo: null,
        analyzedAt: null,
        ...over,
    };
}

describe('EconomicCalendarGrid analysis display', () => {
    it('renders sentiment badge + summary + interpretation for an analyzed event', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({
                        sentiment: 'bullish',
                        summaryKo: 'CPI가 예상을 상회했어요.',
                        interpretationKo:
                            '인플레 우려로 금리 인하 기대가 후퇴할 수 있어요.',
                        analyzedAt: new Date('2026-06-20T13:00:00Z'),
                    }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.getByText('긍정')).toBeInTheDocument();
        expect(
            screen.getByText('CPI가 예상을 상회했어요.')
        ).toBeInTheDocument();
        expect(
            screen.getByText('인플레 우려로 금리 인하 기대가 후퇴할 수 있어요.')
        ).toBeInTheDocument();
    });

    it('renders no sentiment badge for a not-yet-analyzed announced event', () => {
        render(
            <EconomicCalendarGrid
                events={[ev({ sentiment: null, summaryKo: null })]}
                today="2026-06-20"
            />
        );
        expect(screen.queryByText('긍정')).not.toBeInTheDocument();
        expect(screen.queryByText('중립')).not.toBeInTheDocument();
        expect(screen.queryByText('부정')).not.toBeInTheDocument();
    });

    it('renders no analysis block for an unannounced event (actual null)', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({ actual: null, sentiment: null, summaryKo: null }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.queryByText('부정')).not.toBeInTheDocument();
    });
});
