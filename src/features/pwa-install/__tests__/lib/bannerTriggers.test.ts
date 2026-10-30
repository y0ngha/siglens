// @vitest-environment jsdom
import {
    BANNER_TRIGGER_EVENTS,
    subscribeBannerTriggers,
} from '@/features/pwa-install/lib/bannerTriggers';

describe('subscribeBannerTriggers', () => {
    it.each(BANNER_TRIGGER_EVENTS)('%s가 오면 onTrigger를 부른다', type => {
        const onTrigger = vi.fn();
        const onPointerUp = vi.fn();
        const unsubscribe = subscribeBannerTriggers({ onTrigger, onPointerUp });
        window.dispatchEvent(new Event(type));
        unsubscribe();
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('pointerup은 onTrigger가 아니라 onPointerUp을 부른다', () => {
        const onTrigger = vi.fn();
        const onPointerUp = vi.fn();
        const unsubscribe = subscribeBannerTriggers({ onTrigger, onPointerUp });
        window.dispatchEvent(new Event('pointerup'));
        unsubscribe();
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it('pointerdown으로는 어느 콜백도 부르지 않는다', () => {
        const onTrigger = vi.fn();
        const onPointerUp = vi.fn();
        const unsubscribe = subscribeBannerTriggers({ onTrigger, onPointerUp });
        window.dispatchEvent(new Event('pointerdown'));
        unsubscribe();
        expect(onTrigger).not.toHaveBeenCalled();
        expect(onPointerUp).not.toHaveBeenCalled();
    });

    it('캡처 단계로 들어 대상이 전파를 막아도 받는다', () => {
        const onTrigger = vi.fn();
        const unsubscribe = subscribeBannerTriggers({
            onTrigger,
            onPointerUp: vi.fn(),
        });
        const button = document.createElement('button');
        button.addEventListener('click', e => e.stopPropagation());
        document.body.append(button);
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        unsubscribe();
        button.remove();
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('반환 함수를 부르면 모든 리스너를 걷는다', () => {
        const onTrigger = vi.fn();
        const onPointerUp = vi.fn();
        const unsubscribe = subscribeBannerTriggers({ onTrigger, onPointerUp });
        unsubscribe();
        [...BANNER_TRIGGER_EVENTS, 'pointerup'].forEach(type =>
            window.dispatchEvent(new Event(type))
        );
        expect(onTrigger).not.toHaveBeenCalled();
        expect(onPointerUp).not.toHaveBeenCalled();
    });
});
