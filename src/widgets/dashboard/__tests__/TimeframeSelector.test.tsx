import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeframeSelector } from '@/widgets/dashboard/TimeframeSelector';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    DASHBOARD_TIMEFRAMES: ['1Day', '1Week'] as const,
    DASHBOARD_TIMEFRAME_LABELS: {
        '1Day': '1일',
        '1Week': '1주',
    },
}));

describe('TimeframeSelector', () => {
    it('renders radio buttons for each timeframe', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(2);
    });

    it('marks the active timeframe as checked', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        const radios = screen.getAllByRole('radio');
        expect(radios[0]).toHaveAttribute('aria-checked', 'true');
        expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    });

    it('calls onChange when a radio is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector timeframe="1Day" onChange={onChange} />);
        await user.click(screen.getAllByRole('radio')[1]!);
        expect(onChange).toHaveBeenCalledWith('1Week');
    });

    it('renders radiogroup with label', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        expect(screen.getByText('타임프레임')).toBeInTheDocument();
    });

    it('sets tabIndex 0 for active and -1 for inactive', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        const radios = screen.getAllByRole('radio');
        expect(radios[0]).toHaveAttribute('tabindex', '0');
        expect(radios[1]).toHaveAttribute('tabindex', '-1');
    });

    /**
     * roving tabindex는 onChange만으로 끝나지 않는다 — 실제로 DOM focus도
     * 다음 라디오로 옮겨야 키보드만으로 계속 탐색할 수 있다. `useRovingKeyboardNav`를
     * 목으로 바꾸면 이 컴포넌트 고유의 `focusRadioInGroup`(현재 radiogroup 안에서
     * 다음 라디오를 찾아 focus)가 한 번도 실행되지 않아 여기서는 실제 훅을 쓴다.
     */
    it('ArrowRight를 누르면 다음 타임프레임으로 onChange되고 포커스도 그쪽으로 옮긴다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector timeframe="1Day" onChange={onChange} />);
        const radios = screen.getAllByRole('radio');
        radios[0]!.focus();

        await user.keyboard('{ArrowRight}');

        expect(onChange).toHaveBeenCalledWith('1Week');
        expect(radios[1]).toHaveFocus();
    });

    it('ArrowLeft를 누르면 목록 처음에서 마지막 항목으로 순환하며 포커스를 옮긴다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector timeframe="1Day" onChange={onChange} />);
        const radios = screen.getAllByRole('radio');
        radios[0]!.focus();

        await user.keyboard('{ArrowLeft}');

        expect(onChange).toHaveBeenCalledWith('1Week');
        expect(radios[1]).toHaveFocus();
    });

    it('처리 대상이 아닌 키(예: Tab)는 onChange를 호출하지 않는다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector timeframe="1Day" onChange={onChange} />);
        const radios = screen.getAllByRole('radio');
        radios[0]!.focus();

        await user.keyboard('a');

        expect(onChange).not.toHaveBeenCalled();
    });
});
