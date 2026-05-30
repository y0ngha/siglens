import type { Page } from '@playwright/test';

/**
 * Pins the browser clock to a fixed instant so time-dependent UI
 * (e.g. options stale banner, React Query staleTime) is deterministic.
 * Pass an ISO string; defaults to a US-market-closed weekend instant.
 */
export async function freezeClock(
    page: Page,
    isoTime = '2026-05-30T20:00:00Z'
): Promise<void> {
    await page.clock.install({ time: new Date(isoTime) });
}
