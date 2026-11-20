import {
    ACTIVE_MAX_SYMBOLS,
    ACTIVE_MIN_VIEWS,
    OVERALL_WARM_MAX_SYMBOLS,
    VIEW_DEMAND_LOOKBACK_DAYS,
    VIEW_DEMAND_UNKNOWN,
    loadViewDemand,
    selectViewDemand,
} from '../viewDemand';
import type { SymbolViewRepository } from '@/entities/symbol-view/api';
import type { SymbolViewTally } from '@/entities/symbol-view/types';

function tally(symbol: string, views: number): SymbolViewTally {
    return { symbol, views };
}

/** `AAA000`…처럼 유니버스 안에 있는 합성 심볼 n개(조회 많은 순). */
function syntheticTallies(count: number): readonly SymbolViewTally[] {
    return Array.from({ length: count }, (_, i) =>
        tally(`S${String(i).padStart(3, '0')}`, count - i + 10)
    );
}

function universeOf(tallies: readonly SymbolViewTally[]): string[] {
    return tallies.map(t => t.symbol);
}

describe('selectViewDemand', () => {
    it('유니버스 밖 심볼은 활성 집합과 종합 대상에서 모두 뺀다', () => {
        const result = selectViewDemand(
            [tally('AAPL', 9), tally('NOPE', 8), tally('MSFT', 7)],
            ['AAPL', 'MSFT']
        );

        expect([...(result.active ?? [])]).toEqual(['AAPL', 'MSFT']);
        expect(result.overallWarm).toEqual(['AAPL', 'MSFT']);
    });

    it('저장소가 준 순서(조회 많은 순)를 그대로 지킨다', () => {
        const result = selectViewDemand(
            [tally('MSFT', 9), tally('AAPL', 9), tally('TSLA', 3)],
            ['AAPL', 'MSFT', 'TSLA']
        );

        expect(result.overallWarm).toEqual(['MSFT', 'AAPL', 'TSLA']);
    });

    it('소문자 집계 행과 소문자 유니버스도 대문자로 맞춘다', () => {
        const result = selectViewDemand([tally('aapl', 5)], ['aapl']);

        expect(result.active?.has('AAPL')).toBe(true);
        expect(result.overallWarm).toEqual(['AAPL']);
    });

    it('활성 집합은 ACTIVE_MAX_SYMBOLS에서 자른다', () => {
        const tallies = syntheticTallies(ACTIVE_MAX_SYMBOLS + 30);

        const result = selectViewDemand(tallies, universeOf(tallies));

        expect(result.active?.size).toBe(ACTIVE_MAX_SYMBOLS);
        expect(result.active?.has(tallies[ACTIVE_MAX_SYMBOLS - 1].symbol)).toBe(
            true
        );
        expect(result.active?.has(tallies[ACTIVE_MAX_SYMBOLS].symbol)).toBe(
            false
        );
    });

    it('종합 대상은 상위 OVERALL_WARM_MAX_SYMBOLS개이고 순서가 활성 순서의 앞부분이다', () => {
        const tallies = syntheticTallies(ACTIVE_MAX_SYMBOLS + 30);

        const result = selectViewDemand(tallies, universeOf(tallies));

        expect(result.overallWarm).toHaveLength(OVERALL_WARM_MAX_SYMBOLS);
        expect(result.overallWarm).toEqual(
            tallies.slice(0, OVERALL_WARM_MAX_SYMBOLS).map(t => t.symbol)
        );
    });

    it('유니버스 밖 심볼은 상한 자리를 차지하지 않는다', () => {
        const inside = syntheticTallies(ACTIVE_MAX_SYMBOLS);
        const outside = Array.from({ length: 50 }, (_, i) =>
            tally(`OUT${i}`, 1_000 - i)
        );

        const result = selectViewDemand(
            [...outside, ...inside],
            universeOf(inside)
        );

        expect(result.active?.size).toBe(ACTIVE_MAX_SYMBOLS);
        expect(result.active?.has('OUT0')).toBe(false);
    });

    it('집계가 비면 활성 집합은 비어 있고(알려진 "아무도 안 봄") 종합 대상도 없다', () => {
        const result = selectViewDemand([], ['AAPL']);

        expect(result.active).not.toBeNull();
        expect(result.active?.size).toBe(0);
        expect(result.overallWarm).toEqual([]);
    });
});

describe('loadViewDemand', () => {
    function repoWith(
        topViewed: SymbolViewRepository['topViewed']
    ): SymbolViewRepository {
        return {
            recordView: vi.fn(),
            pruneOlderThan: vi.fn(),
            topViewed,
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('오늘(KST)을 포함한 7일 창과 최소 조회수로 읽는다', async () => {
        const topViewed = vi.fn().mockResolvedValue([tally('AAPL', 4)]);
        // 2026-11-21 03:00Z = KST 11-21 12:00 → 창 시작 11-15(오늘 포함 7일).
        const now = new Date('2026-11-21T03:00:00.000Z');

        const result = await loadViewDemand(repoWith(topViewed), ['AAPL'], now);

        expect(VIEW_DEMAND_LOOKBACK_DAYS).toBe(7);
        expect(topViewed).toHaveBeenCalledTimes(1);
        expect(topViewed).toHaveBeenCalledWith('2026-11-15', ACTIVE_MIN_VIEWS);
        expect(result.overallWarm).toEqual(['AAPL']);
    });

    it('집계가 비면(비콘이 죽은 것으로 본다) 전부 활성으로 되돌리고 읽기 오류와 다른 문구를 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const topViewed = vi.fn().mockResolvedValue([]);

        const result = await loadViewDemand(
            repoWith(topViewed),
            ['AAPL'],
            new Date('2026-11-21T03:00:00.000Z')
        );
        const messages = warn.mock.calls.map(call => String(call[0]));
        warn.mockRestore();

        expect(result).toBe(VIEW_DEMAND_UNKNOWN);
        expect(messages).toEqual([
            '[seo-prewarm] view tally empty, treating all symbols as active',
        ]);
    });

    it('집계에 행이 있으면 유니버스 밖뿐이어도 빈 집계로 보지 않는다', async () => {
        const topViewed = vi.fn().mockResolvedValue([tally('NOPE', 5)]);

        const result = await loadViewDemand(
            repoWith(topViewed),
            ['AAPL'],
            new Date('2026-11-21T03:00:00.000Z')
        );

        expect(result.active?.size).toBe(0);
    });

    it('UTC로는 전날이어도 KST 날짜로 창을 센다', async () => {
        const topViewed = vi.fn().mockResolvedValue([]);
        // 2026-11-20 16:00Z = KST 11-21 01:00.
        const now = new Date('2026-11-20T16:00:00.000Z');

        await loadViewDemand(repoWith(topViewed), ['AAPL'], now);

        expect(topViewed).toHaveBeenCalledWith('2026-11-15', ACTIVE_MIN_VIEWS);
    });

    it('집계를 못 읽으면 전부 활성으로 보고 경고를 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const topViewed = vi.fn().mockRejectedValue(new Error('db down'));

        const result = await loadViewDemand(
            repoWith(topViewed),
            ['AAPL'],
            new Date('2026-11-21T03:00:00.000Z')
        );
        const messages = warn.mock.calls.map(call => String(call[0]));
        warn.mockRestore();

        expect(result).toBe(VIEW_DEMAND_UNKNOWN);
        expect(result.active).toBeNull();
        expect(result.overallWarm).toEqual([]);
        expect(
            messages.some(m =>
                m.includes(
                    '[seo-prewarm] view tally unavailable, treating all symbols as active'
                )
            )
        ).toBe(true);
    });

    it('DB 오류의 바인딩 파라미터는 로그에 싣지 않는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const dbError = Object.assign(
            new Error(
                'Failed query: select ... params: secret-token-123, 2026-11-15'
            ),
            { name: 'Error' }
        );
        const topViewed = vi.fn().mockRejectedValue(dbError);

        await loadViewDemand(
            repoWith(topViewed),
            ['AAPL'],
            new Date('2026-11-21T03:00:00.000Z')
        );
        // Error는 JSON.stringify가 `{}`로 만들어 버려 단언이 비어 버린다 — 메시지와 스택을 직접 편다.
        const logged = warn.mock.calls
            .flat()
            .map(arg =>
                arg instanceof Error
                    ? `${arg.message} ${arg.stack ?? ''}`
                    : String(arg)
            )
            .join(' ');
        warn.mockRestore();

        expect(logged).toContain('view tally unavailable');
        expect(logged).not.toContain('secret-token-123');
    });
});
