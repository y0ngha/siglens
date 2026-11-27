import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timeframe } from '@y0ngha/siglens-core';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';
import { TIMEFRAMES } from '@/shared/config/market';
import { getDescriptor } from '@/shared/config/marketProfile/registry';

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

    describe('시장 프로필별 버튼 목록', () => {
        const labelsFor = (
            profile: Parameters<typeof getDescriptor>[0]
        ): (string | null)[] => {
            render(
                <TimeframeSelector
                    value="1Day"
                    onChange={vi.fn()}
                    timeframes={getDescriptor(profile).allowedTimeframes}
                />
            );
            return screen.getAllByRole('button').map(b => b.textContent);
        };

        it('미국 주식은 7개 프레임을 모두 보여 준다(4시간·1주 포함)', () => {
            expect(labelsFor('us-equity')).toEqual([
                '5분',
                '15분',
                '30분',
                '1시간',
                '4시간',
                '1일',
                '1주',
            ]);
        });

        it('한국 주식은 4시간 없이 6개다(yahoo에 4시간이 없어 빈 차트가 된다)', () => {
            const labels = labelsFor('kr-equity');
            expect(labels).toEqual([
                '5분',
                '15분',
                '30분',
                '1시간',
                '1일',
                '1주',
            ]);
            expect(labels).not.toContain('4시간');
        });

        it('크립토는 프로필이 허용하는 4개만 보여 준다', () => {
            expect(labelsFor('crypto')).toEqual(['5분', '1시간', '1일', '1주']);
        });

        it('free 등급은 1주도 잠긴다(1일만 열려 있다)', () => {
            render(
                <TimeframeSelector
                    value="1Day"
                    onChange={vi.fn()}
                    isFreeTier
                    timeframes={getDescriptor('us-equity').allowedTimeframes}
                />
            );
            expect(screen.getByRole('button', { name: '1주' })).toHaveAttribute(
                'aria-disabled',
                'true'
            );
        });

        it('timeframes를 생략하면 전체 TIMEFRAMES를 그린다', () => {
            render(<TimeframeSelector value="1Day" onChange={vi.fn()} />);
            expect(screen.getAllByRole('button')).toHaveLength(
                TIMEFRAMES.length
            );
            expect(TIMEFRAMES).toContain('1Week');
        });
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

    it('잠긴 프레임 클릭은 onLockedClick을 불러 가입 안내를 열게 한다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const onLockedClick = vi.fn();
        render(
            <TimeframeSelector
                value="1Day"
                onChange={onChange}
                isFreeTier
                onLockedClick={onLockedClick}
            />
        );
        await user.click(screen.getByRole('button', { name: '4시간' }));
        expect(onLockedClick).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('열린 프레임 클릭은 onLockedClick을 부르지 않는다', async () => {
        const user = userEvent.setup();
        const onLockedClick = vi.fn();
        render(
            <TimeframeSelector
                value="1Day"
                onChange={vi.fn()}
                onLockedClick={onLockedClick}
            />
        );
        await user.click(screen.getByRole('button', { name: '4시간' }));
        expect(onLockedClick).not.toHaveBeenCalled();
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
