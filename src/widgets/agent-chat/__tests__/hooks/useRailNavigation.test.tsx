import { act, fireEvent, render, screen } from '@testing-library/react';
import Link from 'next/link';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { useRailNavigation } from '@/widgets/agent-chat/hooks/useRailNavigation';

interface HarnessProps {
    onNavigationStart?: (href: string) => void;
    onNavigate?: () => void;
}

function Harness(props: HarnessProps) {
    const nav = useRailNavigation(props);
    return (
        <div>
            <Link
                href="/c/a"
                data-testid="link-a"
                data-pending={nav.isPending('/c/a')}
                onClick={e => nav.navigate(e, '/c/a')}
            >
                a
            </Link>
            <Link
                href="/c/b"
                data-testid="link-b"
                data-pending={nav.isPending('/c/b')}
                onClick={e => nav.navigate(e, '/c/b')}
            >
                b
            </Link>
            <button
                type="button"
                data-testid="start"
                onClick={() => nav.startNavigationTo('/')}
            >
                new
            </button>
            <span data-testid="navigating">{String(nav.isNavigating)}</span>
        </div>
    );
}

describe('useRailNavigation', () => {
    beforeEach(() => {
        router.push.mockReset();
    });

    describe('navigate', () => {
        it('prevents the default and pushes the route on a plain left click', () => {
            render(<Harness />);
            const notPrevented = fireEvent.click(screen.getByTestId('link-a'));
            expect(notPrevented).toBe(false);
            expect(router.push).toHaveBeenCalledWith('/c/a');
        });

        it.each([
            ['meta', { metaKey: true }],
            ['ctrl', { ctrlKey: true }],
            ['shift', { shiftKey: true }],
            ['alt', { altKey: true }],
            ['middle button', { button: 1 }],
        ])('leaves a %s click to the browser', (_name, init) => {
            render(<Harness />);
            const notPrevented = fireEvent.click(
                screen.getByTestId('link-a'),
                init
            );
            expect(notPrevented).toBe(true);
            expect(router.push).not.toHaveBeenCalled();
        });

        it('leaves an already-prevented click alone', () => {
            render(<Harness />);
            const link = screen.getByTestId('link-a');
            link.addEventListener('click', e => e.preventDefault(), {
                capture: true,
            });
            fireEvent.click(link);
            expect(router.push).not.toHaveBeenCalled();
        });
    });

    describe('startNavigationTo', () => {
        it('pushes the route and reports the destination at the start', () => {
            const onNavigationStart = vi.fn();
            render(<Harness onNavigationStart={onNavigationStart} />);
            fireEvent.click(screen.getByTestId('start'));
            expect(onNavigationStart).toHaveBeenCalledWith('/');
            expect(router.push).toHaveBeenCalledWith('/');
        });
    });

    describe('pending state', () => {
        it('marks only the clicked destination as pending while the transition runs', async () => {
            let finish!: () => void;
            router.push.mockImplementation(
                () => new Promise<void>(res => (finish = res))
            );
            render(<Harness />);

            await act(async () => {
                fireEvent.click(screen.getByTestId('link-a'));
            });

            expect(screen.getByTestId('navigating')).toHaveTextContent('true');
            expect(screen.getByTestId('link-a')).toHaveAttribute(
                'data-pending',
                'true'
            );
            expect(screen.getByTestId('link-b')).toHaveAttribute(
                'data-pending',
                'false'
            );
            await act(async () => finish());
        });

        it('notifies onNavigate only after the transition ends', async () => {
            let finish!: () => void;
            router.push.mockImplementation(
                () => new Promise<void>(res => (finish = res))
            );
            const onNavigate = vi.fn();
            render(<Harness onNavigate={onNavigate} />);

            await act(async () => {
                fireEvent.click(screen.getByTestId('link-a'));
            });
            expect(onNavigate).not.toHaveBeenCalled();

            await act(async () => finish());
            expect(onNavigate).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('link-a')).toHaveAttribute(
                'data-pending',
                'false'
            );
        });

        it('does not notify onNavigate when nothing was navigating', () => {
            const onNavigate = vi.fn();
            render(<Harness onNavigate={onNavigate} />);
            expect(onNavigate).not.toHaveBeenCalled();
        });
    });
});
