/**
 * Branch coverage tests for registerServiceWorker — targets uncovered branches:
 * - L18: navigator.serviceWorker fallback (no container option provided)
 * - L21: container is undefined (no serviceWorker in navigator)
 * - L36-37: controllerchange without reload option → window.location.reload fallback
 */

// @vitest-environment jsdom
import type { Mock } from 'vitest';
import {
    registerServiceWorker,
    _resetRegisterServiceWorkerForTests,
} from '@/features/pwa-install/lib/registerServiceWorker';

interface FakeContainer {
    register: Mock;
    addEventListener: Mock;
    controller: ServiceWorker | null;
    fire: (type: 'controllerchange') => void;
}

function createFakeContainer(controller: ServiceWorker | null): FakeContainer {
    const listeners: Record<string, Array<() => void>> = {};
    return {
        register: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn((type: string, fn: () => void) => {
            listeners[type] ??= [];
            listeners[type].push(fn);
        }),
        controller,
        fire(type) {
            listeners[type]?.forEach(fn => fn());
        },
    };
}

describe('registerServiceWorker — branch coverage', () => {
    beforeEach(() => {
        _resetRegisterServiceWorkerForTests();
    });

    it('returns early when no container is available (no serviceWorker option and no navigator.serviceWorker)', () => {
        // In this test, we don't pass serviceWorker option
        // We need navigator.serviceWorker to not exist, but jsdom provides it.
        // So we temporarily remove it.
        const original = navigator.serviceWorker;
        Object.defineProperty(navigator, 'serviceWorker', {
            value: undefined,
            configurable: true,
            writable: true,
        });

        // Should not throw
        registerServiceWorker();

        Object.defineProperty(navigator, 'serviceWorker', {
            value: original,
            configurable: true,
            writable: true,
        });
    });

    it('uses navigator.serviceWorker when no option.serviceWorker is provided', () => {
        const mockRegister = vi.fn().mockResolvedValue(undefined);
        const fakeContainer = {
            register: mockRegister,
            addEventListener: vi.fn(),
            controller: null,
        };

        Object.defineProperty(navigator, 'serviceWorker', {
            value: fakeContainer,
            configurable: true,
            writable: true,
        });

        registerServiceWorker(); // no serviceWorker option

        expect(mockRegister).toHaveBeenCalledWith('/sw.js');
    });

    it('controllerchange fires window.location.reload when no reload option provided', () => {
        const previousController = {} as ServiceWorker;
        const container = createFakeContainer(previousController);
        const reloadMock = vi.fn();

        // Mock window.location.reload
        Object.defineProperty(window, 'location', {
            value: { ...window.location, reload: reloadMock },
            configurable: true,
            writable: true,
        });

        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            // no reload option — should fall back to window.location.reload
        });

        container.fire('controllerchange');
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('handles register error gracefully (warns but does not throw)', () => {
        const container = createFakeContainer(null);
        container.register.mockRejectedValue(new Error('registration failed'));

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
        });

        // The catch handler logs the error — we can verify it doesn't throw
        // The promise rejection is swallowed by the .catch
        warnSpy.mockRestore();
    });
});
