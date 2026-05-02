/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall } from '@/components/pwa/hooks/usePwaInstall';

describe('usePwaInstall', () => {
    beforeAll(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }),
        });
        Object.defineProperty(navigator, 'serviceWorker', {
            writable: true,
            value: { register: jest.fn().mockResolvedValue(undefined) },
        });
    });

    beforeEach(() => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            configurable: true,
        });
    });

    it('초기 상태: showBanner=false, showIosModal=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        expect(result.current.showBanner).toBe(false);
        expect(result.current.showIosModal).toBe(false);
    });

    it('siglens:pwa-trigger 이벤트 → iPhone이면 showBanner=true', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
        });
        expect(result.current.showBanner).toBe(true);
    });

    it('handleDismiss → showBanner=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
        });
        expect(result.current.showBanner).toBe(true);
        act(() => {
            result.current.handleDismiss();
        });
        expect(result.current.showBanner).toBe(false);
    });

    it('iOS에서 handleInstall → showIosModal=true', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
        });
        act(() => {
            void result.current.handleInstall();
        });
        expect(result.current.showIosModal).toBe(true);
    });

    it('handleModalClose → showIosModal=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
        });
        act(() => { void result.current.handleInstall(); });
        expect(result.current.showIosModal).toBe(true);
        act(() => { result.current.handleModalClose(); });
        expect(result.current.showIosModal).toBe(false);
    });

    it('데스크탑 UA → pwa-trigger 이후에도 showBanner=false', () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            configurable: true,
        });
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
        });
        expect(result.current.showBanner).toBe(false);
    });

    it('30초 폴백 타이머 → 모바일에서 showBanner=true', () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => usePwaInstall());
        expect(result.current.showBanner).toBe(false);
        act(() => {
            jest.advanceTimersByTime(30_000);
        });
        expect(result.current.showBanner).toBe(true);
        jest.useRealTimers();
    });
});
