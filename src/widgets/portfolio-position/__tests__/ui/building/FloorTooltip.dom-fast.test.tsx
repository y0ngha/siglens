import { render, screen } from '@testing-library/react';
import { FloorTooltip } from '@/widgets/portfolio-position/ui/building/FloorTooltip';

const ANCHOR = {
    top: 200,
    bottom: 230,
    left: 100,
    right: 160,
    width: 60,
    height: 30,
    x: 100,
    y: 200,
    toJSON: () => ({}),
} as DOMRect;

const CONTENT = { main: '메인 문구 $100~$120', qualifier: '보조 문구' };

describe('FloorTooltip', () => {
    it('document.body로 포털해 컨테이너 안에는 렌더하지 않는다', () => {
        const { container } = render(
            <FloorTooltip anchorRect={ANCHOR} content={CONTENT} />
        );

        const tooltip = screen.getByTestId('floor-tooltip');
        expect(container).not.toContainElement(tooltip);
        expect(tooltip.parentElement).toBe(document.body);
    });

    it('main·qualifier 문구를 보여주고 보조기기에는 숨긴다', () => {
        render(<FloorTooltip anchorRect={ANCHOR} content={CONTENT} />);

        const tooltip = screen.getByTestId('floor-tooltip');
        expect(tooltip).toHaveTextContent('메인 문구 $100~$120');
        expect(tooltip).toHaveTextContent('보조 문구');
        expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    });

    it('측정이 끝나면 invisible이 풀리고 visible이 된다', () => {
        render(<FloorTooltip anchorRect={ANCHOR} content={CONTENT} />);

        const tooltip = screen.getByTestId('floor-tooltip');
        expect(tooltip.className).toContain('visible');
        expect(tooltip.className).not.toContain('invisible');
    });

    it('측정한 위치를 CSS 변수로 싣는다', () => {
        render(<FloorTooltip anchorRect={ANCHOR} content={CONTENT} />);

        const tooltip = screen.getByTestId('floor-tooltip');
        expect(tooltip.style.getPropertyValue('--tt')).toMatch(
            /^-?\d+(\.\d+)?px$/
        );
        expect(tooltip.style.getPropertyValue('--tl')).toMatch(
            /^-?\d+(\.\d+)?px$/
        );
    });
});
