import { render, screen, waitFor } from '@testing-library/react';
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

    // vaul 1.1.2 leaks `pointer-events: none` onto <body> even with modal={false},
    // which makes the tabs and floating buttons outside the sheet unclickable.
    // These cover the repair effect — without them the whole guard could be
    // deleted and every assertion above would still pass.
    describe('body pointer-events repair', () => {
        afterEach(() => {
            document.body.style.pointerEvents = '';
        });

        function renderSheet() {
            return render(
                <MobileAnalysisSheet
                    activeSnap={SNAP_HALF}
                    onActiveSnapChange={vi.fn()}
                >
                    <span>content</span>
                </MobileAnalysisSheet>
            );
        }

        it('repairs pointer-events already blocked at mount time', () => {
            document.body.style.pointerEvents = 'none';

            renderSheet();

            expect(document.body.style.pointerEvents).toBe('auto');
        });

        it('repairs pointer-events blocked after mount', async () => {
            renderSheet();

            document.body.style.pointerEvents = 'none';

            await waitFor(() => {
                expect(document.body.style.pointerEvents).toBe('auto');
            });
        });

        it('stops repairing once unmounted', async () => {
            const { unmount } = renderSheet();

            unmount();
            document.body.style.pointerEvents = 'none';

            // Give the observer a chance to fire before asserting it did not.
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(document.body.style.pointerEvents).toBe('none');
        });
    });
});
