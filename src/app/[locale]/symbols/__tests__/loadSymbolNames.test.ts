/**
 * 이름 로더의 **실패 처리**를 고정한다.
 *
 * 하위 리더는 DB 실패를 자체적으로 삼키고 빈 값을 돌려준다. 그 빈 값을 그대로
 * 반환하면 `unstable_cache`가 "이름 없음"을 TTL 내내 캐시하고, stale-while-revalidate라
 * 만료 뒤 첫 요청도 그 옛 값을 받는다 — 순간적인 DB 딸꾹질 한 번이 하루짜리 품질
 * 저하가 된다. 그래서 빈 결과는 **던져서** 캐시에 안 들어가게 하고, 화면에는 빈 맵으로
 * 떨어뜨린다(링크는 남고 이름만 사라진다).
 */
const { cachedCalls, mockDisplayNames, mockCryptoAsset } = vi.hoisted(() => ({
    cachedCalls: [] as { rejected: boolean }[],
    mockDisplayNames: vi.fn(),
    mockCryptoAsset: vi.fn(),
}));

vi.mock('next/cache', () => ({
    // 캐시 계층을 통과시키되 **거부 여부를 기록**한다 — `unstable_cache`는 거부된
    // promise를 저장하지 않으므로, 던졌다는 사실이 곧 "캐시되지 않았다"의 증거다.
    unstable_cache:
        (fn: (...args: never[]) => Promise<unknown>) =>
        async (...args: never[]) => {
            const record = { rejected: false };
            cachedCalls.push(record);
            try {
                return await fn(...args);
            } catch (error) {
                record.rejected = true;
                throw error;
            }
        },
}));

vi.mock('@/entities/ticker/lib/koreanNameStore', () => ({
    getTickerDisplayNames: mockDisplayNames,
}));
vi.mock('@/entities/ticker/lib/cryptoAssetStore', () => ({
    getCryptoAsset: mockCryptoAsset,
}));

import { loadSymbolNames } from '@/app/[locale]/symbols/loadSymbolNames';

describe('loadSymbolNames', () => {
    beforeEach(() => {
        cachedCalls.length = 0;
        mockDisplayNames.mockReset();
        mockCryptoAsset.mockReset();
        mockCryptoAsset.mockResolvedValue(null);
    });

    it('한글 로케일은 한글명을 `심볼 → 이름`으로 돌려준다', async () => {
        mockDisplayNames.mockResolvedValue({
            AAPL: { koreanName: '애플', name: 'Apple Inc.' },
        });

        const names = await loadSymbolNames(['AAPL'], 'ko');

        expect(names.get('AAPL')).toBe('애플');
        expect(cachedCalls[0].rejected).toBe(false);
    });

    it('비-ko 로케일은 영문명을 쓴다', async () => {
        mockDisplayNames.mockResolvedValue({
            AAPL: { koreanName: '애플', name: 'Apple Inc.' },
        });

        const names = await loadSymbolNames(['AAPL'], 'en');

        expect(names.get('AAPL')).toBe('Apple Inc.');
    });

    it('한글명이 없으면 영문명으로 떨어진다', async () => {
        mockDisplayNames.mockResolvedValue({
            NEWCO: { koreanName: null, name: 'New Co.' },
        });

        expect((await loadSymbolNames(['NEWCO'], 'ko')).get('NEWCO')).toBe(
            'New Co.'
        );
    });

    it('하나도 못 읽으면 캐시에 넣지 않고(던지고) 빈 맵으로 떨어진다', async () => {
        mockDisplayNames.mockResolvedValue({});

        const names = await loadSymbolNames(['AAPL'], 'ko');

        expect(names.size).toBe(0);
        // 던졌다 = `unstable_cache`가 저장하지 않았다 = 다음 요청이 다시 시도한다.
        expect(cachedCalls[0].rejected).toBe(true);
    });

    it('리더가 던져도 페이지는 살린다 — 빈 맵을 돌려준다', async () => {
        mockDisplayNames.mockRejectedValue(new Error('db down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(loadSymbolNames(['AAPL'], 'ko')).resolves.toEqual(
            new Map()
        );
        expect(cachedCalls[0].rejected).toBe(true);
        warn.mockRestore();
    });
});
