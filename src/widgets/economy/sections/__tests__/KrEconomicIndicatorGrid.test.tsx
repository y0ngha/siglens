import React from 'react';
import { render, screen } from '@testing-library/react';
import { KrEconomicIndicatorGrid } from '../KrEconomicIndicatorGrid';
import type { KrIndicatorCard } from '@/entities/economy/api/getKrIndicatorCards';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';

function meta(event: string) {
    const found = KR_ECONOMY_INDICATORS.find(m => m.event === event);
    if (!found) throw new Error(`unknown test indicator: ${event}`);
    return found;
}

function card(event: string, overrides: Partial<KrIndicatorCard> = {}) {
    return {
        meta: meta(event),
        latest: 2.8,
        latestDate: '2026-08-03',
        changeFromPrevious: -0.4,
        trend: [],
        ...overrides,
    } satisfies KrIndicatorCard;
}

describe('KrEconomicIndicatorGrid', () => {
    it('renders nothing when there are no cards', () => {
        // 제목만 남은 빈 섹션은 페이지를 얇게 만들 뿐이다.
        const { container } = render(<KrEconomicIndicatorGrid cards={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('groups cards under their category heading', () => {
        render(
            <KrEconomicIndicatorGrid
                cards={[
                    card('Interest Rate Decision'),
                    card('Unemployment Rate'),
                ]}
            />
        );

        expect(screen.getByText('금리')).toBeInTheDocument();
        expect(screen.getByText('고용')).toBeInTheDocument();
        // 발표 이력이 없는 카테고리는 제목도 나오지 않는다.
        expect(screen.queryByText('물가')).not.toBeInTheDocument();
    });

    it('formats the value at the declared precision with its unit', () => {
        render(
            <KrEconomicIndicatorGrid
                cards={[card('Interest Rate Decision', { latest: 2.75 })]}
            />
        );

        expect(screen.getByText('2.75')).toBeInTheDocument();
        expect(screen.getAllByText('%').length).toBeGreaterThan(0);
    });

    it('shows the change against the previous announcement', () => {
        render(
            <KrEconomicIndicatorGrid
                cards={[
                    card('Inflation Rate YoY', { changeFromPrevious: -0.4 }),
                ]}
            />
        );

        expect(screen.getByText(/직전 발표 대비/)).toHaveTextContent('-0.4%');
    });

    it('omits the change line when there is no prior announcement', () => {
        render(
            <KrEconomicIndicatorGrid
                cards={[
                    card('Inflation Rate YoY', { changeFromPrevious: null }),
                ]}
            />
        );

        expect(screen.queryByText(/직전 발표 대비/)).not.toBeInTheDocument();
    });

    it('shows the announcement date', () => {
        render(
            <KrEconomicIndicatorGrid
                cards={[
                    card('Unemployment Rate', { latestDate: '2026-08-11' }),
                ]}
            />
        );

        expect(screen.getByText('2026-08-11')).toBeInTheDocument();
    });

    it('labels the section with a heading', () => {
        render(
            <KrEconomicIndicatorGrid cards={[card('Interest Rate Decision')]} />
        );

        expect(
            screen.getByRole('heading', { name: '경제지표' })
        ).toBeInTheDocument();
    });
});
