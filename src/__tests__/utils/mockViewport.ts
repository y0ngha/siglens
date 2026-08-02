/**
 * Stubs `window.matchMedia` so `useIsMobileViewport` runs for real, rather
 * than mocking the hook module away.
 *
 * The hook's real behavior is two-phase: it starts `false` on first render
 * and only flips to the stubbed value once its effect runs. Replacing the
 * hook module with `vi.fn(() => true)` collapses that timing to a single
 * value and hides bugs that only show up during the transition — this is
 * exactly what let a remount bug slip through (PopoverSurface's
 * Fragment→Portal switch disarming its focus trap on mobile). Stubbing only
 * `matchMedia` keeps the hook's actual effect timing intact so a regression
 * there still fails these tests.
 */
export function mockViewport(isMobile: boolean) {
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
