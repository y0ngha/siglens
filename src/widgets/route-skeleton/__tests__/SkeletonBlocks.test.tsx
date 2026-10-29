import { render } from '@testing-library/react';
import {
    SKELETON_BLOCK_RADIUS,
    SKELETON_LINE_WIDTHS,
} from '../model/barClasses';
import { SkeletonBlockView } from '../ui/blocks/SkeletonBlockView';
import { SkeletonCards } from '../ui/blocks/SkeletonCards';
import { SkeletonLines } from '../ui/blocks/SkeletonLines';

const children = (container: HTMLElement) =>
    Array.from(container.firstElementChild?.children ?? []);

describe('SkeletonLines', () => {
    it('줄 수만큼 막대를 그리고 폭을 네 단계로 번갈아 쓴다', () => {
        const { container } = render(<SkeletonLines count={5} />);
        const lines = children(container);

        expect(lines).toHaveLength(5);
        const [w0, w1, w2, w3] = SKELETON_LINE_WIDTHS;
        expect(
            lines.map((line, i) =>
                line.classList.contains([w0, w1, w2, w3, w0][i] ?? '')
            )
        ).toEqual([true, true, true, true, true]);
    });
});

describe('SkeletonCards', () => {
    it('격자 열 클래스 안에 같은 높이의 카드를 개수만큼 그린다', () => {
        const { container } = render(
            <SkeletonCards count={3} grid="grid-cols-3" card="h-24" />
        );
        const grid = container.firstElementChild as HTMLElement;

        expect(grid.className).toBe('grid gap-3 grid-cols-3');
        expect(children(container)).toHaveLength(3);
        expect(
            children(container).every(
                card =>
                    card.classList.contains('h-24') &&
                    card.classList.contains(SKELETON_BLOCK_RADIUS)
            )
        ).toBe(true);
    });
});

describe('SkeletonBlockView', () => {
    it('제목은 작은 반경, 패널은 카드 반경의 막대 하나다', () => {
        const title = render(
            <SkeletonBlockView block={{ type: 'title', className: 'h-8' }} />
        ).container.firstElementChild as HTMLElement;
        const panel = render(
            <SkeletonBlockView block={{ type: 'panel', className: 'h-64' }} />
        ).container.firstElementChild as HTMLElement;

        expect(title.classList.contains('h-8')).toBe(true);
        expect(title.classList.contains(SKELETON_BLOCK_RADIUS)).toBe(false);
        expect(title.children).toHaveLength(0);
        expect(panel.classList.contains('h-64')).toBe(true);
        expect(panel.classList.contains(SKELETON_BLOCK_RADIUS)).toBe(true);
    });

    it('문단·카드 블록은 개수만큼 자식을 그린다', () => {
        const lines = render(
            <SkeletonBlockView block={{ type: 'lines', count: 3 }} />
        ).container.firstElementChild as HTMLElement;
        const cards = render(
            <SkeletonBlockView
                block={{
                    type: 'cards',
                    count: 4,
                    grid: 'grid-cols-2',
                    card: 'h-10',
                }}
            />
        ).container.firstElementChild as HTMLElement;

        expect(lines.children).toHaveLength(3);
        expect(cards.children).toHaveLength(4);
        expect(cards.classList.contains('grid-cols-2')).toBe(true);
    });
});
