import { render, screen } from '@testing-library/react';
import type { MockInstance } from 'vitest';
import { MobileAnalysisSheet } from '@/views/symbol/MobileAnalysisSheet';
import { SNAP_HALF } from '@/views/symbol/constants/mobileSheet';
import { useMobileAnalysisSheet } from '@/views/symbol/hooks/useMobileAnalysisSheet';

const { drawerRootProps } = vi.hoisted(() => ({
    drawerRootProps: vi.fn(),
}));

vi.mock('vaul', () => {
    const DrawerRoot = ({
        children,
        ...rest
    }: {
        children: React.ReactNode;
        [key: string]: unknown;
    }) => {
        drawerRootProps(rest);
        return <div data-testid="drawer-root">{children}</div>;
    };

    const DrawerPortal = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="drawer-portal">{children}</div>
    );

    const DrawerContent = ({
        children,
        ..._rest
    }: {
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <div data-testid="drawer-content" aria-live="polite">
            {children}
        </div>
    );

    const DrawerHandle = (props: Record<string, unknown>) => (
        <div
            data-testid="drawer-handle"
            aria-label={props['aria-label'] as string}
        />
    );

    const DrawerTitle = ({ children }: { children: React.ReactNode }) => (
        <h2 data-testid="drawer-title">{children}</h2>
    );

    const DrawerDescription = ({ children }: { children: React.ReactNode }) => (
        <p data-testid="drawer-description">{children}</p>
    );

    return {
        Drawer: {
            Root: DrawerRoot,
            Portal: DrawerPortal,
            Content: DrawerContent,
            Handle: DrawerHandle,
            Title: DrawerTitle,
            Description: DrawerDescription,
        },
    };
});

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/views/symbol/hooks/useMobileAnalysisSheet', () => ({
    useMobileAnalysisSheet: vi.fn(() => ({
        isOpen: true,
        isFullSnap: false,
        contentRef: { current: null },
        drawerContentRef: { current: null },
        handleOpenChange: vi.fn(),
    })),
}));

vi.mock('@/views/symbol/hooks/useMobileSheetDrag', () => ({
    useMobileSheetDrag: vi.fn(),
}));

describe('MobileAnalysisSheet', () => {
    let observeSpy:
        | MockInstance<typeof MutationObserver.prototype.observe>
        | undefined;

    afterEach(() => {
        // 단언 실패로 테스트가 중간에 던져도 프로토타입 스파이가 다음
        // 테스트로 새는 일이 없도록 try/finally 대신 afterEach에서 복구한다.
        observeSpy?.mockRestore();
        observeSpy = undefined;
    });

    // 이 브랜치의 핵심 계약: modal={false}가 Radix Dialog까지 도달해야 시트 밖
    // 입력(평단 팝오버·헤더 검색·챗봇)이 살아 있다. vaul 패치는 전달 경로를
    // 복구할 뿐이고, 우리가 그 prop을 실제로 넘기는지는 여기서만 고정된다.
    // dismissible={false}도 함께 고정한다 — non-modal에서 시트가 외부 탭에
    // 닫히지 않는 근거이기 때문이다.
    it('Drawer.Root에 modal={false}와 dismissible={false}를 전달한다', () => {
        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span>content</span>
            </MobileAnalysisSheet>
        );

        expect(drawerRootProps).toHaveBeenCalledWith(
            expect.objectContaining({ modal: false, dismissible: false })
        );
    });

    it('renders children inside the drawer', () => {
        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span data-testid="child">analysis content</span>
            </MobileAnalysisSheet>
        );

        expect(screen.getByTestId('child')).toBeDefined();
    });

    it('renders accessible title and description', () => {
        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span>content</span>
            </MobileAnalysisSheet>
        );

        expect(screen.getByText('AI 분석 패널')).toBeDefined();
        expect(
            screen.getByText('위로 드래그하여 분석 내용을 확인하세요')
        ).toBeDefined();
    });

    it('renders the drag handle', () => {
        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span>content</span>
            </MobileAnalysisSheet>
        );

        expect(screen.getByTestId('drawer-handle')).toBeDefined();
    });

    it('makes the content scrollable only at the full snap point', () => {
        // At PEEK/HALF the content must stay clipped: vaul translates the sheet
        // by a fixed viewport offset, so an inner scroller at a partial snap
        // would let the user scroll content that is still off-screen.
        vi.mocked(useMobileAnalysisSheet).mockReturnValueOnce({
            isOpen: true,
            isFullSnap: true,
            contentRef: { current: null },
            drawerContentRef: { current: null },
            handleOpenChange: vi.fn(),
        } as unknown as ReturnType<typeof useMobileAnalysisSheet>);

        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span data-testid="child">content</span>
            </MobileAnalysisSheet>
        );

        expect(screen.getByTestId('child').parentElement?.className).toContain(
            'overflow-y-auto'
        );
    });

    // Task 1의 vaul 패치로 Radix가 non-modal로 동작하므로 body pointer-events를
    // 되돌릴 필요가 없어졌다. 훅이 되살아나면(= 근본 원인을 다시 땜질하면)
    // 이 단언이 깨진다.
    it('body를 감시하는 MutationObserver를 설치하지 않는다', () => {
        observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span>content</span>
            </MobileAnalysisSheet>
        );

        const bodyObservations = observeSpy.mock.calls.filter(
            ([target]) => target === document.body
        );
        expect(bodyObservations).toHaveLength(0);
    });
});
