import { render, screen } from '@testing-library/react';
import { MobileAnalysisSheet } from '@/views/symbol/MobileAnalysisSheet';
import { SNAP_HALF } from '@/views/symbol/constants/mobileSheet';
import { useMobileAnalysisSheet } from '@/views/symbol/hooks/useMobileAnalysisSheet';

vi.mock('vaul', () => {
    const DrawerRoot = ({
        children,
        ..._rest
    }: {
        children: React.ReactNode;
        [key: string]: unknown;
    }) => <div data-testid="drawer-root">{children}</div>;

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
        const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

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

        observeSpy.mockRestore();
    });
});
