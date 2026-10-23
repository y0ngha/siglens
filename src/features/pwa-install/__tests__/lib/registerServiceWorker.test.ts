import type { Mock } from 'vitest';
// @vitest-environment jsdom
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

describe('registerServiceWorker', () => {
    beforeEach(() => {
        _resetRegisterServiceWorkerForTests();
    });

    it('registers /sw.js via the provided container', () => {
        const container = createFakeContainer(null);
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload: vi.fn(),
        });
        expect(container.register).toHaveBeenCalledWith('/sw.js');
    });

    it('does not register a controllerchange listener on first install (no prior controller)', () => {
        const container = createFakeContainer(null);
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload: vi.fn(),
        });
        expect(container.addEventListener).not.toHaveBeenCalled();
    });

    /**
     * SIGLENS AI는 SSE로 답변을 받는 중일 수 있어 SW 교체 때 새로고침하면 답이 끊긴다.
     * 등록은 그대로 하되 controllerchange 리스너를 달지 않는다.
     */
    it('reloadOnUpdate=false면 등록만 하고 SW 교체 때 새로고침하지 않는다', () => {
        const container = createFakeContainer({} as ServiceWorker);
        const reload = vi.fn();
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload,
            reloadOnUpdate: false,
        });
        container.fire('controllerchange');
        expect(container.register).toHaveBeenCalledWith('/sw.js');
        expect(container.addEventListener).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it('reloads the page on controllerchange when a previous SW was already in control', () => {
        const previousController = {} as ServiceWorker;
        const container = createFakeContainer(previousController);
        const reload = vi.fn();
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload,
        });
        expect(container.addEventListener).toHaveBeenCalledWith(
            'controllerchange',
            expect.any(Function)
        );
        container.fire('controllerchange');
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: subsequent calls do not re-register', () => {
        const container = createFakeContainer(null);
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload: vi.fn(),
        });
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload: vi.fn(),
        });
        expect(container.register).toHaveBeenCalledTimes(1);
    });
});
