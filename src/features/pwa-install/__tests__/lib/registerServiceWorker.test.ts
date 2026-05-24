/**
 * @jest-environment jsdom
 */
import {
    registerServiceWorker,
    _resetRegisterServiceWorkerForTests,
} from '@/features/pwa-install/lib/registerServiceWorker';

interface FakeContainer {
    register: jest.Mock;
    addEventListener: jest.Mock;
    controller: ServiceWorker | null;
    fire: (type: 'controllerchange') => void;
}

function createFakeContainer(controller: ServiceWorker | null): FakeContainer {
    const listeners: Record<string, Array<() => void>> = {};
    return {
        register: jest.fn().mockResolvedValue(undefined),
        addEventListener: jest.fn((type: string, fn: () => void) => {
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
            reload: jest.fn(),
        });
        expect(container.register).toHaveBeenCalledWith('/sw.js');
    });

    it('does not register a controllerchange listener on first install (no prior controller)', () => {
        const container = createFakeContainer(null);
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload: jest.fn(),
        });
        expect(container.addEventListener).not.toHaveBeenCalled();
    });

    it('reloads the page on controllerchange when a previous SW was already in control', () => {
        const previousController = {} as ServiceWorker;
        const container = createFakeContainer(previousController);
        const reload = jest.fn();
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
            reload: jest.fn(),
        });
        registerServiceWorker({
            serviceWorker: container as unknown as ServiceWorkerContainer,
            reload: jest.fn(),
        });
        expect(container.register).toHaveBeenCalledTimes(1);
    });
});
