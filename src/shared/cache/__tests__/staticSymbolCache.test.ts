// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17: vi.mock을 import 사이에 끼우지
// 않고, 팩토리가 참조하는 spy는 vi.hoisted로 끌어올린다).
const unstableCacheSpy = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({
    // unstable_cache(fn, keyParts, opts) → returns a function that calls fn.
    unstable_cache: (fn: () => unknown, keyParts: string[], opts: unknown) => {
        unstableCacheSpy(keyParts, opts, fn);
        return fn;
    },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SECONDS_PER_HOUR, SECONDS_PER_DAY } from '@/shared/config/time';
import {
    STATIC_SYMBOL_CACHE_VERSION,
    staticSymbolCache,
} from '@/shared/cache/staticSymbolCache';
import { isRenderBudgetActive } from '@/shared/lib/renderBudget';

describe('staticSymbolCache', () => {
    beforeEach(() => unstableCacheSpy.mockClear());

    it('fetcher 결과를 반환하고 keyParts/revalidate/symbol 태그를 unstable_cache에 전달한다', async () => {
        const result = await staticSymbolCache(
            ['fundamental:profile', 'AAPL'],
            'AAPL',
            () => Promise.resolve({ ok: true })
        );
        expect(result).toEqual({ ok: true });
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            [STATIC_SYMBOL_CACHE_VERSION, 'fundamental:profile', 'AAPL'],
            { revalidate: SECONDS_PER_HOUR, tags: ['symbol:AAPL'] },
            expect.any(Function)
        );
    });

    it('extraTags를 symbol 태그 뒤에 덧붙인다(news:${symbol} 그룹 무효화용)', async () => {
        await staticSymbolCache(
            ['news:list', 'AAPL'],
            'AAPL',
            () => Promise.resolve([]),
            ['news:AAPL']
        );
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            [STATIC_SYMBOL_CACHE_VERSION, 'news:list', 'AAPL'],
            {
                revalidate: SECONDS_PER_HOUR,
                tags: ['symbol:AAPL', 'news:AAPL'],
            },
            expect.any(Function)
        );
    });

    it('revalidateSeconds를 명시하면 기본 1h 대신 전달한 값으로 revalidate한다', async () => {
        await staticSymbolCache(
            ['financials:income', 'AAPL', 'annual'],
            'AAPL',
            () => Promise.resolve([]),
            [],
            SECONDS_PER_DAY
        );
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            [
                STATIC_SYMBOL_CACHE_VERSION,
                'financials:income',
                'AAPL',
                'annual',
            ],
            { revalidate: SECONDS_PER_DAY, tags: ['symbol:AAPL'] },
            expect.any(Function)
        );
    });

    /**
     * `unstable_cache`는 키를 `cb.toString()` + keyParts로 만든다. 호출부 closure가 그대로
     * 넘어가면 소스 텍스트가 다른 호출부끼리 같은 keyParts여도 엔트리가 갈린다(감사 M4).
     */
    it('호출부 closure가 달라도 unstable_cache에 넘기는 콜백 텍스트는 같다 — 키가 keyParts로만 정해진다', async () => {
        const getProfile = (s: string) => Promise.resolve({ s });
        const provider = { getProfile };
        await staticSymbolCache(['fundamental:profile', 'AAPL'], 'AAPL', () =>
            getProfile('AAPL')
        );
        await staticSymbolCache(['fundamental:profile', 'AAPL'], 'AAPL', () =>
            provider.getProfile('AAPL')
        );
        const [first, second] = unstableCacheSpy.mock.calls.map(([, , fn]) =>
            (fn as () => unknown).toString()
        );
        expect(first).toBe(second);
    });

    it('fetcher를 렌더 예산 안에서 실행한다', async () => {
        const seen = await staticSymbolCache(['k', 'AAPL'], 'AAPL', () =>
            Promise.resolve(isRenderBudgetActive())
        );
        expect(seen).toBe(true);
    });

    it('모든 키 앞에 명시적인 버전 keyPart를 붙인다 — 올리면 전 엔트리가 은퇴한다', async () => {
        await staticSymbolCache(['k', 'AAPL'], 'AAPL', () =>
            Promise.resolve(1)
        );
        const [keyParts] = unstableCacheSpy.mock.calls[0]!;
        expect(keyParts).toEqual(['ssc-v1', 'k', 'AAPL']);
    });
});
