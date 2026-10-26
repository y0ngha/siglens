import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { useExclusiveChartMenu } from '../../hooks/useExclusiveChartMenu';
import { ChartSettingsMenu } from '../../ui/ChartSettingsMenu';

const EXTENDED_LABEL = '시간외 거래(프리마켓, 애프터마켓) 표시';
const UNAVAILABLE_REASON = '1일봉, 한국 종목, 코인에는 시간외 거래가 없어요';

function Harness(
    props: Omit<ComponentProps<typeof ChartSettingsMenu>, 'menu'>
) {
    const { bind } = useExclusiveChartMenu();
    return <ChartSettingsMenu menu={bind('settings')} {...props} />;
}

const getGear = () => screen.getByRole('button', { name: '차트 설정' });
const getPanel = () => screen.getByRole('group', { name: '차트 설정' });

describe('ChartSettingsMenu', () => {
    it('톱니바퀴 트리거는 "차트 설정"이라는 이름과 툴팁을 갖고 닫힌 동안 패널이 없다', () => {
        render(
            <Harness extendedHours={{ checked: true, onChange: vi.fn() }} />
        );
        expect(getGear()).toHaveAttribute('title', '차트 설정');
        expect(getGear()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('group')).toBeNull();
    });

    it('시간외 거래가 적용되면 첫 행이 켜진 토글이고 누르면 반대 값으로 콜백한다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness extendedHours={{ checked: true, onChange }} />);
        await user.click(getGear());
        const row = within(getPanel()).getByRole('button', {
            name: EXTENDED_LABEL,
        });
        expect(row).toHaveAttribute('aria-pressed', 'true');
        expect(row).not.toHaveAttribute('aria-disabled');
        await user.click(row);
        expect(onChange).toHaveBeenCalledWith(false);
        expect(screen.queryByText(UNAVAILABLE_REASON)).toBeNull();
    });

    it('꺼진 상태에서 누르면 켜는 값으로 콜백한다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness extendedHours={{ checked: false, onChange }} />);
        await user.click(getGear());
        const row = within(getPanel()).getByRole('button', {
            name: EXTENDED_LABEL,
        });
        expect(row).toHaveAttribute('aria-pressed', 'false');
        await user.click(row);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('시간외 거래가 적용되지 않으면 톱니바퀴를 숨기지 않고 사유와 함께 비활성 행을 보인다', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(getGear());
        const row = within(getPanel()).getByRole('button', {
            name: EXTENDED_LABEL,
        });
        expect(row).toHaveAttribute('aria-disabled', 'true');
        expect(row).not.toHaveAttribute('aria-pressed');
        // 비활성 행은 hover 배경 피드백이 없다.
        expect(row).toHaveClass('hover:bg-transparent');
        const reason = within(getPanel()).getByText(UNAVAILABLE_REASON);
        expect(row).toHaveAttribute('aria-describedby', reason.id);
        // 비활성 행을 눌러도 아무 일도 없고 패널은 열린 채다.
        await user.click(row);
        expect(getPanel()).toBeInTheDocument();
    });

    it('Escape로 닫고 다시 누르면 토글로 닫힌다', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(getGear());
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('group')).toBeNull();
        await user.click(getGear());
        await user.click(getGear());
        expect(screen.queryByRole('group')).toBeNull();
    });
});
