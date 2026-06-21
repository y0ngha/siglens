import { render, screen } from '@testing-library/react';
import { OptionsStaleDataBanner } from '@/widgets/options/OptionsStaleDataBanner';

vi.mock('@/shared/lib/options/marketHoursDisplay', () => ({
    ET_MARKET_HOURS_DISPLAY: '9:30~16:00 ET',
    KST_EDT_HOURS_DISPLAY: '22:30~05:00',
    KST_EST_HOURS_DISPLAY: '23:30~06:00',
}));

vi.mock('@/shared/lib/eastern', () => ({
    EDT_OFFSET_HOURS: -4,
    getEasternOffsetHours: () => -4,
}));

vi.mock('@/shared/hooks/useHydrated', () => ({ useHydrated: vi.fn() }));

import { useHydrated } from '@/shared/hooks/useHydrated';

const mockUseHydrated = vi.mocked(useHydrated);

describe('OptionsStaleDataBanner', () => {
    it('renders the stale data heading', () => {
        mockUseHydrated.mockReturnValue(true);
        render(<OptionsStaleDataBanner />);
        expect(
            screen.getByText('옵션 OI 데이터가 비어 있어요')
        ).toBeInTheDocument();
    });

    it('renders status role', () => {
        mockUseHydrated.mockReturnValue(true);
        render(<OptionsStaleDataBanner />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders ET market hours', () => {
        mockUseHydrated.mockReturnValue(true);
        render(<OptionsStaleDataBanner />);
        expect(screen.getByText(/9:30~16:00 ET/)).toBeInTheDocument();
    });

    it('renders both KST windows', () => {
        mockUseHydrated.mockReturnValue(true);
        render(<OptionsStaleDataBanner />);
        const text = screen.getByRole('status').textContent ?? '';
        expect(text).toContain('22:30~05:00');
        expect(text).toContain('23:30~06:00');
    });

    describe('useHydrated=false (SSR / first render)', () => {
        it('지금은 DST 문장이 렌더되지 않는다', () => {
            mockUseHydrated.mockReturnValue(false);
            render(<OptionsStaleDataBanner />);
            const text = screen.getByRole('status').textContent ?? '';
            expect(text).not.toContain('지금은');
        });

        it('정적 단락(미국 정규장 마감 후)은 여전히 렌더된다', () => {
            mockUseHydrated.mockReturnValue(false);
            render(<OptionsStaleDataBanner />);
            expect(
                screen.getByText(/미국 정규장 마감 후에는 Yahoo가/)
            ).toBeInTheDocument();
        });
    });

    describe('useHydrated=true (after mount)', () => {
        it('지금은 ... 기간이니 DST 문장이 렌더된다', () => {
            mockUseHydrated.mockReturnValue(true);
            render(<OptionsStaleDataBanner />);
            // getEasternOffsetHours가 -4(EDT_OFFSET_HOURS)를 반환하므로 서머타임(EDT)
            expect(
                screen.getByText(/지금은 서머타임\(EDT\) 기간이니/)
            ).toBeInTheDocument();
        });
    });
});
