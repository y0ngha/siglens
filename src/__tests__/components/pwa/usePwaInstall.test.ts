/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';
import {
    usePwaInstall,
    PWA_BANNER_FALLBACK_DELAY_MS,
} from '@/components/pwa/hooks/usePwaInstall';
import { _resetRegisterServiceWorkerForTests } from '@/components/pwa/utils/registerServiceWorker';
import { PWA_TRIGGER_EVENT } from '@/lib/pwaEvents';

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
            value: {
                register: jest.fn().mockResolvedValue(undefined),
                addEventListener: jest.fn(),
                controller: null,
            },
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    beforeEach(() => {
        _resetRegisterServiceWorkerForTests();
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
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        });
        expect(result.current.showBanner).toBe(true);
    });

    it('handleDismiss → showBanner=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
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
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        });
        act(() => {
            void result.current.handleInstall();
        });
        expect(result.current.showIosModal).toBe(true);
    });

    it('handleModalClose → showIosModal=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        });
        act(() => {
            void result.current.handleInstall();
        });
        expect(result.current.showIosModal).toBe(true);
        act(() => {
            result.current.handleModalClose();
        });
        expect(result.current.showIosModal).toBe(false);
    });

    it('데스크탑 UA → pwa-trigger 이후에도 showBanner=false', () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            configurable: true,
        });
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        });
        expect(result.current.showBanner).toBe(false);
    });

    it('Android: beforeinstallprompt → handleInstall → prompt() 호출, accepted 시 showBanner=false', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            configurable: true,
        });

        const mockPrompt = jest.fn().mockResolvedValue(undefined);
        const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
            prompt: mockPrompt,
            userChoice: Promise.resolve({ outcome: 'accepted' as const }),
        });

        const { result } = renderHook(() => usePwaInstall());

        act(() => {
            window.dispatchEvent(promptEvent);
        });

        await act(async () => {
            await result.current.handleInstall();
        });

        expect(mockPrompt).toHaveBeenCalledTimes(1);
        expect(result.current.showBanner).toBe(false);
    });

    it('Android: beforeinstallprompt → handleInstall → dismissed 시 showBanner 유지', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            configurable: true,
        });

        const mockPrompt = jest.fn().mockResolvedValue(undefined);
        const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
            prompt: mockPrompt,
            userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
        });

        const { result } = renderHook(() => usePwaInstall());

        act(() => {
            window.dispatchEvent(promptEvent);
        });
        act(() => {
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        });

        await act(async () => {
            await result.current.handleInstall();
        });

        expect(mockPrompt).toHaveBeenCalledTimes(1);
        expect(result.current.showBanner).toBe(true);
    });

    it('30초 폴백 타이머 → 모바일에서 showBanner=true', () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => usePwaInstall());
        expect(result.current.showBanner).toBe(false);
        act(() => {
            jest.advanceTimersByTime(PWA_BANNER_FALLBACK_DELAY_MS);
        });
        expect(result.current.showBanner).toBe(true);
    });
});
