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
import { useHydrated } from '@/shared/hooks/useHydrated';

vi.mock('@/shared/lib/eastern', () => ({
    EDT_OFFSET_HOURS: -4,
    getEasternOffsetHours: () => -4,
}));

vi.mock('@/shared/lib/options/marketHoursDisplay', () => ({
    ET_MARKET_HOURS_DISPLAY: '9:30~16:00 ET',
    KST_EDT_HOURS_DISPLAY: '22:30~05:00',
    KST_EST_HOURS_DISPLAY: '23:30~06:00',
}));

vi.mock('@/shared/hooks/useHydrated', () => ({ useHydrated: vi.fn() }));

const mockUseHydrated = vi.mocked(useHydrated);

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
        it('renders ATM IV explanation unconditional text', () => {
            mockUseHydrated.mockReturnValue(true);
            render(<AtmIvTooltip />);
            expect(
                screen.getByText(/현재 주가에 가장 가까운 옵션/)
            ).toBeInTheDocument();
            expect(screen.getByText(/22:30~05:00/)).toBeInTheDocument();
        });

        describe('useHydrated=false (SSR / first render)', () => {
            it('지금은 DST 문장은 없지만 정적 kstWindow fallback은 렌더된다', () => {
                mockUseHydrated.mockReturnValue(false);
                render(<AtmIvTooltip />);
                const text = document.body.textContent ?? '';
                // now-derived 레이블은 부재
                expect(text).not.toContain('지금은');
                // 정적 fallback 윈도우(KST_EDT_HOURS_DISPLAY)는 SSR 출력 안정성을 위해 존재해야 한다.
                // 이 positive 단언이 없으면 비-hydrated 경로에서 kstWindow 문단이 통째로
                // 사라지는 회귀를 못 잡는다.
                expect(text).toContain('22:30~05:00');
            });
        });

        describe('useHydrated=true (after mount)', () => {
            it('지금은 ... 기간이에요 DST 문장이 렌더된다', () => {
                mockUseHydrated.mockReturnValue(true);
                render(<AtmIvTooltip />);
                // getEasternOffsetHours 반환값 -4 === EDT_OFFSET_HOURS(-4) → 서머타임(EDT)
                expect(document.body.textContent).toContain(
                    '지금은 서머타임(EDT) 기간이에요.'
                );
            });
        });
    });

    describe('ImpliedMoveTooltip', () => {
        it('renders implied move explanation unconditional text', () => {
            mockUseHydrated.mockReturnValue(true);
            render(<ImpliedMoveTooltip />);
            expect(screen.getByText(/옵션 시장이/)).toBeInTheDocument();
        });

        describe('useHydrated=false (SSR / first render)', () => {
            it('지금은 DST 문장은 없지만 정적 kstWindow fallback은 렌더된다', () => {
                mockUseHydrated.mockReturnValue(false);
                render(<ImpliedMoveTooltip />);
                const text = document.body.textContent ?? '';
                // now-derived 레이블은 부재
                expect(text).not.toContain('지금은');
                // 정적 fallback 윈도우(KST_EDT_HOURS_DISPLAY)는 SSR 출력 안정성을 위해 존재해야 한다.
                expect(text).toContain('22:30~05:00');
            });
        });

        describe('useHydrated=true (after mount)', () => {
            it('지금은 ... 기간이에요 DST 문장이 렌더된다', () => {
                mockUseHydrated.mockReturnValue(true);
                render(<ImpliedMoveTooltip />);
                expect(document.body.textContent).toContain(
                    '지금은 서머타임(EDT) 기간이에요.'
                );
            });
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
