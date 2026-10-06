// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall } from '@/features/pwa-install/hooks/usePwaInstall';
import { _resetRegisterServiceWorkerForTests } from '@/features/pwa-install/lib/registerServiceWorker';
import { PWA_BANNER_DISMISSED_STORAGE_KEY } from '@/features/pwa-install/lib/bannerDismissal';

describe('usePwaInstall', () => {
    beforeAll(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }),
        });
        Object.defineProperty(navigator, 'serviceWorker', {
            writable: true,
            value: {
                register: vi.fn().mockResolvedValue(undefined),
                addEventListener: vi.fn(),
                controller: null,
            },
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    beforeEach(() => {
        _resetRegisterServiceWorkerForTests();
        localStorage.clear();
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

    it('첫 pointerdown → iPhone이면 showBanner=true', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
        });
        expect(result.current.showBanner).toBe(true);
    });

    it('handleDismiss → showBanner=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
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
            window.dispatchEvent(new Event('pointerdown'));
        });
        act(() => {
            void result.current.handleInstall();
        });
        expect(result.current.showIosModal).toBe(true);
    });

    it('handleModalClose → showIosModal=false', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
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

    it('데스크탑 UA → pointerdown 이후에도 showBanner=false', () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            configurable: true,
        });
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
        });
        expect(result.current.showBanner).toBe(false);
    });

    it('Android: beforeinstallprompt → handleInstall → prompt() 호출, accepted 시 showBanner=false', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            configurable: true,
        });

        const mockPrompt = vi.fn().mockResolvedValue(undefined);
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
        // 설치 후 브라우저 탭으로 다시 와도 권유하지 않는다.
        expect(localStorage.getItem(PWA_BANNER_DISMISSED_STORAGE_KEY)).toBe(
            '1'
        );
    });

    it('Android: beforeinstallprompt → handleInstall → dismissed 시 showBanner 유지', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            configurable: true,
        });

        const mockPrompt = vi.fn().mockResolvedValue(undefined);
        const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
            prompt: mockPrompt,
            userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
        });

        const { result } = renderHook(() => usePwaInstall());

        act(() => {
            window.dispatchEvent(promptEvent);
        });
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
        });

        await act(async () => {
            await result.current.handleInstall();
        });

        expect(mockPrompt).toHaveBeenCalledTimes(1);
        expect(result.current.showBanner).toBe(true);
    });

    /**
     * 타이머가 아니라 첫 입력이 방아쇠다 — 하이드레이션 직후 타이머로 띄우면
     * 배너 삽입이 그대로 CLS가 된다(2026-09-18 모바일 실측 0.0605). 입력 500ms
     * 안의 이동은 CLS에서 제외되므로 첫 `pointerdown`까지 기다린다.
     */
    it('첫 pointerdown 전에는 배너를 띄우지 않는다', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            // 분석 완료 방아쇠(`siglens:pwa-trigger`)는 제거됐다 — 회원은 입력
            // 없이도 마운트 직후 분석이 돌아 배너가 삽입됐다.
            window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
            vi.advanceTimersByTime(30_000);
        });
        expect(result.current.showBanner).toBe(false);
    });

    it('키보드 사용자도 첫 keydown으로 배너를 받는다', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('keydown'));
        });
        expect(result.current.showBanner).toBe(true);
    });

    /**
     * 회귀: 방아쇠 두 개(`pointerdown`, `keydown`)가 각자 `once`로 걸려 있으면
     * 한쪽이 배너를 띄우고 사용자가 닫은 뒤에도 다른 쪽이 남아 배너를 다시 띄웠다.
     * 어느 쪽이든 먼저 발화하면 모든 방아쇠를 해제해야 한다.
     */
    it('pointerdown으로 뜬 배너를 닫은 뒤 keydown이 배너를 다시 띄우지 않는다', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
        });
        expect(result.current.showBanner).toBe(true);
        act(() => {
            result.current.handleDismiss();
        });
        act(() => {
            window.dispatchEvent(new Event('keydown'));
        });
        expect(result.current.showBanner).toBe(false);
    });

    it('keydown으로 뜬 배너를 닫은 뒤 pointerdown이 배너를 다시 띄우지 않는다', () => {
        const { result } = renderHook(() => usePwaInstall());
        act(() => {
            window.dispatchEvent(new Event('keydown'));
        });
        act(() => {
            result.current.handleDismiss();
        });
        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
        });
        expect(result.current.showBanner).toBe(false);
    });

    describe('닫기 기억(localStorage)', () => {
        it('닫으면 저장소에 남기고, 다음 마운트에서는 첫 입력에도 배너를 띄우지 않는다', () => {
            const first = renderHook(() => usePwaInstall());
            act(() => {
                window.dispatchEvent(new Event('pointerdown'));
            });
            act(() => {
                first.result.current.handleDismiss();
            });
            expect(localStorage.getItem(PWA_BANNER_DISMISSED_STORAGE_KEY)).toBe(
                '1'
            );
            first.unmount();

            const second = renderHook(() => usePwaInstall());
            act(() => {
                window.dispatchEvent(new Event('pointerdown'));
            });
            expect(second.result.current.showBanner).toBe(false);
        });

        it('저장소 접근이 throw해도(프라이빗 모드) 배너는 뜨고 닫힌다', () => {
            const getItem = vi
                .spyOn(Storage.prototype, 'getItem')
                .mockImplementation(() => {
                    throw new Error('SecurityError');
                });
            const setItem = vi
                .spyOn(Storage.prototype, 'setItem')
                .mockImplementation(() => {
                    throw new Error('QuotaExceededError');
                });
            const { result } = renderHook(() => usePwaInstall());
            act(() => {
                window.dispatchEvent(new Event('pointerdown'));
            });
            expect(result.current.showBanner).toBe(true);
            act(() => {
                result.current.handleDismiss();
            });
            expect(result.current.showBanner).toBe(false);
            getItem.mockRestore();
            setItem.mockRestore();
        });
    });
});
