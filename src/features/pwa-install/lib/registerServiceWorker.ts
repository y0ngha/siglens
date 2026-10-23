import { pageReload } from '@/shared/lib/pageReload';

// SW 등록 + controllerchange 시 소프트 리로드 → 캐시된 HTML과 신규 JS 청크 간 hydration mismatch 방지.
// 모듈 플래그로 controllerchange 리스너 1회 부착 보장 (브라우저 register 자체는 idempotent).
let registered = false;

export interface RegisterServiceWorkerOptions {
    /** Override the location used for the soft reload. Tests inject this. */
    readonly reload?: () => void;
    /** Override the navigator. Tests inject a mocked container. */
    readonly serviceWorker?: ServiceWorkerContainer;
    /**
     * Reload the page when a new SW takes control (default `true`).
     *
     * `false` for pages that hold live state a reload would destroy — the
     * SIGLENS AI chat streams an answer over SSE and keeps an unsent draft in
     * the composer, so a mid-stream `controllerchange` reload cut the answer.
     * Skipping is safe there: `sw.js` never caches HTML (navigations go to the
     * network), and hashed `/_next/static/` assets are immutable per URL, so a
     * page kept on the old controller still loads matching chunks.
     */
    readonly reloadOnUpdate?: boolean;
}

/** Service Worker 등록 + 신규 SW 인계 시 페이지 소프트 리로드 (idempotent). */
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
    if (options.reloadOnUpdate === false) return;
    container.addEventListener('controllerchange', () => {
        const reload = options.reload ?? pageReload;
        reload();
    });
}

/** Test-only reset of the module-level guard. */
export function _resetRegisterServiceWorkerForTests(): void {
    registered = false;
}
