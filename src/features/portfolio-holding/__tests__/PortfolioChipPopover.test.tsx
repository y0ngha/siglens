import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import { PortfolioChipPopover } from '../ui/PortfolioChipPopover';

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPopover(isMobile: boolean) {
    const triggerRef = createRef<HTMLButtonElement>();
    const save = {
        mutateAsync: vi.fn(),
        isPending: false,
    } as unknown as Parameters<typeof PortfolioChipPopover>[0]['save'];
    const onClose = vi.fn();

    return {
        onClose,
        ...render(
            <div data-testid="anchor">
                <button ref={triggerRef} type="button">
                    trigger
                </button>
                <PortfolioChipPopover
                    symbol="AAPL"
                    holding={HOLDING}
                    save={save}
                    triggerRef={triggerRef}
                    onClose={onClose}
                    isMobile={isMobile}
                />
            </div>
        ),
    };
}

describe('PortfolioChipPopover', () => {
    it('데스크탑에서는 앵커 내부에 absolute/right-0로 렌더한다', () => {
        renderPopover(false);

        const dialog = screen.getByRole('dialog');
        expect(screen.getByTestId('anchor')).toContainElement(dialog);
        expect(dialog.className).toContain('absolute');
        expect(dialog.className).toContain('right-0');
        expect(screen.getByLabelText('수량')).toBeInTheDocument();
        expect(screen.getByLabelText('평단')).toBeInTheDocument();
    });

    it('모바일에서는 body로 포털되어 앵커 밖에서 렌더한다 — 헤더의 z-40 스택 컨텍스트를 탈출해야 시트 위에 뜬다', () => {
        renderPopover(true);

        const dialog = screen.getByRole('dialog');
        expect(screen.getByTestId('anchor')).not.toContainElement(dialog);
        expect(screen.getByLabelText('수량')).toBeInTheDocument();
        expect(screen.getByLabelText('평단')).toBeInTheDocument();
    });

    // 이 테스트가 빠져 있던 게 CRITICAL 2가 그대로 배포된 이유였다: 이전에는
    // PortfolioChipPopover가 내부에서 useIsMobileViewport()를 직접 호출했는데,
    // next/dynamic({ssr:false})로 열릴 때마다 새로 마운트되는 이 컴포넌트에서
    // 그 훅은 매번 false로 시작해 effect 이후에야 true로 바뀐다 — PopoverSurface가
    // Fragment→Portal로 fiber 타입을 바꾸며 패널 서브트리 전체가 unmount/remount되고,
    // useFocusTrap의 안정적인 [active, ref] deps는 재무장되지 않는다(포커스 트랩
    // 무력화). isMobile을 프롭으로 이미 확정된 값으로 받으면 그 전환 자체가 없다.
    it('모바일(isMobile=true)로 열려도 포커스 트랩이 다이얼로그 안에 포커스를 둔다', () => {
        renderPopover(true);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(document.activeElement).not.toBe(document.body);
        expect(dialog.contains(document.activeElement)).toBe(true);
    });
});
