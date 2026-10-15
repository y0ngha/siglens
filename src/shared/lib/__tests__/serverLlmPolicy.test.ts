import {
    isServerLlmAllowed,
    runWithoutServerLlm,
} from '@/shared/lib/serverLlmPolicy';

describe('serverLlmPolicy', () => {
    it('기본값은 허용이다(웹·에이전트는 감싸지 않는다)', () => {
        expect(isServerLlmAllowed()).toBe(true);
    });

    it('runWithoutServerLlm 안에서는 동기·비동기·백그라운드 흐름 모두 막힌다', async () => {
        const seen: boolean[] = [];
        await runWithoutServerLlm(async () => {
            seen.push(isServerLlmAllowed());
            await Promise.resolve();
            seen.push(isServerLlmAllowed());
            await new Promise<void>(resolve =>
                setTimeout(() => {
                    seen.push(isServerLlmAllowed());
                    resolve();
                }, 0)
            );
            void Promise.resolve().then(() => seen.push(isServerLlmAllowed()));
            await Promise.resolve();
        });
        expect(seen).toEqual([false, false, false, false]);
    });

    it('바깥 흐름과 동시에 도는 다른 흐름에는 번지지 않는다', async () => {
        const outside: boolean[] = [];
        const inside = runWithoutServerLlm(async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return isServerLlmAllowed();
        });
        outside.push(isServerLlmAllowed());
        await Promise.resolve();
        outside.push(isServerLlmAllowed());
        await expect(inside).resolves.toBe(false);
        expect(outside).toEqual([true, true]);
        expect(isServerLlmAllowed()).toBe(true);
    });
});
