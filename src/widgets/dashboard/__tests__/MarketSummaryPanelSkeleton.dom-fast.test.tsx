import { render, screen } from '@testing-library/react';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';
import { TEST_SCOPE } from './helpers/testScope';

describe('MarketSummaryPanelSkeleton', () => {
    it('renders an aria-busy section', () => {
        render(<MarketSummaryPanelSkeleton scope={TEST_SCOPE} />);
        const section = screen.getByLabelText('시장 현황 로딩 중');
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders skeleton placeholders for each market index', () => {
        const { container } = render(
            <MarketSummaryPanelSkeleton scope={TEST_SCOPE} />
        );
        const indexGrid = container.querySelector('.sm\\:grid-cols-4');
        expect(indexGrid?.children).toHaveLength(TEST_SCOPE.indices.length);
    });

    /**
     * 실제 패널의 섹터 그리드는 모바일 2열 → `sm` 이상에서 3·4열이다. 스켈레톤이 전
     * 폭에서 3·4열이면 모바일에서 로딩이 끝나는 순간 카드 높이가 바뀌어 화면이 밀린다.
     */
    it.each([
        ['sm:grid-cols-3', 3],
        ['sm:grid-cols-4', 4],
    ] as const)(
        '섹터 그룹 그리드는 모바일 2열, %s 이고 심볼 수만큼 자리를 잡는다 (%i개)',
        (smClass, symbolCount) => {
            const { container } = render(
                <MarketSummaryPanelSkeleton scope={TEST_SCOPE} />
            );
            const grids = Array.from(
                container.querySelectorAll(
                    `.grid-cols-2.${CSS.escape(smClass)}`
                )
            ).filter(grid => grid.children.length === symbolCount);
            expect(grids.length).toBeGreaterThan(0);
        }
    );

    it('섹터 그룹 그리드에 모바일 접두사 없는 3·4열 클래스를 쓰지 않는다', () => {
        const { container } = render(
            <MarketSummaryPanelSkeleton scope={TEST_SCOPE} />
        );
        expect(container.querySelector('.grid-cols-3')).toBeNull();
        expect(container.querySelector('.grid-cols-4')).toBeNull();
    });
});
