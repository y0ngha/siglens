vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/hooks/usePopoverToggle', () => ({
    usePopoverToggle: () => ({ isOpen: false, toggle: vi.fn() }),
}));
vi.mock('@/shared/ui/tabs', () => ({
    buildPanelId: (prefix: string, value: string) => `${prefix}-panel-${value}`,
    buildTabId: (prefix: string, value: string) => `${prefix}-tab-${value}`,
    TabsPill: ({
        tabs,
        activeTab,
        onChange,
    }: {
        tabs: { value: string; label: string }[];
        activeTab: string;
        onChange: (v: string) => void;
    }) => (
        <div role="tablist">
            {tabs.map(t => (
                <button
                    key={t.value}
                    role="tab"
                    aria-selected={activeTab === t.value}
                    onClick={() => onChange(t.value)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    ),
}));
vi.mock('../hooks/useSkillsShowcase', () => ({
    useSkillsShowcase: () => ({
        activeTab: 'all',
        showAll: false,
        baseId: 'skills',
        handleTabSelect: vi.fn(),
        toggleShowAll: vi.fn(),
    }),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';

import { SkillsShowcase, SkillsShowcaseSkeleton } from '../SkillsShowcase';

function makeSkill(
    name: string,
    type: SkillShowcaseItem['type'] = 'indicator_guide',
    confidenceWeight = 0.85
): SkillShowcaseItem {
    return {
        name,
        type,
        description: `${name} description`,
        confidenceWeight,
    };
}

describe('SkillsShowcase', () => {
    it('renders the heading', () => {
        render(<SkillsShowcase skills={[]} />);

        expect(
            screen.getByRole('heading', { name: /AI 분석 스킬/ })
        ).toBeInTheDocument();
    });

    it('renders skill cards with names and descriptions', () => {
        const skills = [makeSkill('RSI'), makeSkill('MACD')];
        render(<SkillsShowcase skills={skills} />);

        expect(screen.getAllByText('RSI').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('MACD').length).toBeGreaterThanOrEqual(1);
        expect(
            screen.getAllByText('RSI description').length
        ).toBeGreaterThanOrEqual(1);
    });

    it('renders confidence percentage', () => {
        const skills = [makeSkill('Bollinger', 'indicator_guide', 0.75)];
        render(<SkillsShowcase skills={skills} />);

        expect(screen.getAllByText('75%').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the tab list', () => {
        render(<SkillsShowcase skills={[]} />);

        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /전체/ })).toBeInTheDocument();
    });
});

describe('SkillsShowcaseSkeleton', () => {
    it('renders a loading section', () => {
        render(<SkillsShowcaseSkeleton />);

        const section = screen.getByLabelText(/AI 분석 스킬 불러오는 중/);
        expect(section).toHaveAttribute('aria-busy', 'true');
    });
});
