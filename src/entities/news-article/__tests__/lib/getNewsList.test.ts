/**
 * getNewsList — entities/news-article 어댑터 헬퍼.
 *
 * 검증:
 * - 정상: DrizzleNewsRepository.listCardsBySymbol을 올바른 인자(symbol, NEWS_LOOKBACK_MS)로 호출
 * - 동일 symbol 호출은 idempotent — 같은 result를 반환한다 (purity 보장).
 *   React.cache의 per-request memoization은 RSC AsyncLocalStorage scope에 의존하므로
 *   vitest 단위 테스트(Node, RSC scope 없음)에서는 검증하지 않는다.
 * - 다른 symbol은 cache key가 분리돼 각각 호출됨 (회귀 가드)
 * - listCardsBySymbol throw 시 예외 그대로 상위로 전파 (ISR safety 위임)
 *
 * mock 패턴: getNewsList는 같은 모듈(api.ts)의 DrizzleNewsRepository를 사용하므로
 * 외부 import 경로 vi.mock은 같은-모듈 내부 참조에 영향 못 준다. 대신
 * DrizzleNewsRepository.prototype.listCardsBySymbol을 vi.spyOn으로 가로채 같은 효과를 낸다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: { __mock: true } }),
}));

import {
    DrizzleNewsRepository,
    getNewsList,
} from '@/entities/news-article/api';
// 같은 슬라이스 내부 segment는 relative import (CONVENTIONS.md §FSD Slice Internal Imports).
import { NEWS_LOOKBACK_MS } from '../../lib/newsLookback';

const listCardsBySymbolSpy = vi.spyOn(
    DrizzleNewsRepository.prototype,
    'listCardsBySymbol'
);

describe('getNewsList', () => {
    beforeEach(() => {
        listCardsBySymbolSpy.mockReset();
    });

    it('listCardsBySymbol을 (symbol, NEWS_LOOKBACK_MS)로 호출하고 결과를 그대로 반환한다', async () => {
        const rows = [{ id: 'r1' }] as never;
        listCardsBySymbolSpy.mockResolvedValueOnce(rows);

        const result = await getNewsList('AAPL', 'ko');

        expect(listCardsBySymbolSpy).toHaveBeenCalledWith(
            'AAPL',
            NEWS_LOOKBACK_MS,
            'ko'
        );
        expect(result).toBe(rows);
    });

    it('vitest 환경에서는 React.cache가 작동하지 않아 두 번 모두 listCardsBySymbol을 호출한다 (RSC scope 없음 명시 검증)', async () => {
        // 주의: React.cache의 per-request memoization은 RSC AsyncLocalStorage scope에
        // 의존하므로 vitest 단위 테스트(Node, RSC scope 없음)에서는 두 호출 모두
        // listCardsBySymbol을 거친다. cache 효과는 통합/E2E에서 검증한다.
        // 본 케이스는 cache가 미작동 = 두 번 호출됨을 명시적으로 보장해 환경 가정을 고정한다.
        const rows = [{ id: 'r1' }] as never;
        listCardsBySymbolSpy.mockResolvedValue(rows);

        const a = await getNewsList('TSLA', 'ko');
        const b = await getNewsList('TSLA', 'ko');

        expect(a).toEqual(b);
        expect(a).toEqual(rows);
        // RSC scope 없음 → 캐시 미작동 → listCardsBySymbol 2회 호출 (회귀 가드)
        expect(listCardsBySymbolSpy).toHaveBeenCalledTimes(2);
    });

    it('다른 symbol은 cache key가 분리돼 각각 listCardsBySymbol을 호출한다 (회귀 가드)', async () => {
        listCardsBySymbolSpy.mockResolvedValueOnce([{ id: 'aapl-1' }] as never);
        listCardsBySymbolSpy.mockResolvedValueOnce([{ id: 'msft-1' }] as never);

        await getNewsList('AAPL_KEY_SEP', 'ko');
        await getNewsList('MSFT_KEY_SEP', 'ko');

        expect(listCardsBySymbolSpy).toHaveBeenCalledTimes(2);
        expect(listCardsBySymbolSpy).toHaveBeenNthCalledWith(
            1,
            'AAPL_KEY_SEP',
            NEWS_LOOKBACK_MS,
            'ko'
        );
        expect(listCardsBySymbolSpy).toHaveBeenNthCalledWith(
            2,
            'MSFT_KEY_SEP',
            NEWS_LOOKBACK_MS,
            'ko'
        );
    });

    it('listCardsBySymbol이 throw하면 예외를 그대로 상위로 전파한다 (ISR safety는 호출 측 catch에 위임)', async () => {
        listCardsBySymbolSpy.mockRejectedValueOnce(new Error('db down'));

        await expect(getNewsList('THROW_SYMBOL', 'ko')).rejects.toThrow(
            'db down'
        );
    });
});
