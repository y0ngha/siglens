import { render, screen } from '@testing-library/react';
import { EstimateTrendSection } from '@/widgets/fundamental/ui/future-direction/EstimateTrendSection';
import type { VisibleEstimatePeriod } from '@/widgets/fundamental/utils/estimateTrend';

function period(
    over: Partial<VisibleEstimatePeriod> & Pick<VisibleEstimatePeriod, 'period'>
): VisibleEstimatePeriod {
    return {
        endDate: null,
        eps: {
            avg: 1.3,
            analysts: 12,
            ago7d: null,
            ago30d: 1.25,
            ago60d: null,
            ago90d: 1.4,
            change30d: 0.05,
            change90d: -0.1,
        },
        revisions: { up7d: null, down7d: null, up30d: 3, down30d: 1 },
        revenue: { avg: null, analysts: null, growthPct: null },
        ...over,
    };
}

describe('EstimateTrendSection', () => {
    it('기간 라벨·애널리스트 수·현재 EPS를 그린다', () => {
        render(
            <EstimateTrendSection
                periods={[period({ period: '0y' })]}
                symbol="AAPL"
                locale="ko"
            />
        );
        const [item] = screen.getAllByRole('listitem');
        expect(item).toHaveTextContent('올해 회계연도');
        expect(item).toHaveTextContent('12명');
        expect(item).toHaveTextContent('US$1.30');
    });

    it('방향은 장식 기호와 화면 낭독기 문구로 함께 말하고, 색은 방향마다 다르다', () => {
        render(
            <EstimateTrendSection
                periods={[period({ period: '0q' })]}
                symbol="AAPL"
                locale="ko"
            />
        );
        const up = screen.getByText('상향');
        const down = screen.getByText('하향');
        expect(up).toHaveClass('sr-only');
        expect(down).toHaveClass('sr-only');
        expect(up.parentElement).toHaveClass('text-ui-success-text');
        expect(down.parentElement).toHaveClass('text-ui-danger-text');
        expect(screen.getByText('▲', { exact: false })).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });

    it('표시 단위에서 0인 변화는 "변동 없음"이고, 30·90일 변화가 둘 다 없으면 변화 줄을 그리지 않는다', () => {
        const { unmount } = render(
            <EstimateTrendSection
                periods={[
                    period({
                        period: '0q',
                        eps: {
                            ...period({ period: '0q' }).eps,
                            change30d: 0.004,
                            change90d: null,
                        },
                    }),
                ]}
                symbol="AAPL"
                locale="ko"
            />
        );
        expect(screen.getByText('변동 없음')).toBeInTheDocument();
        expect(screen.queryByText('상향')).toBeNull();
        unmount();

        render(
            <EstimateTrendSection
                periods={[
                    period({
                        period: '0q',
                        eps: {
                            ...period({ period: '0q' }).eps,
                            change30d: null,
                            change90d: null,
                        },
                    }),
                ]}
                symbol="AAPL"
                locale="ko"
            />
        );
        expect(screen.queryByText(/일 전보다/)).toBeNull();
    });

    it('상향·하향 막대는 비율대로 나뉘고, 수가 없으면 막대·문구를 그리지 않는다', () => {
        const { container, unmount } = render(
            <EstimateTrendSection
                periods={[period({ period: '0q' })]}
                symbol="AAPL"
                locale="ko"
            />
        );
        expect(
            screen.getByText('최근 30일 상향 3명, 하향 1명')
        ).toBeInTheDocument();
        const bar = container.querySelector('[aria-hidden="true"].flex');
        const [upBar, downBar] = Array.from(bar?.children ?? []);
        expect(upBar).toHaveStyle({ width: '75%' });
        expect(downBar).toHaveStyle({ width: '25%' });
        unmount();

        render(
            <EstimateTrendSection
                periods={[
                    period({
                        period: '0q',
                        revisions: {
                            up7d: null,
                            down7d: null,
                            up30d: 0,
                            down30d: 0,
                        },
                    }),
                ]}
                symbol="AAPL"
                locale="ko"
            />
        );
        expect(screen.queryByText(/최근 30일/)).toBeNull();
    });
});
