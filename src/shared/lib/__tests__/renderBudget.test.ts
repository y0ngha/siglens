import { describe, expect, it } from 'vitest';
import {
    isBatchWork,
    isRenderBudgetActive,
    runAsBatchWork,
    runWithRenderBudget,
} from '@/shared/lib/renderBudget';

describe('renderBudget', () => {
    it('표식 밖에서는 비활성이다', () => {
        expect(isRenderBudgetActive()).toBe(false);
    });

    it('표식 안의 await 체인 끝까지 활성 상태가 전파된다', async () => {
        const seen = await runWithRenderBudget(async () => {
            await Promise.resolve();
            const nested = await new Promise<boolean>(resolve =>
                setTimeout(() => resolve(isRenderBudgetActive()), 0)
            );
            return [isRenderBudgetActive(), nested];
        });
        expect(seen).toEqual([true, true]);
    });

    it('표식이 끝나면 다시 비활성이다 — 바깥 컨텍스트로 새지 않는다', async () => {
        await runWithRenderBudget(() => Promise.resolve('done'));
        expect(isRenderBudgetActive()).toBe(false);
    });

    it('fn의 결과와 rejection을 그대로 돌려준다', async () => {
        await expect(
            runWithRenderBudget(() => Promise.resolve(42))
        ).resolves.toBe(42);
        await expect(
            runWithRenderBudget(() => Promise.reject(new Error('boom')))
        ).rejects.toThrow('boom');
    });

    it('배치 표식은 렌더 래퍼보다 우선한다 — cron이 렌더 래퍼를 불러도 렌더 예산이 걸리지 않는다', async () => {
        const seen = await runAsBatchWork(() =>
            runWithRenderBudget(async () => [
                isRenderBudgetActive(),
                isBatchWork(),
            ])
        );
        expect(seen).toEqual([false, true]);
    });

    it('렌더 안에서 배치를 명시하면 배치가 된다', async () => {
        const seen = await runWithRenderBudget(() =>
            runAsBatchWork(async () => isRenderBudgetActive())
        );
        expect(seen).toBe(false);
    });
});
