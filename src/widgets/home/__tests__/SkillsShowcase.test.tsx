// useIsClamped(useEffect + ResizeObserver)가 SkillCard에서 호출되므로
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
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
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

    /**
     * 홈은 이 표시명의 **최대 노출 지점**이다 — 스킬 카드 36장이 전부
     * `skills/**.md` front-matter의 한국어 이름이다. `AnalysisPanel`만 훅을
     * 붙이고 여기는 빠져 있어서, `/en`·`/ja` 홈에서 36개가 통째로 한국어로
     * 렌더됐다(실측). 비-기본 로케일로 확인한다.
     */
    it('en: 한국어 스킬명을 카탈로그로 표시한다', () => {
        renderWithIntl(
            <SkillsShowcase skills={[makeSkill('다이버전스 전략')]} />,
            { locale: 'en' }
        );

        expect(
            screen.getAllByText('Divergence Strategy').length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('다이버전스 전략')).not.toBeInTheDocument();
    });

    /**
     * 이름은 카탈로그로 옮겼는데 설명은 안 옮겨서 "영어 제목 + 한국어 본문"이
     * 남았던 결함(실측: `/en`·`/ja` 홈). 실제 스킬 md의 한국어 설명으로 확인한다.
     */
    it('en: 한국어 스킬 설명을 카탈로그로 표시한다', () => {
        const skill: SkillShowcaseItem = {
            name: '다중 시간대 분석',
            type: 'strategy',
            description:
                '상위 시간대에서 추세 방향을 확인하고 하위 시간대에서 최적의 진입 타이밍을 잡는 체계적 분석 프레임워크',
            confidenceWeight: 0.85,
        };
        renderWithIntl(<SkillsShowcase skills={[skill]} />, { locale: 'en' });

        // 'strategy' 타입 스킬은 'all' 탭과 'strategy' 탭 양쪽 패널에 렌더된다
        // (숨김 패널도 크롤러 접근성을 위해 DOM에 남긴다) — 개수만 확인한다.
        expect(
            screen.getAllByText(
                /confirms trend direction on a higher timeframe/
            ).length
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.queryByText(/상위 시간대에서 추세 방향을/)
        ).not.toBeInTheDocument();
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
