vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction: vi.fn().mockResolvedValue(undefined),
    ensureEconomicEventsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
}));

import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomicCalendarEventWithAnalysis } from '@/entities/economy/model';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
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

    it('renders badge and summary but not interpretation when interpretationKo is null', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({
                        sentiment: 'bearish',
                        summaryKo: '요약입니다.',
                        interpretationKo: null,
                        analyzedAt: new Date('2026-06-20T13:00:00Z'),
                    }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.getByText('부정')).toBeInTheDocument();
        expect(screen.getByText('요약입니다.')).toBeInTheDocument();
        // interpretation paragraph must be absent — this text only appears in the positive-test fixture
        expect(
            screen.queryByText(
                '인플레 우려로 금리 인하 기대가 후퇴할 수 있어요.'
            )
        ).not.toBeInTheDocument();
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

    // C1 guard: empty summaryKo (pre-fix DB row) must NOT render a badge over blank content.
    it('renders no sentiment badge when summaryKo is an empty string (C1 guard)', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({
                        sentiment: 'neutral',
                        summaryKo: '',
                        interpretationKo: null,
                        analyzedAt: new Date('2026-06-20T13:00:00Z'),
                    }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.queryByText('중립')).not.toBeInTheDocument();
    });

    // C1 guard: whitespace-only summaryKo must also not render.
    it('renders no sentiment badge when summaryKo is whitespace-only (C1 guard)', () => {
        render(
            <EconomicCalendarGrid
                events={[
                    ev({
                        sentiment: 'bullish',
                        summaryKo: '   ',
                        interpretationKo: null,
                        analyzedAt: new Date('2026-06-20T13:00:00Z'),
                    }),
                ]}
                today="2026-06-20"
            />
        );
        expect(screen.queryByText('긍정')).not.toBeInTheDocument();
    });
});

function baseEvent(eventName: string): EconomicCalendarEvent {
    return {
        date: '2026-06-20 08:30:00',
        event: eventName,
        impact: 'High',
        actual: null,
        estimate: 1,
        previous: 1,
        unit: '%',
    };
}

describe('EconomicCalendarGrid — displayEventLabel prototype-pollution guard (I5)', () => {
    it('renders the literal "toString" event name when labels map does not contain it', () => {
        // "toString" exists on Object.prototype — `labels["toString"]` would return a
        // function without the Object.hasOwn guard, potentially crashing the renderer.
        render(
            <EconomicCalendarGrid
                events={[baseEvent('toString')]}
                today="2026-06-20"
                labels={{}}
            />
        );
        expect(screen.getByText('toString')).toBeInTheDocument();
    });

    it('renders the literal "constructor" event name when labels map does not contain it', () => {
        render(
            <EconomicCalendarGrid
                events={[baseEvent('constructor')]}
                today="2026-06-20"
                labels={{}}
            />
        );
        expect(screen.getByText('constructor')).toBeInTheDocument();
    });
});
