import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { PrewarmBatchCounts } from '../runPrewarmBatch';
import type { SeamOutcome } from '../harvest';

const {
    mockMarkSkipped,
    mockClearInFlight,
    mockMarkStructural,
    mockClearStructural,
    mockPrewarmTechnical,
    mockPrewarmOverall,
    mockPrewarmFundamental,
    mockPrewarmFinancials,
    mockPrewarmCongress,
    mockPrewarmNews,
    mockPrewarmOptions,
} = vi.hoisted(() => ({
    mockMarkSkipped: vi.fn(),
    mockClearInFlight: vi.fn(),
    mockMarkStructural: vi.fn(),
    mockClearStructural: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockPrewarmFinancials: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOptions: vi.fn(),
}));

vi.mock('../lock', () => ({
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
    markStructurallyUnavailable: mockMarkStructural,
    clearStructurallyUnavailable: mockClearStructural,
    // 구현과 동일한 값(lock.ts). 일시적 실패 backoff TTL.
    TRANSIENT_SKIP_TTL_SECONDS: 1800,
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: mockPrewarmFinancials,
    prewarmCongress: mockPrewarmCongress,
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: mockPrewarmNews,
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
}));

import { TAB_SEAMS, resolveHarvest } from '../harvest';

const CTX = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: undefined,
};

function makeCounts(): PrewarmBatchCounts {
    return {
        harvested: 0,
        revalidated: 0,
        remaining: 0,
        fmpBudgetUsed: 0,
        staleTotal: 0,
        durationMs: 0,
    };
}

describe('TAB_SEAMS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrewarmTechnical.mockResolvedValue({ status: 'cached' });
        mockPrewarmOverall.mockResolvedValue({ status: 'cached' });
        mockPrewarmFundamental.mockResolvedValue({ status: 'cached' });
        mockPrewarmFinancials.mockResolvedValue({ status: 'cached' });
        mockPrewarmCongress.mockResolvedValue({ status: 'cached' });
        mockPrewarmNews.mockResolvedValue({ status: 'cached' });
        mockPrewarmOptions.mockResolvedValue({ status: 'cached' });
    });

    it('dispatches technical with force=false', async () => {
        await TAB_SEAMS.technical(CTX);
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            undefined,
            false
        );
    });

    it('dispatches overall with force=false', async () => {
        await TAB_SEAMS.overall(CTX);
        expect(mockPrewarmOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });

    it('dispatches fundamental with force=false', async () => {
        await TAB_SEAMS.fundamental(CTX);
        expect(mockPrewarmFundamental).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches financials with force=false', async () => {
        await TAB_SEAMS.financials(CTX);
        expect(mockPrewarmFinancials).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches congress with force=false', async () => {
        await TAB_SEAMS.congress(CTX);
        expect(mockPrewarmCongress).toHaveBeenCalledWith('AAPL', false);
    });

    it('dispatches news with force=false', async () => {
        await TAB_SEAMS.news(CTX);
        expect(mockPrewarmNews).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });

    it('dispatches options with force=false', async () => {
        await TAB_SEAMS.options(CTX);
        expect(mockPrewarmOptions).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            false
        );
    });
});

describe('resolveHarvest', () => {
    let repo: { upsert: ReturnType<typeof vi.fn> };
    let counts: PrewarmBatchCounts;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = { upsert: vi.fn() };
        counts = makeCounts();
    });

    it('null result: markSkipped + clearInFlight, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'technical',
            null,
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'technical');
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'technical');
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] skip AAPL:technical — null result'
        );
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    it('upserts cached result with PREWARM model + generatedAt, returns true, clears in-flight', async () => {
        const cached: SeamOutcome = {
            status: 'cached',
            result: { foo: 'bar' },
        };

        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            cached,
            repo as never,
            counts
        );

        expect(ok).toBe(true);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
        const call = repo.upsert.mock.calls[0][0];
        expect(call.symbol).toBe('AAPL');
        expect(call.tab).toBe('overall');
        expect(call.content).toEqual({ foo: 'bar' });
        expect(call.model).toBe(DEEPSEEK_V4_FLASH_MODEL);
        expect(typeof call.model).toBe('string');
        expect(call.model.length).toBeGreaterThan(0);
        expect(call.generatedAt).toBeInstanceOf(Date);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('status=done도 cached와 동일하게 upsert하고 true를 반환한다', async () => {
        const done: SeamOutcome = {
            status: 'done',
            result: { foo: 'bar' },
        };

        const ok = await resolveHarvest(
            'AAPL',
            'overall',
            done,
            repo as never,
            counts
        );

        expect(ok).toBe(true);
        expect(repo.upsert).toHaveBeenCalledTimes(1);
        expect(counts.harvested).toBe(1);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'overall');
    });

    it('terminal status=error: markSkipped + clearInFlight + warn, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'congress',
            { status: 'error' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        // FMP fetch 실패는 throw가 아니라 이 status로 **반환**된다. 6시간을 걸면
        // FMP 장애 한 번이 4개 축을 그날 밤 내내 배제한다 — 30분이어야 한다.
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'congress', 1800);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'congress');
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] skip AAPL:congress — status=error'
        );
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    it('terminal status=miss_no_trigger: markSkipped + clearInFlight, returns false (FIX C)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ok = await resolveHarvest(
            'AAPL',
            'news',
            { status: 'miss_no_trigger' },
            repo as never,
            counts
        );

        expect(ok).toBe(false);
        expect(repo.upsert).not.toHaveBeenCalled();
        // 구조적으로 불가능한 케이스는 기본 6시간을 유지한다(TTL 인자 없음).
        expect(mockMarkSkipped).toHaveBeenCalledWith('AAPL', 'news', undefined);
        expect(mockClearInFlight).toHaveBeenCalledWith('AAPL', 'news');
        expect(counts).toEqual(makeCounts());

        warnSpy.mockRestore();
    });

    /**
     * 2026-08-30 실측 — `no_trades`인 `congress` 탭은 행이 영원히 안 생기고,
     * stale 판정이 "탭 하나라도 not-fresh면 stale"이라 그 심볼이 **영구 stale**로
     * 굳었다. `staleTotal`이 113에 고정된 채 `harvested: 0`이 8시간 이어졌고,
     * 나머지 6탭이 멀쩡한 종목들이 매 회전마다 배치 슬롯을 소진했다.
     *
     * backoff 마커만으로는 못 막는다 — TTL이 지나면 되살아나기 때문이다. 구조적
     * 불가는 **영속** 집합으로 따로 기록해야 stale 판정에서 뺄 수 있다.
     */
    describe('구조적 불가 확정', () => {
        it.each(['no_trades', 'no_chains_error'] as const)(
            '%s: 영속 집합에 넣는다',
            async status => {
                const warnSpy = vi
                    .spyOn(console, 'warn')
                    .mockImplementation(() => {});

                await resolveHarvest(
                    'AAPL',
                    'congress',
                    { status } as never,
                    repo as never,
                    counts
                );

                expect(mockMarkStructural).toHaveBeenCalledWith(
                    'AAPL',
                    'congress'
                );
                warnSpy.mockRestore();
            }
        );

        it.each([
            [
                'miss_no_trigger',
                // core 계약상 `skipEnqueueIfMiss: true`일 때만 나오는 caller 설정
                // 산물이다. 지금은 전 seam이 false라 도달 불가능하지만, 확정해 두면
                // 훗날 그 플래그가 켜지는 순간 일시적 응답이 영구 블랙리스트된다.
                { status: 'miss_no_trigger' },
            ],
            [
                'null 결과',
                // `prewarmOptions`의 NoChains 경로. `fetchOptionsSnapshot`의 null은
                // "옵션 없는 종목"과 "Yahoo 일시 장애"를 구분하지 않는다.
                null,
            ],
        ] as const)('%s는 영속 집합에 넣지 않는다', async (_label, outcome) => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await resolveHarvest(
                'AAPL',
                'options',
                outcome as never,
                repo as never,
                counts
            );

            expect(mockMarkStructural).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('error(일시적)는 영속 집합에 넣지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            // FMP 장애 한 번이 이 경로로 들어온다. 영구 확정하면 장애가 끝나도
            // 그 유닛이 다시는 안 만들어진다.
            await resolveHarvest(
                'AAPL',
                'fundamental',
                { status: 'error' } as never,
                repo as never,
                counts
            );

            expect(mockMarkStructural).not.toHaveBeenCalled();
            // 일시적이므로 짧은 backoff는 그대로 걸린다.
            expect(mockMarkSkipped).toHaveBeenCalledWith(
                'AAPL',
                'fundamental',
                1800
            );
            warnSpy.mockRestore();
        });

        /**
         * `SeamOutcome.status`는 `string`이라 타입이 좁혀지지 않는다. 부정 조건
         * (`!isTransient && status !== 'miss_no_trigger'`)이었다면 코드가 모르는
         * 미래의 status가 기본값으로 영구 블랙리스트됐다 — 확정은 TTL이 없어
         * 되돌리기 어려운 방향이라 모를 때는 확정하지 않아야 한다.
         */
        it('알 수 없는 status는 확정하지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await resolveHarvest(
                'AAPL',
                'congress',
                { status: 'submitted' } as never,
                repo as never,
                counts
            );

            expect(mockMarkStructural).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('성공하면 확정을 해제한다(자동 복구 경로)', async () => {
            await resolveHarvest(
                'AAPL',
                'congress',
                { status: 'done', result: { any: 'payload' } } as never,
                repo as never,
                counts
            );

            expect(repo.upsert).toHaveBeenCalled();
            expect(mockClearStructural).toHaveBeenCalledWith(
                'AAPL',
                'congress'
            );
        });
    });
});
