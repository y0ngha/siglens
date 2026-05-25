import { render, screen } from '@testing-library/react';
import {
    MaxPainTooltip,
    PutCallRatioTooltip,
    AtmIvTooltip,
    ImpliedMoveTooltip,
    OpenInterestTooltip,
    CallOpenInterestTooltip,
    PutOpenInterestTooltip,
    CallVolumeTooltip,
    PutVolumeTooltip,
} from '@/widgets/options/utils/optionsTooltips';

vi.mock('@/shared/lib/eastern', () => ({
    EDT_OFFSET_HOURS: -4,
    getEasternOffsetHours: () => -4,
}));

vi.mock('@/shared/lib/options/marketHoursDisplay', () => ({
    ET_MARKET_HOURS_DISPLAY: '9:30~16:00 ET',
    KST_EDT_HOURS_DISPLAY: '22:30~05:00',
    KST_EST_HOURS_DISPLAY: '23:30~06:00',
}));

describe('optionsTooltips', () => {
    describe('MaxPainTooltip', () => {
        it('renders Max Pain explanation', () => {
            render(<>{MaxPainTooltip}</>);
            expect(
                screen.getByText(/옵션 만기일이 가까워질수록/)
            ).toBeInTheDocument();
        });
    });

    describe('PutCallRatioTooltip', () => {
        it('renders P/C ratio explanation', () => {
            render(<>{PutCallRatioTooltip}</>);
            expect(
                screen.getByText(/풋옵션 거래량을 콜옵션 거래량으로/)
            ).toBeInTheDocument();
        });
    });

    describe('AtmIvTooltip', () => {
        it('renders ATM IV explanation with KST window', () => {
            render(<AtmIvTooltip />);
            expect(
                screen.getByText(/현재 주가에 가장 가까운 옵션/)
            ).toBeInTheDocument();
            expect(screen.getByText(/22:30~05:00/)).toBeInTheDocument();
        });
    });

    describe('ImpliedMoveTooltip', () => {
        it('renders implied move explanation', () => {
            render(<ImpliedMoveTooltip />);
            expect(screen.getByText(/옵션 시장이/)).toBeInTheDocument();
        });
    });

    describe('OpenInterestTooltip', () => {
        it('renders OI explanation', () => {
            render(<>{OpenInterestTooltip}</>);
            expect(screen.getByText(/살아있는/)).toBeInTheDocument();
        });
    });

    describe('Call/Put specific tooltips', () => {
        it('renders CallOpenInterestTooltip', () => {
            render(<>{CallOpenInterestTooltip}</>);
            expect(
                screen.getByText(/콜\(상승\) 옵션을 산 사람/)
            ).toBeInTheDocument();
        });

        it('renders PutOpenInterestTooltip', () => {
            render(<>{PutOpenInterestTooltip}</>);
            expect(
                screen.getByText(/풋\(하락\) 옵션을 산 사람/)
            ).toBeInTheDocument();
        });

        it('renders CallVolumeTooltip', () => {
            render(<>{CallVolumeTooltip}</>);
            expect(screen.getByText(/오늘 새로 체결된 콜/)).toBeInTheDocument();
        });

        it('renders PutVolumeTooltip', () => {
            render(<>{PutVolumeTooltip}</>);
            expect(screen.getByText(/오늘 새로 체결된 풋/)).toBeInTheDocument();
        });
    });
});
