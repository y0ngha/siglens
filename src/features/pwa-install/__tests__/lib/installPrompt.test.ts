// @vitest-environment jsdom
import {
    type BeforeInstallPromptEvent,
    runInstallPrompt,
    subscribeBeforeInstallPrompt,
} from '@/features/pwa-install/lib/installPrompt';

function makePromptEvent(
    outcome: 'accepted' | 'dismissed',
    prompt: () => Promise<void> = vi.fn().mockResolvedValue(undefined)
): BeforeInstallPromptEvent {
    return Object.assign(
        new Event('beforeinstallprompt', { cancelable: true }),
        { prompt, userChoice: Promise.resolve({ outcome }) }
    );
}

describe('subscribeBeforeInstallPrompt', () => {
    it('받은 이벤트를 onPrompt에 넘긴다', () => {
        const onPrompt = vi.fn();
        const unsubscribe = subscribeBeforeInstallPrompt(onPrompt);
        const event = makePromptEvent('accepted');
        window.dispatchEvent(event);
        unsubscribe();
        expect(onPrompt).toHaveBeenCalledWith(event);
    });

    it('브라우저 기본 설치 인포바를 막는다(preventDefault)', () => {
        const unsubscribe = subscribeBeforeInstallPrompt(vi.fn());
        const event = makePromptEvent('accepted');
        window.dispatchEvent(event);
        unsubscribe();
        expect(event.defaultPrevented).toBe(true);
    });

    it('반환 함수를 부르면 더 받지 않는다', () => {
        const onPrompt = vi.fn();
        const unsubscribe = subscribeBeforeInstallPrompt(onPrompt);
        unsubscribe();
        window.dispatchEvent(makePromptEvent('accepted'));
        expect(onPrompt).not.toHaveBeenCalled();
    });
});

describe('runInstallPrompt', () => {
    it('프롬프트를 띄운다', async () => {
        const prompt = vi.fn().mockResolvedValue(undefined);
        await runInstallPrompt(makePromptEvent('accepted', prompt));
        expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('수락하면 true', async () => {
        await expect(
            runInstallPrompt(makePromptEvent('accepted'))
        ).resolves.toBe(true);
    });

    it('거절하면 false', async () => {
        await expect(
            runInstallPrompt(makePromptEvent('dismissed'))
        ).resolves.toBe(false);
    });

    describe('프롬프트가 실패하면', () => {
        const error = new Error('NotAllowedError');
        const failingEvent = (): BeforeInstallPromptEvent =>
            makePromptEvent('accepted', vi.fn().mockRejectedValue(error));

        it('false', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            await expect(runInstallPrompt(failingEvent())).resolves.toBe(false);
            warn.mockRestore();
        });

        it('경고를 남긴다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            await runInstallPrompt(failingEvent());
            expect(warn).toHaveBeenCalledWith('[PWA] prompt 실패', error);
            warn.mockRestore();
        });
    });
});
