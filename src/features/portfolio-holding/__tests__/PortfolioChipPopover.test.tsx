import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import { PortfolioChipPopover } from '../ui/PortfolioChipPopover';

function mockViewport(isMobile: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: isMobile,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPopover() {
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
                />
            </div>
        ),
    };
}

describe('PortfolioChipPopover', () => {
    it('데스크탑에서는 앵커 내부에 absolute/right-0로 렌더한다', () => {
        mockViewport(false);
        renderPopover();

        const dialog = screen.getByRole('dialog');
        expect(screen.getByTestId('anchor')).toContainElement(dialog);
        expect(dialog.className).toContain('absolute');
        expect(dialog.className).toContain('right-0');
        expect(screen.getByLabelText('수량')).toBeInTheDocument();
        expect(screen.getByLabelText('평단')).toBeInTheDocument();
    });

    it('모바일에서는 body로 포털되어 앵커 밖에서 렌더한다 — 헤더의 z-40 스택 컨텍스트를 탈출해야 시트 위에 뜬다', () => {
        mockViewport(true);
        renderPopover();

        const dialog = screen.getByRole('dialog');
        expect(screen.getByTestId('anchor')).not.toContainElement(dialog);
        expect(screen.getByLabelText('수량')).toBeInTheDocument();
        expect(screen.getByLabelText('평단')).toBeInTheDocument();
    });
});
