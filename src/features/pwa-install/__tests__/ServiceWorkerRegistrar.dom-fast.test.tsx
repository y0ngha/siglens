import { render } from '@testing-library/react';
import { ServiceWorkerRegistrar } from '@/features/pwa-install/ui/ServiceWorkerRegistrar';
import { registerServiceWorker } from '@/features/pwa-install/lib/registerServiceWorker';

vi.mock('@/features/pwa-install/lib/registerServiceWorker', () => ({
    registerServiceWorker: vi.fn(),
}));

describe('ServiceWorkerRegistrar', () => {
    it('배너 없이 서비스 워커만 등록하고 아무것도 그리지 않는다', () => {
        const { container } = render(
            <ServiceWorkerRegistrar reloadOnUpdate={false} />
        );
        expect(registerServiceWorker).toHaveBeenCalledWith({
            reloadOnUpdate: false,
        });
        expect(container).toBeEmptyDOMElement();
    });

    it('기본값은 SW 교체 때 새로고침한다', () => {
        render(<ServiceWorkerRegistrar />);
        expect(registerServiceWorker).toHaveBeenLastCalledWith({
            reloadOnUpdate: true,
        });
    });
});
