vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { OverallScenario } from '@y0ngha/siglens-core';

import { ScenarioAnalysis } from '../../sections/ScenarioAnalysis';

const SCENARIOS: OverallScenario[] = [
    {
        name: 'bullish',
        triggerConditionKo: '실적 호조',
        priceRangeKo: '$200-$220',
    },
    {
        name: 'bearish',
        triggerConditionKo: '매크로 리스크',
        priceRangeKo: '$150-$160',
    },
];

describe('ScenarioAnalysis', () => {
    it('renders nothing when scenarios is empty', () => {
        const { container } = render(<ScenarioAnalysis scenarios={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and scenario items', () => {
        render(<ScenarioAnalysis scenarios={SCENARIOS} />);

        expect(
            screen.getByRole('heading', { name: /시나리오 분석/ })
        ).toBeInTheDocument();
        expect(screen.getByText('강세')).toBeInTheDocument();
        expect(screen.getByText('약세')).toBeInTheDocument();
    });

    it('renders trigger conditions and price ranges', () => {
        render(<ScenarioAnalysis scenarios={SCENARIOS} />);

        expect(screen.getByText('실적 호조')).toBeInTheDocument();
        expect(screen.getByText('$200-$220')).toBeInTheDocument();
        expect(screen.getByText('매크로 리스크')).toBeInTheDocument();
        expect(screen.getByText('$150-$160')).toBeInTheDocument();
    });

    it('renders a list with the correct item count', () => {
        render(<ScenarioAnalysis scenarios={SCENARIOS} />);

        const list = screen.getByRole('list', { name: /시나리오 목록/ });
        expect(list).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(SCENARIOS.length);
    });
});
