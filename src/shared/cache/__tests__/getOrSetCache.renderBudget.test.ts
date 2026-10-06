import { describe, expect, it, vi } from 'vitest';

// Redis 없이 in-flight dedup만 본다 — Redis 미구성이면 getOrSetCache는 fetch+dedup만 한다.
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => null,
}));

import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    isRenderBudgetActive,
    runAsBatchWork,
    runWithRenderBudget,
} from '@/shared/lib/renderBudget';

/**
 * 렌더 예산 표식(ALS)이 `getOrSetCache`의 in-flight 공유를 지날 때의 동작을 고정한다
 * (`renderBudget.ts` "알고 쓸 것").
 *
 * - fetcher는 **먼저 시작한 호출자의** 컨텍스트에서 한 번만 돈다.
 * - 합류한 호출자는 그 결과(실패 포함)를 그대로 받는다.
 * - 공유가 끝나면 다음 호출은 자기 컨텍스트로 다시 fetch한다 — 실패가 남지 않는다.
 */
describe('getOrSetCache × renderBudget', () => {
    it('렌더가 먼저 시작하면 fetcher는 렌더 예산으로 한 번 돌고, 합류한 배치도 그 결과를 받는다', async () => {
        let release!: () => void;
        const seen: boolean[] = [];
        const fetcher = vi.fn(async () => {
            seen.push(isRenderBudgetActive());
            await new Promise<void>(resolve => {
                release = resolve;
            });
            return 'v';
        });

        const render = runWithRenderBudget(() =>
            getOrSetCache('k:render-first', 60, fetcher)
        );
        const batch = runAsBatchWork(() =>
            getOrSetCache('k:render-first', 60, fetcher)
        );
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
        release();

        await expect(Promise.all([render, batch])).resolves.toEqual(['v', 'v']);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(seen).toEqual([true]);
    });

    it('공유된 실패는 남지 않는다 — 다음 배치 호출은 자기 컨텍스트(예산 밖)로 다시 fetch한다', async () => {
        const seen: boolean[] = [];
        const failing = vi.fn(async () => {
            seen.push(isRenderBudgetActive());
            throw new Error('render budget exceeded');
        });
        await expect(
            runWithRenderBudget(() => getOrSetCache('k:retry', 60, failing))
        ).rejects.toThrow('render budget exceeded');

        const ok = vi.fn(async () => {
            seen.push(isRenderBudgetActive());
            return 'fresh';
        });
        await expect(
            runAsBatchWork(() => getOrSetCache('k:retry', 60, ok))
        ).resolves.toBe('fresh');
        expect(seen).toEqual([true, false]);
    });
});
