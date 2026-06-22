// useIsClamped(useLayoutEffect + ResizeObserver)가 SkillCard에서 호출되므로
// 파일 전역으로 ResizeObserver를 stub해 ReferenceError를 방지한다.
// scrollHeight/clientHeight은 SkillCard expand 테스트 내부에서 개별 stubClamp로 제어.
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
);

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
        expandedKey: null,
        baseId: 'skills',
        handleTabSelect: vi.fn(),
        toggleShowAll: vi.fn(),
        toggleExpanded: vi.fn(),
    }),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    HIGH_CONFIDENCE_WEIGHT,
    type SkillShowcaseItem,
} from '@y0ngha/siglens-core';

import {
    SkillCard,
    SkillsShowcase,
    SkillsShowcaseSkeleton,
} from '../SkillsShowcase';

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

describe('ConfidenceInfoTooltip copy', () => {
    it('does NOT say low-confidence skills are excluded', () => {
        render(<SkillsShowcase skills={[makeSkill('RSI')]} />);

        expect(document.body.textContent).not.toMatch(/분석에서 제외/);
    });

    it('says low-confidence skills are still reflected as supplementary', () => {
        render(<SkillsShowcase skills={[makeSkill('RSI')]} />);

        expect(document.body.textContent).toMatch(
            /낮은 점수도 분석에 보조적으로 반영/
        );
    });
});

describe('SkillCard confidence bar color', () => {
    function getBarEl(container: HTMLElement): HTMLElement {
        const bar = container.querySelector('[data-testid="confidence-bar"]');
        if (!bar) throw new Error('confidence-bar testid not found');
        return bar as HTMLElement;
    }

    it.each([
        [0.2, 'bg-secondary-500'],
        [0.49, 'bg-secondary-500'],
    ])('weight %f → bg-secondary-500 (low tier)', (weight, expected) => {
        const { container } = render(
            <SkillsShowcase
                skills={[makeSkill('X', 'indicator_guide', weight)]}
            />
        );
        expect(getBarEl(container).className).toContain(expected);
    });

    it.each([
        [0.5, 'bg-ui-warning'],
        [0.79, 'bg-ui-warning'],
    ])('weight %f → bg-ui-warning (medium tier)', (weight, expected) => {
        const { container } = render(
            <SkillsShowcase
                skills={[makeSkill('X', 'indicator_guide', weight)]}
            />
        );
        expect(getBarEl(container).className).toContain(expected);
    });

    it.each([
        [HIGH_CONFIDENCE_WEIGHT, 'bg-chart-bullish'],
        [1.0, 'bg-chart-bullish'],
    ])('weight %f → bg-chart-bullish (high tier)', (weight, expected) => {
        const { container } = render(
            <SkillsShowcase
                skills={[makeSkill('X', 'indicator_guide', weight)]}
            />
        );
        expect(getBarEl(container).className).toContain(expected);
    });
});

describe('SkillCard expand interaction', () => {
    const ORIGINAL = Object.getOwnPropertyDescriptors(HTMLElement.prototype);

    function stubClamp(clamped: boolean): void {
        // 접힘 상태에서 scrollHeight > clientHeight 이면 "펼침 가능"으로 판정됨.
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => (clamped ? 80 : 40),
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get: () => 40,
        });
    }

    beforeAll(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe = vi.fn();
                unobserve = vi.fn();
                disconnect = vi.fn();
            }
        );
    });

    afterAll(() => {
        vi.unstubAllGlobals();
        Object.defineProperties(HTMLElement.prototype, ORIGINAL);
    });

    it('is interactive (role=button, aria-expanded) when the description is clamped', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        expect(card).toHaveAttribute('aria-expanded', 'false');
    });

    it('is NOT interactive when the description fits (not clamped)', () => {
        stubClamp(false);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /RSI/ })).toBeNull();
    });

    it('reflects aria-expanded=true when expanded', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={true}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /RSI/ })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    it('calls onToggleExpand with the skill name on click', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        await user.click(screen.getByRole('button', { name: /RSI/ }));

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('does NOT toggle the card when the ⓘ confidence button is clicked', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        await user.click(
            screen.getByRole('button', { name: '신뢰도 점수 설명' })
        );

        expect(onToggle).not.toHaveBeenCalled();
    });

    it('toggles on Enter when the card itself is focused', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        card.focus();
        await user.keyboard('{Enter}');

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('toggles on Space when the card itself is focused', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        card.focus();
        await user.keyboard(' ');

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('does NOT toggle the card when the ⓘ button is activated via keyboard', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        const infoButton = screen.getByRole('button', {
            name: '신뢰도 점수 설명',
        });
        infoButton.focus();
        await user.keyboard('{Enter}');

        expect(onToggle).not.toHaveBeenCalled();
    });
});
