import { describe, expect, it, vi } from 'vitest';
import { startWhenResolvable } from '@/app/[locale]/[symbol]/startWhenResolvable';

const ASSET = { symbol: 'AAPL', name: 'Apple Inc.' };

describe('startWhenResolvable', () => {
    it('자산이 실재로 확인되면 load를 시작하고 결과를 돌려준다', async () => {
        const load = vi.fn().mockResolvedValue('data');
        await expect(
            startWhenResolvable(
                Promise.resolve({ assetInfo: ASSET, degraded: false }),
                load
            )
        ).resolves.toBe('data');
        expect(load).toHaveBeenCalledOnce();
    });

    it.each([
        ['실재하지 않는 심볼(null)', { assetInfo: null, degraded: false }],
        [
            '인프라 degrade(실재 여부 모름)',
            { assetInfo: ASSET, degraded: true },
        ],
    ])('%s이면 FMP 묶음을 시작하지 않고 null을 돌려준다', async (_l, asset) => {
        const load = vi.fn();
        await expect(
            startWhenResolvable(Promise.resolve(asset), load)
        ).resolves.toBeNull();
        expect(load).not.toHaveBeenCalled();
    });

    it('아무도 await하지 않은 채 load가 reject해도 unhandledRejection이 나지 않는다', async () => {
        const onUnhandled = vi.fn();
        process.on('unhandledRejection', onUnhandled);
        try {
            // 게이트가 notFound()로 끝나 페이지가 이 프라미스를 버리는 상황.
            void startWhenResolvable(
                Promise.resolve({ assetInfo: ASSET, degraded: false }),
                () => Promise.reject(new Error('fmp down'))
            );
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(onUnhandled).not.toHaveBeenCalled();
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });

    it('await하는 쪽은 같은 rejection을 그대로 받는다', async () => {
        await expect(
            startWhenResolvable(
                Promise.resolve({ assetInfo: ASSET, degraded: false }),
                () => Promise.reject(new Error('fmp down'))
            )
        ).rejects.toThrow('fmp down');
    });
});
