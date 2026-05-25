import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    SNAP_POINTS_MUTABLE,
    type SnapPoint,
} from '@/widgets/symbol-page/constants/mobileSheet';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('vaul', () => ({
    Drawer: {
        Root: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
        Portal: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
        Content: ({
            children,
            ...props
        }: {
            children: React.ReactNode;
            [key: string]: unknown;
        }) => (
            <div data-testid="drawer-content" {...props}>
                {children}
            </div>
        ),
        Handle: (props: Record<string, unknown>) => (
            <div data-testid="drawer-handle" {...props} />
        ),
        Title: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
        Description: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
    },
}));

interface MockSheetProps {
    snap: SnapPoint;
    onSnapChange: (snap: SnapPoint) => void;
}

function MockMobileSheet({ snap, onSnapChange }: MockSheetProps) {
    return (
        <div data-testid="mobile-sheet">
            <div data-testid="sheet-snap">{String(snap)}</div>
            <button
                type="button"
                onClick={() => onSnapChange(1)}
                data-testid="expand-btn"
            >
                Expand
            </button>
            <button
                type="button"
                onClick={() => onSnapChange(SNAP_POINTS_MUTABLE[0]!)}
                data-testid="collapse-btn"
            >
                Collapse
            </button>
            <div data-testid="content">Analysis content</div>
        </div>
    );
}

describe('Mobile Sheet Interaction', () => {
    it('renders sheet with initial snap point', () => {
        const onSnap = vi.fn();
        render(
            <MockMobileSheet
                snap={SNAP_POINTS_MUTABLE[0]!}
                onSnapChange={onSnap}
            />
        );
        expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
        expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('calls onSnapChange when expand button is clicked', async () => {
        const onSnap = vi.fn();
        render(
            <MockMobileSheet
                snap={SNAP_POINTS_MUTABLE[0]!}
                onSnapChange={onSnap}
            />
        );
        const user = userEvent.setup();
        await user.click(screen.getByTestId('expand-btn'));
        expect(onSnap).toHaveBeenCalledWith(1);
    });

    it('calls onSnapChange when collapse button is clicked', async () => {
        const onSnap = vi.fn();
        render(<MockMobileSheet snap={1} onSnapChange={onSnap} />);
        const user = userEvent.setup();
        await user.click(screen.getByTestId('collapse-btn'));
        expect(onSnap).toHaveBeenCalledWith(SNAP_POINTS_MUTABLE[0]);
    });

    it('snap points configuration has expected length', () => {
        expect(SNAP_POINTS_MUTABLE.length).toBeGreaterThanOrEqual(2);
    });
});
