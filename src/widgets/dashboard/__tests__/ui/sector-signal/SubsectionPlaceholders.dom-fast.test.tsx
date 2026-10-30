import { render } from '@testing-library/react';
import { SubsectionPlaceholders } from '@/widgets/dashboard/ui/sector-signal/SubsectionPlaceholders';
import { SUBSECTION_IDS } from '@/widgets/dashboard/utils/sectorSignalStocks';
import {
    PLACEHOLDER_CARD_COUNT,
    SIGNAL_CARD_GRID_CLASS,
} from '@/widgets/dashboard/utils/signalCardGrid';

describe('SubsectionPlaceholders', () => {
    it('장식 블록이라 통째로 스크린리더에서 숨긴다', () => {
        const { container } = render(<SubsectionPlaceholders />);
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('실제 패널의 소절 수(5)만큼 자리를 잡는다', () => {
        const { container } = render(<SubsectionPlaceholders />);
        expect(SUBSECTION_IDS).toHaveLength(5);
        expect(container.querySelectorAll('.border-t')).toHaveLength(5);
    });

    it('소절마다 카드 한 줄(5장) 자리를 잡는다', () => {
        const { container } = render(<SubsectionPlaceholders />);
        expect(PLACEHOLDER_CARD_COUNT).toBe(5);
        for (const section of container.querySelectorAll('.border-t')) {
            expect(section.querySelectorAll('.h-\\[120px\\]')).toHaveLength(5);
        }
    });

    /**
     * 실제 소절의 카드 그리드는 xl에서 5열이다. 자리 표시가 4열에서 멈추면 xl 폭에서
     * 조회가 끝나는 순간 열 수가 바뀌어 카드 높이와 위치가 달라진다.
     */
    it('실제 소절과 같은 반응형 그리드 클래스를 쓴다', () => {
        const { container } = render(<SubsectionPlaceholders />);
        const grids = container.querySelectorAll('.grid-cols-1');
        expect(grids).toHaveLength(5);
        for (const grid of grids) {
            expect(grid).toHaveClass(...SIGNAL_CARD_GRID_CLASS.split(' '));
            expect(grid).toHaveClass('xl:grid-cols-5');
        }
    });
});
