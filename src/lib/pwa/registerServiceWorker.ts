/**
 * Registers the Service Worker and arranges a soft reload when a new
 * worker takes control. Without this, an already-open tab can keep
 * serving stale cached HTML against newly-loaded hashed JS chunks,
 * causing React hydration mismatches after a deploy.
 *
 * Idempotent: the underlying browser API treats repeated registrations
 * for the same script URL as a no-op, but we still guard with a module
 * flag so the controllerchange listener is attached only once.
 */
let registered = false;

export interface RegisterServiceWorkerOptions {
    /** Override the location used for the soft reload. Tests inject this. */
    readonly reload?: () => void;
    /** Override the navigator. Tests inject a mocked container. */
    readonly serviceWorker?: ServiceWorkerContainer;
}

export function registerServiceWorker(
    options: RegisterServiceWorkerOptions = {}
): void {
    const container =
        options.serviceWorker ??
        (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
            ? navigator.serviceWorker
            : undefined);
    if (!container) return;
    if (registered) return;
    registered = true;

    container
        .register('/sw.js')
        .catch(err => console.warn('[PWA] SW 등록 실패', err));

    // When the active SW changes (after skipWaiting + clients.claim),
    // reload the page so HTML and hashed JS come from the same generation.
    // Skip the very first controllerchange triggered when the SW is
    // installed for the first time (no previous controller existed).
    if (container.controller === null) return;
    container.addEventListener('controllerchange', () => {
        const reload =
            options.reload ??
            (typeof window !== 'undefined'
                ? () => window.location.reload()
                : undefined);
        reload?.();
    });
}

/** Test-only reset of the module-level guard. */
export function _resetRegisterServiceWorkerForTests(): void {
    registered = false;
}
