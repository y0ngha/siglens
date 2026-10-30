// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useDeferredInstallPrompt } from '@/features/pwa-install/hooks/useDeferredInstallPrompt';

function dispatchPromptEvent(
    outcome: 'accepted' | 'dismissed',
    prompt = vi.fn().mockResolvedValue(undefined)
): void {
    window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
            prompt,
            userChoice: Promise.resolve({ outcome }),
        })
    );
}

describe('useDeferredInstallPrompt', () => {
    it('받아 둔 프롬프트가 없으면 false로 끝난다', async () => {
        const { result } = renderHook(() => useDeferredInstallPrompt(true));
        await expect(result.current()).resolves.toBe(false);
    });

    it('받아 둔 프롬프트를 띄우고 수락 여부를 돌려준다', async () => {
        const { result } = renderHook(() => useDeferredInstallPrompt(true));
        act(() => {
            dispatchPromptEvent('accepted');
        });
        await expect(result.current()).resolves.toBe(true);
    });

    it('연달아 불러도 같은 프롬프트를 한 번만 띄운다', async () => {
        const { result } = renderHook(() => useDeferredInstallPrompt(true));
        const prompt = vi.fn().mockResolvedValue(undefined);
        act(() => {
            dispatchPromptEvent('dismissed', prompt);
        });
        await act(async () => {
            await Promise.all([result.current(), result.current()]);
        });
        expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('enabled=false면 프롬프트를 받아 두지 않는다', async () => {
        const { result } = renderHook(() => useDeferredInstallPrompt(false));
        const prompt = vi.fn().mockResolvedValue(undefined);
        act(() => {
            dispatchPromptEvent('accepted', prompt);
        });
        await act(async () => {
            await result.current();
        });
        expect(prompt).not.toHaveBeenCalled();
    });

    it('리렌더해도 같은 함수를 돌려준다', () => {
        const { result, rerender } = renderHook(() =>
            useDeferredInstallPrompt(true)
        );
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
