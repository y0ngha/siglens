vi.mock('@/features/watchlist/hooks/useWatchlist');
vi.mock('@/features/watchlist/hooks/useWatchlistCoachMark', () => ({
    useWatchlistCoachMark: vi.fn(() => ({ visible: false, dismiss: vi.fn() })),
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => toast }));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistToggleButton } from '@/features/watchlist/ui/WatchlistToggleButton';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { useWatchlistCoachMark } from '@/features/watchlist/hooks/useWatchlistCoachMark';
import { WATCHLIST_MAX_LOCAL } from '@/shared/config/watchlist';

const mockUseWatchlist = vi.mocked(useWatchlist);
const mockUseCoach = vi.mocked(useWatchlistCoachMark);
type Watchlist = ReturnType<typeof useWatchlist>;

function setWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
    const value: Watchlist = {
        items: [],
        has: vi.fn(() => false),
        toggle: vi.fn(async () => 'added' as const),
        remove: vi.fn(async () => true),
        isHydrated: true,
        isAtLimit: false,
        isIdentityPending: false,
        limit: WATCHLIST_MAX_LOCAL,
        ...overrides,
    };
    mockUseWatchlist.mockReturnValue(value);
    return value;
}

describe('WatchlistToggleButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseCoach.mockReturnValue({ visible: false, dismiss: vi.fn() });
    });

    it('담기 전: aria-pressed=false, 라벨 "관심종목에 담기"', () => {
        setWatchlist();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
            />
        );
        const button = screen.getByRole('button', { name: '관심종목에 담기' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).toBeEnabled();
    });

    it('담긴 뒤: aria-pressed=true, 라벨 "관심종목에서 빼기"', () => {
        setWatchlist({ has: vi.fn(() => true) });
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
            />
        );
        expect(
            screen.getByRole('button', { name: '관심종목에서 빼기' })
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('하이드레이션 전에는 빈 ☆ 비활성이지만 자리는 차지한다', () => {
        setWatchlist({ isHydrated: false });
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
            />
        );
        const button = screen.getByRole('button', { name: '관심종목에 담기' });
        expect(button).toBeDisabled();
        expect(button.className).toContain('size-11');
    });

    it('상한이면 aria-disabled + 설명 텍스트가 연결되고, 포커스는 받되 클릭은 아무 일도 하지 않는다', async () => {
        const wl = setWatchlist({ isAtLimit: true });
        const user = userEvent.setup();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
            />
        );
        const button = screen.getByRole('button', { name: '관심종목에 담기' });
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toBeEnabled();
        expect(button).toHaveAccessibleDescription(
            `관심종목은 최대 ${WATCHLIST_MAX_LOCAL}개까지 담을 수 있어요. 내 종목에서 정리해 주세요.`
        );
        await user.tab();
        expect(button).toHaveFocus();
        await user.click(button);
        expect(wl.toggle).not.toHaveBeenCalled();
    });

    it('클릭하면 toggle(entry, source)를 부른다', async () => {
        const wl = setWatchlist();
        const user = userEvent.setup();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="home_onboarding"
            />
        );
        await user.click(screen.getByRole('button'));
        expect(wl.toggle).toHaveBeenCalledWith(
            { symbol: 'AAPL', label: '애플' },
            'home_onboarding'
        );
    });

    it('successToast면 담기 성공에 "담았어요 · 내 종목 보기" 토스트를 띄운다(빼기엔 안 띄운다)', async () => {
        setWatchlist({ toggle: vi.fn(async () => 'added' as const) });
        const user = userEvent.setup();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
                successToast
            />
        );
        await user.click(screen.getByRole('button'));
        await waitFor(() =>
            expect(toast.showToast).toHaveBeenCalledWith({
                message: '관심종목에 담았어요',
                link: { href: '/portfolio', label: '내 종목 보기' },
            })
        );
    });

    it('successToast가 없으면 토스트를 띄우지 않는다', async () => {
        setWatchlist();
        const user = userEvent.setup();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="home_onboarding"
            />
        );
        await user.click(screen.getByRole('button'));
        expect(toast.showToast).not.toHaveBeenCalled();
    });

    it('코치 마크가 보이면 role=tooltip이 버튼의 aria-describedby로 연결되고, 첫 토글에 dismiss된다', async () => {
        const dismiss = vi.fn();
        mockUseCoach.mockReturnValue({ visible: true, dismiss });
        setWatchlist();
        const user = userEvent.setup();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
                showCoachMark
            />
        );
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveTextContent(
            '☆를 누르면 이 종목을 관심종목에 담아 두고'
        );
        expect(
            screen.getByRole('button', { name: '관심종목에 담기' })
        ).toHaveAttribute('aria-describedby', tooltip.id);
        expect(document.activeElement).not.toBe(tooltip);
        await user.click(
            screen.getByRole('button', { name: '관심종목에 담기' })
        );
        expect(dismiss).toHaveBeenCalledTimes(1);
    });

    it('코치 마크 닫기 버튼이 dismiss를 부른다', async () => {
        const dismiss = vi.fn();
        mockUseCoach.mockReturnValue({ visible: true, dismiss });
        setWatchlist();
        const user = userEvent.setup();
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
                showCoachMark
            />
        );
        await user.click(screen.getByRole('button', { name: '안내 닫기' }));
        expect(dismiss).toHaveBeenCalledTimes(1);
    });

    it('코치 마크 enabled는 "하이드레이션 후 관심종목 0개 + showCoachMark"일 때만 true', () => {
        setWatchlist({
            items: [
                {
                    symbol: 'X',
                    companyName: null,
                    addedAt: '2026-10-09T00:00:00.000Z',
                },
            ],
        });
        render(
            <WatchlistToggleButton
                symbol="AAPL"
                label="애플"
                source="symbol_header"
                showCoachMark
            />
        );
        expect(mockUseCoach).toHaveBeenCalledWith({ enabled: false });
    });
});
