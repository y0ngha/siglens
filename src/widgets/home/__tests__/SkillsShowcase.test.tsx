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
vi.mock('@/shared/ui/tabs/utils/tabIds', () => ({
    buildPanelId: (prefix: string, value: string) => `${prefix}-panel-${value}`,
    buildTabId: (prefix: string, value: string) => `${prefix}-tab-${value}`,
}));
vi.mock('@/shared/ui/tabs/TabsPill', () => ({
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
const { mockUseSkillsShowcase } = vi.hoisted(() => ({
    mockUseSkillsShowcase: vi.fn(() => ({
        activeTab: 'all',
        showAll: false,
        expandedKey: null,
        baseId: 'skills',
        handleTabSelect: vi.fn(),
        toggleShowAll: vi.fn(),
        toggleExpanded: vi.fn(),
    })),
}));
vi.mock('../hooks/useSkillsShowcase', () => ({
    useSkillsShowcase: mockUseSkillsShowcase,
}));

import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import koMessages from '../../../../messages/ko.json';
import enMessages from '../../../../messages/en.json';
import userEvent from '@testing-library/user-event';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';

import { SkillsShowcase } from '../SkillsShowcase';

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
    beforeEach(() => {
        mockUseSkillsShowcase.mockReturnValue({
            activeTab: 'all',
            showAll: false,
            expandedKey: null,
            baseId: 'skills',
            handleTabSelect: vi.fn(),
            toggleShowAll: vi.fn(),
            toggleExpanded: vi.fn(),
        });
    });

    it('renders the heading', () => {
        render(<SkillsShowcase skills={[]} />);

        expect(
            screen.getByRole('heading', { name: /AI 분석 스킬/ })
        ).toBeInTheDocument();
    });

    /**
     * 홈은 스킬 표시명의 **최대 노출 지점**이다 — 스킬명은 `skills/**.md`
     * front-matter의 한국어 이름이라, 카탈로그 조회가 빠지면 비-기본 로케일 홈이
     * 통째로 한국어로 렌더된다. 비-기본 로케일로 확인한다.
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
     * 이름만 카탈로그로 옮기고 설명을 안 옮기면 "영어 제목 + 한국어 본문"이 된다.
     * 본문은 front-matter `description`이 아니라
     * **이름으로 찾는 한 줄 요약**(`shared.skillSummary`)이다.
     */
    it('en: 스킬 설명 자리에 front-matter 원문 대신 영어 요약이 나온다', () => {
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
                enMessages.shared.skillSummary['다중 시간대 분석']
            ).length
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.queryByText(/상위 시간대에서 추세 방향을/)
        ).not.toBeInTheDocument();
    });

    /**
     * 영문 이름 스킬(캔들 패턴 19 + 지표 35)은 한국어 페이지에서 **영어 제목 + 영어 본문**
     * ("… interpretation guide with Bulkowski measured rates")으로 나갔다. 표시명과 한 줄
     * 요약이 모두 한국어여야 하고, 모델용 영어 원문은 화면에 없어야 한다.
     */
    it('ko: 영문 이름 스킬도 한국어 표시명과 한국어 요약으로 나온다', () => {
        const skill: SkillShowcaseItem = {
            name: 'Bearish Engulfing Guide',
            type: 'candlestick',
            description:
                'Bearish Engulfing two-candle reversal interpretation guide with Bulkowski measured rates',
            confidenceWeight: 0.8,
        };
        renderWithIntl(<SkillsShowcase skills={[skill]} />, { locale: 'ko' });

        expect(
            screen.getAllByText('하락 장악형').length
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.getAllByText(
                koMessages.shared.skillSummary['Bearish Engulfing Guide']
            ).length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText(/Bulkowski/)).not.toBeInTheDocument();
        expect(
            screen.queryByText('Bearish Engulfing Guide')
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

    it('renders no type badge for a skill with type === undefined', () => {
        const skill: SkillShowcaseItem = {
            name: '무타입 스킬',
            type: undefined,
            description: 'desc',
            confidenceWeight: 0.6,
        };
        render(<SkillsShowcase skills={[skill]} />);

        // The card renders, but its name/badge row holds only the name span —
        // no type-badge span next to it.
        const nameSpan = screen.getAllByText('무타입 스킬')[0]!;
        const badgeRow = nameSpan.parentElement!;
        expect(badgeRow.children).toHaveLength(1);
    });

    it('shows a "더보기" button with the remaining count when a panel has more than the initial visible count', () => {
        const skills = Array.from({ length: 14 }, (_, i) =>
            makeSkill(`skill-${i}`)
        );
        render(<SkillsShowcase skills={skills} />);

        expect(
            screen.getByRole('button', { name: '더 보기 (2개)' })
        ).toBeInTheDocument();
    });

    it('does not show a "더보기" button when a panel has 12 or fewer skills', () => {
        const skills = Array.from({ length: 12 }, (_, i) =>
            makeSkill(`skill-${i}`)
        );
        render(<SkillsShowcase skills={skills} />);

        expect(
            screen.queryByRole('button', { name: /더 보기/ })
        ).not.toBeInTheDocument();
    });

    it('shows "접기" instead of "더보기" once showAll is true', () => {
        mockUseSkillsShowcase.mockReturnValue({
            activeTab: 'all',
            showAll: true,
            expandedKey: null,
            baseId: 'skills',
            handleTabSelect: vi.fn(),
            toggleShowAll: vi.fn(),
            toggleExpanded: vi.fn(),
        });
        const skills = Array.from({ length: 14 }, (_, i) =>
            makeSkill(`skill-${i}`)
        );
        render(<SkillsShowcase skills={skills} />);

        expect(
            screen.getByRole('button', { name: '접기' })
        ).toBeInTheDocument();
        // All 14 cards render, not just the first page.
        expect(screen.getAllByText('skill-13').length).toBeGreaterThanOrEqual(
            1
        );
    });

    it('clicking "더보기" calls toggleShowAll', async () => {
        const toggleShowAll = vi.fn();
        mockUseSkillsShowcase.mockReturnValue({
            activeTab: 'all',
            showAll: false,
            expandedKey: null,
            baseId: 'skills',
            handleTabSelect: vi.fn(),
            toggleShowAll,
            toggleExpanded: vi.fn(),
        });
        const user = userEvent.setup();
        const skills = Array.from({ length: 14 }, (_, i) =>
            makeSkill(`skill-${i}`)
        );
        render(<SkillsShowcase skills={skills} />);

        await user.click(screen.getByRole('button', { name: /더 보기/ }));
        expect(toggleShowAll).toHaveBeenCalledTimes(1);
    });

    it('섹션 끝에 전체 가이드 링크가 있다', () => {
        render(<SkillsShowcase skills={[]} />);

        expect(
            screen.getByRole('link', { name: '전체 가이드 보기' })
        ).toHaveAttribute('href', '/guide');
    });

    it('탭 패널 6개를 모두 DOM에 두되 활성 패널만 보인다', () => {
        render(<SkillsShowcase skills={[makeSkill('RSI')]} />);

        const panels = screen.getAllByRole('tabpanel', { hidden: true });
        expect(panels).toHaveLength(6);
        expect(
            panels.filter(panel => !panel.hasAttribute('hidden'))
        ).toHaveLength(1);
    });
});

/**
 * 신뢰도 안내 ⓘ는 카드 수와 무관하게 섹션에 **하나**다. 카드마다 달면 같은 안내문이
 * 카드 수만큼 HTML에 반복된다.
 */
describe('SkillsShowcase 신뢰도 안내 배치', () => {
    it('ⓘ 버튼이 카드 수와 무관하게 하나이고, 안내문은 열기 전에는 DOM에 없다', () => {
        render(
            <SkillsShowcase
                skills={[makeSkill('RSI'), makeSkill('MACD'), makeSkill('OBV')]}
            />
        );

        expect(
            screen.getAllByRole('button', { name: '신뢰도 점수 설명' })
        ).toHaveLength(1);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});
