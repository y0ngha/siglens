import { createRef, type RefObject } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';
import { PortfolioChipPopover } from '../ui/PortfolioChipPopover';

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

type Save = Parameters<typeof PortfolioChipPopover>[0]['save'];

function makeSave(isPending: boolean): Save {
    return { mutateAsync: vi.fn(), isPending } as unknown as Save;
}

function popoverTree(
    isMobile: boolean,
    save: Save,
    triggerRef: RefObject<HTMLButtonElement | null>,
    onClose: () => void
) {
    return (
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
    );
}

function renderPopover(isMobile: boolean) {
    const triggerRef = createRef<HTMLButtonElement>();
    const onClose = vi.fn();
    const view = render(
        popoverTree(isMobile, makeSave(false), triggerRef, onClose)
    );

    return {
        onClose,
        ...view,
        setPending: (isPending: boolean) =>
            view.rerender(
                popoverTree(isMobile, makeSave(isPending), triggerRef, onClose)
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

    // isMobile은 열리기 전에 확정된 값으로 들어온다. 이 컴포넌트가 뷰포트를 직접
    // 읽으면 마운트마다 false로 시작해 PopoverSurface가 Fragment→Portal로 바뀌며
    // 패널이 remount되고, 안정적인 deps의 useFocusTrap은 재무장되지 않는다.
    it('모바일(isMobile=true)로 열려도 포커스 트랩이 다이얼로그 안에 포커스를 둔다', () => {
        renderPopover(true);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(document.activeElement).not.toBe(document.body);
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    // 모바일에서는 백드롭이 트리거를 완전히 덮으므로, 닫힘은 전적으로
    // useOnClickOutside가 백드롭 pointerdown에서 발화하는지에 달려 있다.
    describe('모바일 닫힘 경로', () => {
        it('백드롭을 pointerdown하면 닫히고, 패널 안쪽을 pointerdown하면 열린 채 유지된다', () => {
            const { onClose } = renderPopover(true);

            const backdrop = document.querySelector(
                '[data-testid="popover-backdrop"]'
            );
            expect(backdrop).not.toBeNull();
            // backdrop 자체를 대상으로 pointerdown — 패널 안쪽이 아니다.
            fireEvent.pointerDown(backdrop as Element);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('패널 안쪽(예: 수량 입력)을 pointerdown하면 onClose가 호출되지 않는다', () => {
            const { onClose } = renderPopover(true);

            fireEvent.pointerDown(screen.getByLabelText('수량'));

            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    // 포커스를 쥔 버튼에 네이티브 disabled를 걸면 브라우저가 포커스를 body로 떨어뜨리고,
    // 포커스 트랩은 자기 가장자리에서만 순환하므로 Tab이 다이얼로그 밖으로 나간다.
    describe('저장 진행 중', () => {
        it('저장 버튼은 disabled가 아니라 aria-disabled로 표시된다', () => {
            const { setPending } = renderPopover(false);

            setPending(true);

            const saveButton = screen.getByRole('button', { name: '저장 중…' });
            expect(saveButton).toHaveAttribute('aria-disabled', 'true');
            expect(saveButton).not.toBeDisabled();
        });

        it('aria-disabled 저장 버튼을 클릭하거나 폼을 제출해도 mutateAsync를 호출하지 않는다', () => {
            const save = makeSave(true);
            render(popoverTree(false, save, createRef(), vi.fn()));

            const saveButton = screen.getByRole('button', { name: '저장 중…' });
            fireEvent.click(saveButton);
            fireEvent.submit(saveButton.closest('form') as HTMLFormElement);

            expect(save.mutateAsync).not.toHaveBeenCalled();
        });

        it('저장이 끝나면 aria-disabled를 뗀다', () => {
            const { setPending } = renderPopover(false);

            setPending(true);
            setPending(false);

            expect(
                screen.getByRole('button', { name: '저장' })
            ).not.toHaveAttribute('aria-disabled');
        });
    });
});
