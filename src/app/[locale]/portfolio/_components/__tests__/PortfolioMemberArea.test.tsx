/**
 * `PortfolioMemberArea` — 비회원 가입 CTA와 회원 영역의 분기, 보유종목 기반 카드 그리드(보유마다
 * `PositionHoldingCard` 하나, 서버는 종목별 가격 범위를 읽지 않는다), 0개일 때 빈 상태, 일시적 DB
 * 실패 시 페이지 안 오류 카드로의 degrade.
 *
 * 보유종목은 `loadPortfolioHoldings`가 `DrizzlePortfolioRepository`로 직접 읽으므로 저장소와
 * `getDatabaseClient`를 mock한다. `toView`는 실제(순수) 함수라 픽스처는 원시
 * `PortfolioHoldingRecord` 모양(Date `updatedAt`)이다.
 */

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
const mockFindByUser = vi.fn();
vi.mock('@/entities/portfolio/api', () => ({
    // A plain `function` (not an arrow) — the production code calls this via
    // `new DrizzlePortfolioRepository(db)`, and arrow functions are not
    // constructible (`new (() => {})()` throws), which tinyspy surfaces as
    // "... is not a constructor" when `mockImplementation` wraps one.
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindByUser };
    }),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/widgets/portfolio-position/ui/PositionHoldingCard', () => ({
    PositionHoldingCard: () => null,
}));
vi.mock('@/features/portfolio-management/ui/PortfolioSignupCta', () => ({
    PortfolioSignupCta: () => null,
}));
vi.mock('@/app/[locale]/portfolio/_components/PortfolioManager', () => ({
    PortfolioManager: () => null,
}));

import { isValidElement, type ReactNode } from 'react';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { PortfolioSignupCta } from '@/features/portfolio-management/ui/PortfolioSignupCta';
import type { PortfolioHoldingRecord } from '@/shared/db/types';
import { PositionHoldingCard } from '@/widgets/portfolio-position/ui/PositionHoldingCard';
import { PortfolioManager } from '../PortfolioManager';
import { PortfolioMemberArea } from '../PortfolioMemberArea';
import { PortfolioEmptyState, PortfolioErrorState } from '../PortfolioStates';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/** findElementByType only returns the FIRST match — this counts every match in the tree (grid has N cards). */
function countElementsByType(node: ReactNode, type: unknown): number {
    if (Array.isArray(node)) {
        return node.reduce<number>(
            (sum, child) => sum + countElementsByType(child, type),
            0
        );
    }
    if (!isValidElement(node)) return 0;
    const self = node.type === type ? 1 : 0;
    const childProps = node.props as { children?: ReactNode };
    return self + countElementsByType(childProps.children, type);
}

const RECORD_AAPL: PortfolioHoldingRecord = {
    id: 'holding-1',
    userId: 'user-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
const RECORD_MSFT: PortfolioHoldingRecord = {
    id: 'holding-2',
    userId: 'user-1',
    symbol: 'MSFT',
    companyName: 'Microsoft Corp.',
    fmpSymbol: 'MSFT',
    quantity: '5',
    averagePrice: '300',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('PortfolioMemberArea', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('비로그인이면 리다이렉트 없이 가입 CTA 카드를 그리고 보유 카드는 없다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        const tree = await PortfolioMemberArea({ locale: 'ko' });
        expect(findElementByType(tree, PortfolioSignupCta)).not.toBeNull();
        expect(countElementsByType(tree, PositionHoldingCard)).toBe(0);
        expect(countElementsByType(tree, PortfolioManager)).toBe(0);
        expect(mockFindByUser).not.toHaveBeenCalled();
    });

    it('회원이면 보유 관리 섹션(PortfolioManager)과 카드 그리드를 함께 그린다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockResolvedValue([RECORD_AAPL]);
        const tree = await PortfolioMemberArea({ locale: 'ko' });
        expect(countElementsByType(tree, PortfolioManager)).toBe(1);
        expect(countElementsByType(tree, PositionHoldingCard)).toBe(1);
    });

    it('resolves the session only once (does not double-call getCurrentUser)', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockResolvedValue([RECORD_AAPL]);

        await PortfolioMemberArea({ locale: 'ko' });

        expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('reads holdings scoped to the resolved user id', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockResolvedValue([RECORD_AAPL]);

        await PortfolioMemberArea({ locale: 'ko' });

        expect(mockFindByUser).toHaveBeenCalledWith('user-1');
    });

    it('renders one PositionHoldingCard per holding inside the grid', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockResolvedValue([RECORD_AAPL, RECORD_MSFT]);

        const tree = await PortfolioMemberArea({ locale: 'ko' });

        expect(countElementsByType(tree, PositionHoldingCard)).toBe(2);
    });

    it('passes the holding through to its card as a view (server never fetches per-symbol ranges)', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockResolvedValue([RECORD_AAPL]);

        const tree = await PortfolioMemberArea({ locale: 'ko' });

        const card = findElementByType(tree, PositionHoldingCard);
        expect(card?.props).toEqual(
            expect.objectContaining({
                holding: expect.objectContaining({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    fmpSymbol: 'AAPL',
                    quantity: '10',
                    averagePrice: '150',
                }),
            })
        );
    });

    it('shows the empty-state CTA (no cards) when the member has no holdings', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockResolvedValue([]);

        const tree = await PortfolioMemberArea({ locale: 'ko' });

        expect(countElementsByType(tree, PositionHoldingCard)).toBe(0);
        expect(findElementByType(tree, PortfolioEmptyState)).not.toBeNull();
    });

    it('degrades to the in-page error state (never throws to the root error boundary) when the holdings read fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
        mockFindByUser.mockRejectedValue(new Error('transient DB error'));

        const tree = await PortfolioMemberArea({ locale: 'ko' });

        expect(findElementByType(tree, PortfolioErrorState)).not.toBeNull();
        expect(countElementsByType(tree, PositionHoldingCard)).toBe(0);
    });
});
