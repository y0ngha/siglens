// @vitest-environment jsdom
/**
 * Unit tests for `StrikeBarTooltip` — 공용 floating tooltip 셸.
 *
 * hoveredRow / tooltipPos null 조합별 hidden 속성과 CSS 변수 값을 검증한다.
 */
import { render } from '@testing-library/react';
import { StrikeBarTooltip } from '@/widgets/options/ui/StrikeBarTooltip';

vi.mock('@/widgets/options/utils/computeTooltipPos', () => ({
    TOOLTIP_MIN_WIDTH_PX: 180,
}));

const TOOLTIP_ID = 'test-tooltip';

describe('StrikeBarTooltip', () => {
    it('hoveredRow가 null이면 hidden 속성이 true여서 DOM에서 숨겨진다', () => {
        const { getByRole } = render(
            <StrikeBarTooltip
                id={TOOLTIP_ID}
                hoveredRow={null}
                tooltipPos={{ x: 100, y: 80 }}
            >
                <span>내용</span>
            </StrikeBarTooltip>
        );
        const tooltip = getByRole('tooltip', { hidden: true });
        expect(tooltip).toHaveAttribute('hidden');
    });

    it('tooltipPos가 null이면 hidden 속성이 true여서 DOM에서 숨겨진다', () => {
        const { getByRole } = render(
            <StrikeBarTooltip
                id={TOOLTIP_ID}
                hoveredRow={{ strike: 150 }}
                tooltipPos={null}
            >
                <span>내용</span>
            </StrikeBarTooltip>
        );
        const tooltip = getByRole('tooltip', { hidden: true });
        expect(tooltip).toHaveAttribute('hidden');
    });

    it('hoveredRow와 tooltipPos가 모두 non-null이면 hidden 속성이 없어 표시된다', () => {
        const { getByRole } = render(
            <StrikeBarTooltip
                id={TOOLTIP_ID}
                hoveredRow={{ strike: 150 }}
                tooltipPos={{ x: 100, y: 80 }}
            >
                <span>내용</span>
            </StrikeBarTooltip>
        );
        const tooltip = getByRole('tooltip', { hidden: true });
        expect(tooltip).not.toHaveAttribute('hidden');
    });

    it('표시 상태일 때 children이 렌더된다', () => {
        const { getByText } = render(
            <StrikeBarTooltip
                id={TOOLTIP_ID}
                hoveredRow={{ strike: 150 }}
                tooltipPos={{ x: 100, y: 80 }}
            >
                <span>툴팁 내용</span>
            </StrikeBarTooltip>
        );
        expect(getByText('툴팁 내용')).toBeInTheDocument();
    });

    it('hoveredRow가 null이면 children이 렌더되지 않는다', () => {
        const { queryByText } = render(
            <StrikeBarTooltip
                id={TOOLTIP_ID}
                hoveredRow={null}
                tooltipPos={{ x: 100, y: 80 }}
            >
                <span>숨겨진 내용</span>
            </StrikeBarTooltip>
        );
        expect(queryByText('숨겨진 내용')).not.toBeInTheDocument();
    });

    it('id prop이 tooltip 요소의 id 속성으로 설정된다', () => {
        const { getByRole } = render(
            <StrikeBarTooltip
                id="custom-tooltip-id"
                hoveredRow={{ strike: 150 }}
                tooltipPos={{ x: 50, y: 60 }}
            >
                <span>내용</span>
            </StrikeBarTooltip>
        );
        const tooltip = getByRole('tooltip', { hidden: true });
        expect(tooltip).toHaveAttribute('id', 'custom-tooltip-id');
    });

    it('CSS 변수 --tooltip-x / --tooltip-y가 tooltipPos 값으로 설정된다', () => {
        const { getByRole } = render(
            <StrikeBarTooltip
                id={TOOLTIP_ID}
                hoveredRow={{ strike: 150 }}
                tooltipPos={{ x: 123, y: 456 }}
            >
                <span>내용</span>
            </StrikeBarTooltip>
        );
        const tooltip = getByRole('tooltip', { hidden: true });
        expect(tooltip).toHaveStyle('--tooltip-x: 123px');
        expect(tooltip).toHaveStyle('--tooltip-y: 456px');
    });
});
