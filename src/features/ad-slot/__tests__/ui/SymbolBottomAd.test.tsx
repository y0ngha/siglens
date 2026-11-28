import { render, screen } from '@testing-library/react';
import {
    SuppressSymbolBottomAd,
    SymbolBottomAdProvider,
} from '@/features/ad-slot/model/SymbolBottomAdContext';
import { SymbolBottomAd } from '@/features/ad-slot/ui/SymbolBottomAd';

const hydration = vi.hoisted(() => ({ value: true }));
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: () => hydration.value,
}));
vi.mock('@/features/ad-slot/ui/AdSlot', () => ({
    AdSlot: ({ placement }: { placement: string }) => (
        <div data-testid="ad-slot" data-placement={placement} />
    ),
}));

describe('SymbolBottomAd', () => {
    beforeEach(() => {
        hydration.value = true;
    });

    // 억제 신호는 effect로 등록돼 서버 렌더에 반영되지 않는다. 서버 HTML에 상자를 그리면 오류·안내
    // 화면에도 광고 상자가 실렸다가 빠진다.
    it('renders nothing before hydration', () => {
        hydration.value = false;
        render(
            <SymbolBottomAdProvider>
                <SymbolBottomAd />
            </SymbolBottomAdProvider>
        );
        expect(screen.queryByTestId('ad-slot')).toBeNull();
    });

    it('renders the shared bottom placement', () => {
        render(
            <SymbolBottomAdProvider>
                <SymbolBottomAd />
            </SymbolBottomAdProvider>
        );
        expect(screen.getByTestId('ad-slot')).toHaveAttribute(
            'data-placement',
            'symbol-bottom'
        );
    });

    it('renders nothing while a tab screen suppresses it', () => {
        render(
            <SymbolBottomAdProvider>
                <SuppressSymbolBottomAd />
                <SymbolBottomAd />
            </SymbolBottomAdProvider>
        );
        expect(screen.queryByTestId('ad-slot')).toBeNull();
    });
});
