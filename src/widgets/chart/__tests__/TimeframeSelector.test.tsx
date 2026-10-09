import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timeframe } from '@y0ngha/siglens-core';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';
import { TIMEFRAMES } from '@/shared/config/market';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));

describe('TimeframeSelector', () => {
    it('renders a button for each timeframe', () => {
        render(<TimeframeSelector value="1Day" onChange={vi.fn()} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(TIMEFRAMES.length);
    });

    it('renders Korean labels for timeframes', () => {
        render(<TimeframeSelector value="1Day" onChange={vi.fn()} />);

        expect(screen.getByText('5분')).toBeInTheDocument();
        expect(screen.getByText('15분')).toBeInTheDocument();
        expect(screen.getByText('30분')).toBeInTheDocument();
        expect(screen.getByText('1시간')).toBeInTheDocument();
        expect(screen.getByText('4시간')).toBeInTheDocument();
        expect(screen.getByText('1일')).toBeInTheDocument();
    });

    it('calls onChange with the clicked timeframe', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector value="1Day" onChange={onChange} />);

        await user.click(screen.getByText('5분'));

        expect(onChange).toHaveBeenCalledWith('5Min' satisfies Timeframe);
    });

    it('calls onChange when a different timeframe is selected', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector value="1Day" onChange={onChange} />);

        await user.click(screen.getByText('4시간'));

        expect(onChange).toHaveBeenCalledWith('4Hour' satisfies Timeframe);
    });

    it('free 등급의 1Day 외 버튼은 aria-disabled이고 1Day는 열려 있다', () => {
        render(
            <TimeframeSelector value="1Day" onChange={vi.fn()} isFreeTier />
        );
        const locked = screen.getByRole('button', { name: '5분' });
        expect(locked).toHaveAttribute('aria-disabled', 'true');
        // 네이티브 disabled가 아니다 — 클릭을 받아야 게이트 클릭을 셀 수 있다.
        expect(locked).toBeEnabled();
        expect(screen.getByRole('button', { name: '1일' })).not.toHaveAttribute(
            'aria-disabled'
        );
    });

    it('잠긴 프레임 클릭은 onChange 대신 gate_clicked{timeframe}를 보낸다', async () => {
        track.mockReset();
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <TimeframeSelector value="1Day" onChange={onChange} isFreeTier />
        );
        await user.click(screen.getByRole('button', { name: '4시간' }));
        expect(onChange).not.toHaveBeenCalled();
        expect(track).toHaveBeenCalledWith('gate_clicked', {
            gate: 'timeframe',
        });
    });

    it('티어 미확정 동안은 네이티브 disabled라 클릭도 기록도 없다', async () => {
        track.mockReset();
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <TimeframeSelector
                value="1Day"
                onChange={onChange}
                isTierHydrated={false}
            />
        );
        const button = screen.getByRole('button', { name: '5분' });
        expect(button).toBeDisabled();
        await user.click(button);
        expect(onChange).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
    });
});
