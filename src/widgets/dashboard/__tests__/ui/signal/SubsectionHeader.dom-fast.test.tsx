import { render, screen } from '@testing-library/react';
import { SubsectionHeader } from '@/widgets/dashboard/ui/signal/SubsectionHeader';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

describe('SubsectionHeader', () => {
    it('마커는 장식으로 숨기고 제목은 소제목으로 그린다', () => {
        render(
            <SubsectionHeader
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                count={1}
            />
        );
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
            '상승 신호'
        );
        expect(screen.getByText('▲')).toHaveAttribute('aria-hidden', 'true');
    });

    it('종목 수를 두 자리로 채우고 접근 가능한 이름은 종목 수 문장이다', () => {
        render(
            <SubsectionHeader
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                count={7}
            />
        );
        expect(screen.getByText('07')).toHaveAttribute(
            'aria-label',
            '7개 종목'
        );
    });

    it('두 자리를 넘는 종목 수는 그대로 그린다', () => {
        render(
            <SubsectionHeader
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                count={123}
            />
        );
        expect(screen.getByText('123')).toBeInTheDocument();
    });

    it('종목 수 라벨은 로케일 문구다', () => {
        renderWithIntl(
            <SubsectionHeader
                title="Uptrend Signals"
                marker="▲"
                variant="confirmed"
                count={3}
            />,
            { locale: 'en' }
        );
        expect(screen.getByText('03')).toHaveAttribute(
            'aria-label',
            '3 stocks'
        );
    });

    it('조짐 소절은 제목과 종목 수를 같은 불투명도로 약화한다', () => {
        render(
            <SubsectionHeader
                title="상승 조짐"
                marker="△"
                variant="expected"
                count={1}
            />
        );
        expect(screen.getByRole('heading', { level: 3 })).toHaveClass(
            'opacity-70'
        );
        expect(screen.getByText('01')).toHaveClass('opacity-70');
    });

    it('확정 소절은 약화하지 않는다', () => {
        render(
            <SubsectionHeader
                title="상승 신호"
                marker="▲"
                variant="confirmed"
                count={1}
            />
        );
        expect(screen.getByText('01')).toHaveClass('opacity-100');
    });

    it('infoMessage가 있으면 안내 툴팁을 그린다', () => {
        render(
            <SubsectionHeader
                title="혼재"
                marker="◈"
                variant="mixed"
                count={0}
                infoMessage={<p>Test info</p>}
            />
        );
        expect(screen.getByTestId('info-tooltip')).toHaveTextContent(
            'Test info'
        );
    });

    it('infoMessage가 없으면 안내 툴팁을 그리지 않는다', () => {
        render(
            <SubsectionHeader
                title="혼재"
                marker="◈"
                variant="mixed"
                count={0}
            />
        );
        expect(screen.queryByTestId('info-tooltip')).not.toBeInTheDocument();
    });
});
