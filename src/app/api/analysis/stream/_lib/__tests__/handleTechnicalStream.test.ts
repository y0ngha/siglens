import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis/lib/reanalyzeCooldown';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveHoldingPositionBucket } from '@/entities/portfolio/lib/resolveHoldingPositionBucket';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    resolveReasoning,
    resolveTierAndByok,
    resolveTierOnly,
} from '@/shared/lib/byokGate';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { resolveMeterGate } from '../../meteredRevealGate';
import { runAnalysis } from '../../runAnalysisBridge';
import { e2eTechnicalResponse } from '../e2eTechnicalResponse';
import { handleTechnicalStream } from '../handleTechnicalStream';
import { schedulePersistAnalysisHistory } from '../persistAnalysisHistory';
import { releaseCooldownQuietly } from '../releaseCooldown';

const h = vi.hoisted(() => ({
    slotReserve: vi.fn(),
    slotRelease: vi.fn(),
    releaseGenerationGate: vi.fn(),
    promptProbe: vi.fn(),
}));

vi.mock('@/entities/analysis/lib/reanalyzeCooldown', () => ({
    tryAcquireReanalyzeCooldown: vi.fn(),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/portfolio/lib/resolveHoldingPositionBucket', () => ({
    resolveHoldingPositionBucket: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/resolveKrxTickTable', () => ({
    resolveKrxTickTable: async () => 'krx-table',
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: async () => 'us',
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: vi.fn() }));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => 'provider',
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: () => 'session',
}));
vi.mock('@/shared/config/marketProfile/registry', () => ({
    getDescriptor: () => ({
        assetClass: 'equity',
        priceFormat: { currency: 'USD' },
    }),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    buildGateError: async () => ({ code: 'unexpected_error' }),
    resolveReasoning: vi.fn(),
    resolveTierAndByok: vi.fn(),
    resolveTierOnly: vi.fn(),
}));
vi.mock('@/shared/lib/sse/activeStreams', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/lib/sse/activeStreams')
    >()),
    canAcceptAnalysisStream: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
    getTranslations: async () => (key: string) => `t:${key}`,
}));
vi.mock('../../generationQuota', () => ({
    createGenerationGateSlot: () => ({
        reserve: h.slotReserve,
        release: h.slotRelease,
    }),
    createGuestResolver: () => 'guest',
    promptAssembledProbe: (read: () => boolean) => ({ read }),
    releaseGenerationGate: h.releaseGenerationGate,
    settleGenerationGate: (work: Promise<unknown>) => work,
    shouldAttemptReanalyze: (requested: unknown, limited: boolean) =>
        requested === true && !limited,
}));
vi.mock('../../meteredRevealGate', async importOriginal => ({
    ...(await importOriginal<typeof import('../../meteredRevealGate')>()),
    resolveMeterGate: vi.fn(),
}));
vi.mock('../../modelFallback', () => ({
    attachModelFallback: (work: Promise<unknown>) => work,
    resolveRequestModel: (modelId: unknown) => ({ modelId, fallback: null }),
}));
vi.mock('../../runAnalysisBridge', () => ({ runAnalysis: vi.fn() }));
vi.mock('../e2eTechnicalResponse', () => ({
    e2eTechnicalResponse: vi.fn(),
}));
vi.mock('../persistAnalysisHistory', () => ({
    DEFAULT_TECHNICAL_MODEL_ID: 'analysis-worker',
    schedulePersistAnalysisHistory: vi.fn(),
}));
vi.mock('../readerViews', () => ({
    withReaderViews: (work: Promise<unknown>) => work,
}));
vi.mock('../releaseCooldown', () => ({ releaseCooldownQuietly: vi.fn() }));
vi.mock('../technicalPromptInputs', () => ({
    loadTechnicalPromptInputs: async () => ({
        priorAnalyses: ['prior'],
        marketEvents: ['event'],
        earningsDates: ['earn'],
    }),
}));

const request = (): Request =>
    new Request('http://localhost/api/analysis/stream', { method: 'POST' });
const params = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day' as const,
};
const meterRelease = vi.fn(async () => {});

/** SSE 본문에서 `done` 이벤트의 `result`를 꺼낸다. */
const readDone = async (res: Response): Promise<Record<string, unknown>> => {
    const text = await res.text();
    const line = text
        .split('\n')
        .find((l, i, all) => all[i - 1] === 'event: done');
    return JSON.parse(String(line?.replace(/^data: /, ''))).result;
};

describe('handleTechnicalStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isE2E).mockReturnValue(false);
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
        vi.mocked(resolveTierOnly).mockResolvedValue('free');
        vi.mocked(resolveTierAndByok).mockResolvedValue({
            kind: 'allowed',
            tier: 'member',
        } as never);
        vi.mocked(resolveReasoning).mockReturnValue(false);
        vi.mocked(resolveHoldingPositionBucket).mockResolvedValue(undefined);
        h.slotReserve.mockResolvedValue({ kind: 'allowed' });
        vi.mocked(resolveMeterGate).mockResolvedValue({ kind: 'off' });
        vi.mocked(canAcceptAnalysisStream).mockReturnValue(true);
        vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
            ok: true,
        } as never);
        vi.mocked(runAnalysis).mockResolvedValue({
            status: 'cached',
            result: { trend: 'bullish' },
        } as never);
    });

    describe('진입', () => {
        it('E2E 모드면 fixture 응답으로 단락한다', async () => {
            vi.mocked(isE2E).mockReturnValue(true);
            const stub = new Response('stub');
            vi.mocked(e2eTechnicalResponse).mockResolvedValue(stub);
            const res = await handleTechnicalStream(request(), {
                ...params,
                reanalyze: true,
            });
            expect(res).toBe(stub);
            expect(e2eTechnicalResponse).toHaveBeenCalledWith({
                userId: 'u1',
                symbol: 'AAPL',
                reanalyze: true,
                genericErrorMessage: 't:generic',
            });
            expect(runAnalysis).not.toHaveBeenCalled();
        });

        it('모델이 없으면 tier만 조회하고 BYOK 게이트는 건너뛴다', async () => {
            await (await handleTechnicalStream(request(), params)).text();
            expect(resolveTierOnly).toHaveBeenCalledWith('u1');
            expect(resolveTierAndByok).not.toHaveBeenCalled();
        });

        it('모델이 있으면 요청 로케일로 BYOK 게이트를 통과시킨다', async () => {
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    modelId: 'm1' as never,
                })
            ).text();
            expect(resolveTierAndByok).toHaveBeenCalledWith('u1', 'm1', 'ko');
        });

        it('게이트가 막으면 error 이벤트로 흘리고 분석하지 않는다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'blocked',
                error: { code: 'tier_premium_blocked' },
            } as never);
            const res = await handleTechnicalStream(request(), {
                ...params,
                modelId: 'm1' as never,
            });
            expect(res.status).toBe(200);
            expect(await res.text()).toContain('event: error');
            expect(runAnalysis).not.toHaveBeenCalled();
            expect(h.slotReserve).not.toHaveBeenCalled();
            warn.mockRestore();
        });
    });

    describe('분석 호출', () => {
        it('프롬프트 입력과 로케일·마감 signal을 core에 넘긴다', async () => {
            await (await handleTechnicalStream(request(), params)).text();
            expect(runAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                undefined,
                expect.objectContaining({
                    priorAnalyses: ['prior'],
                    marketEvents: ['event'],
                    earningsDates: ['earn'],
                    locale: 'ko',
                    signal: expect.any(AbortSignal),
                    session: 'session',
                    marketDataProvider: 'provider',
                    assetClass: 'equity',
                    currency: 'USD',
                    krxTickTable: 'krx-table',
                    tierContext: { userId: 'u1', tier: 'free' },
                })
            );
        });

        it('사용자 키가 없으면 userApiKey 필드를 싣지 않는다', async () => {
            await (await handleTechnicalStream(request(), params)).text();
            const options = vi.mocked(runAnalysis).mock.calls[0]?.[5];
            expect(options).not.toHaveProperty('userApiKey');
        });

        it('BYOK 게이트가 준 사용자 키를 core에 넘긴다', async () => {
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'allowed',
                tier: 'member',
                userApiKey: 'sk-user',
            } as never);
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    modelId: 'm1' as never,
                })
            ).text();
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[5]).toMatchObject({
                userApiKey: 'sk-user',
            });
        });

        it('클라이언트 reasoning 요청은 등급 규칙을 거쳐 넘긴다', async () => {
            vi.mocked(resolveReasoning).mockReturnValue(true);
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    reasoning: true,
                })
            ).text();
            expect(resolveReasoning).toHaveBeenCalledWith('free', true);
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[5]).toMatchObject({
                reasoning: true,
            });
        });

        it('보유 포지션이 있으면 personalized를 켠다', async () => {
            vi.mocked(resolveHoldingPositionBucket).mockResolvedValue(
                'profit' as never
            );
            const done = await readDone(
                await handleTechnicalStream(request(), params)
            );
            expect(done.personalized).toBe(true);
        });

        it('보유 포지션이 없으면 personalized를 끈다', async () => {
            const done = await readDone(
                await handleTechnicalStream(request(), params)
            );
            expect(done.personalized).toBe(false);
        });

        it('클라이언트 가지로 나가는 결과에서 unfilteredResult를 뗀다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'done',
                result: { trend: 'bullish' },
                unfilteredResult: { entry: 1 },
            } as never);
            const done = await readDone(
                await handleTechnicalStream(request(), params)
            );
            expect(done).not.toHaveProperty('unfilteredResult');
        });
    });

    describe('캐시 전용 강등', () => {
        it('클라이언트 cacheOnly 요청이면 miss에서 생성하지 않는다', async () => {
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    cacheOnly: true,
                })
            ).text();
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[5]).toMatchObject({
                skipEnqueueIfMiss: true,
            });
        });

        it('생성 한도 초과면 miss에서 생성하지 않는다', async () => {
            h.slotReserve.mockResolvedValue({ kind: 'rate_limited' });
            await (await handleTechnicalStream(request(), params)).text();
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[5]).toMatchObject({
                skipEnqueueIfMiss: true,
            });
        });

        it('일반 요청은 miss에서 생성을 허용한다', async () => {
            await (await handleTechnicalStream(request(), params)).text();
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[5]).toMatchObject({
                skipEnqueueIfMiss: false,
            });
        });

        it('한도 초과 요청의 재분석 의도는 무시한다', async () => {
            h.slotReserve.mockResolvedValue({ kind: 'rate_limited' });
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    reanalyze: true,
                })
            ).text();
            expect(tryAcquireReanalyzeCooldown).not.toHaveBeenCalled();
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[3]).toBe(false);
        });
    });

    describe('재분석 쿨다운', () => {
        it('쿨다운을 획득하면 서버가 force로 캐시를 우회한다', async () => {
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    reanalyze: true,
                })
            ).text();
            expect(tryAcquireReanalyzeCooldown).toHaveBeenCalledWith(
                'AAPL',
                '1Day'
            );
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[3]).toBe(true);
        });

        it('재분석 의도가 없으면 쿨다운을 잡지 않는다', async () => {
            await (await handleTechnicalStream(request(), params)).text();
            expect(tryAcquireReanalyzeCooldown).not.toHaveBeenCalled();
        });

        it('쿨다운 중이면 남은 시간을 알리고 예약과 미터를 되돌린다', async () => {
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: false,
                remainingMs: 4321,
            } as never);
            vi.mocked(resolveMeterGate).mockResolvedValue({
                kind: 'revealed',
                tierConfig: {} as never,
                release: meterRelease,
            });
            const res = await handleTechnicalStream(request(), {
                ...params,
                reanalyze: true,
            });
            expect(await readDone(res)).toEqual({
                status: 'reanalyze_cooldown',
                remainingMs: 4321,
            });
            expect(h.releaseGenerationGate).toHaveBeenCalledTimes(1);
            expect(meterRelease).toHaveBeenCalledTimes(1);
            expect(runAnalysis).not.toHaveBeenCalled();
        });

        it('분석이 실패하면 획득한 쿨다운을 되돌린다', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(runAnalysis).mockRejectedValue(new Error('llm down'));
            const res = await handleTechnicalStream(request(), {
                ...params,
                reanalyze: true,
            });
            expect(await res.text()).toContain('event: error');
            expect(releaseCooldownQuietly).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                '[streamAnalysisRoute] cooldown release failed:'
            );
            spy.mockRestore();
        });

        it('쿨다운을 잡지 않았다면 실패해도 해제하지 않는다', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(runAnalysis).mockRejectedValue(new Error('llm down'));
            await (await handleTechnicalStream(request(), params)).text();
            expect(releaseCooldownQuietly).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('동시 분석 상한', () => {
        it('상한에 걸리면 쿨다운·예약·미터를 되돌리고 503을 낸다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.mocked(canAcceptAnalysisStream).mockReturnValue(false);
            vi.mocked(resolveMeterGate).mockResolvedValue({
                kind: 'revealed',
                tierConfig: {} as never,
                release: meterRelease,
            });
            const res = await handleTechnicalStream(request(), {
                ...params,
                reanalyze: true,
            });
            expect(res.status).toBe(503);
            expect(res.headers.get('Retry-After')).toBe('30');
            expect(releaseCooldownQuietly).toHaveBeenCalledTimes(1);
            expect(h.releaseGenerationGate).toHaveBeenCalledTimes(1);
            expect(meterRelease).toHaveBeenCalledTimes(1);
            expect(runAnalysis).not.toHaveBeenCalled();
            warn.mockRestore();
        });

        it('재분석이 아니었다면 쿨다운은 해제하지 않는다', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.mocked(canAcceptAnalysisStream).mockReturnValue(false);
            await handleTechnicalStream(request(), params);
            expect(releaseCooldownQuietly).not.toHaveBeenCalled();
            warn.mockRestore();
        });
    });

    describe('하루 무료 공개 미터', () => {
        it('공개 종목이면 member 깊이 마스킹 설정을 넘기고 응답에 meter를 싣는다', async () => {
            vi.mocked(resolveMeterGate).mockResolvedValue({
                kind: 'revealed',
                tierConfig: { depth: 'member' } as never,
                release: meterRelease,
            });
            const done = await readDone(
                await handleTechnicalStream(request(), params)
            );
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[5]).toMatchObject({
                tierConfig: { depth: 'member' },
            });
            expect(done.meter).toEqual({ state: 'revealed' });
            expect(meterRelease).not.toHaveBeenCalled();
        });

        it('미터가 꺼져 있으면 tierConfig와 meter를 싣지 않는다', async () => {
            const done = await readDone(
                await handleTechnicalStream(request(), params)
            );
            expect(
                vi.mocked(runAnalysis).mock.calls[0]?.[5]
            ).not.toHaveProperty('tierConfig');
            expect(done).not.toHaveProperty('meter');
        });

        it('결과 없이 끝나면 미터 기록을 되돌린다', async () => {
            vi.mocked(resolveMeterGate).mockResolvedValue({
                kind: 'revealed',
                tierConfig: {} as never,
                release: meterRelease,
            });
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger',
            } as never);
            await (await handleTechnicalStream(request(), params)).text();
            expect(meterRelease).toHaveBeenCalledTimes(1);
        });
    });

    describe('이력 저장', () => {
        it('새로 생성된(done) 결과는 필터 전 결과와 기본 모델명으로 저장한다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'done',
                result: { trend: 'bullish' },
                unfilteredResult: { entry: 1 },
            } as never);
            await (await handleTechnicalStream(request(), params)).text();
            expect(schedulePersistAnalysisHistory).toHaveBeenCalledWith({
                symbol: 'AAPL',
                timeframe: '1Day',
                tab: 'technical',
                modelId: 'analysis-worker',
                locale: 'ko',
                result: { entry: 1 },
                prompt: undefined,
            });
        });

        it('요청한 모델이 있으면 그 모델명으로 저장한다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'done',
                unfilteredResult: { entry: 1 },
            } as never);
            await (
                await handleTechnicalStream(request(), {
                    ...params,
                    modelId: 'm1' as never,
                })
            ).text();
            expect(
                vi.mocked(schedulePersistAnalysisHistory).mock.calls[0]?.[0]
                    .modelId
            ).toBe('m1');
        });

        it('core가 조립한 프롬프트를 함께 저장한다', async () => {
            vi.mocked(runAnalysis).mockImplementation((async (
                ...args: unknown[]
            ) => {
                const options = args[5] as {
                    onPromptAssembled: (record: unknown) => void;
                };
                options.onPromptAssembled({ system: 'sys' });
                return { status: 'done', unfilteredResult: {} };
            }) as never);
            await (await handleTechnicalStream(request(), params)).text();
            expect(
                vi.mocked(schedulePersistAnalysisHistory).mock.calls[0]?.[0]
                    .prompt
            ).toEqual({ system: 'sys' });
        });

        it('캐시 적중 결과는 저장하지 않는다', async () => {
            await (await handleTechnicalStream(request(), params)).text();
            expect(schedulePersistAnalysisHistory).not.toHaveBeenCalled();
        });

        it('분석이 실패하면 저장하지 않는다', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(runAnalysis).mockRejectedValue(new Error('llm down'));
            await (await handleTechnicalStream(request(), params)).text();
            expect(schedulePersistAnalysisHistory).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('예기치 못한 예외', () => {
        it('예약·미터를 되돌리고 내부 상세 없는 500 sentinel을 낸다', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(resolveMeterGate).mockResolvedValue({
                kind: 'revealed',
                tierConfig: {} as never,
                release: meterRelease,
            });
            vi.mocked(tryAcquireReanalyzeCooldown).mockRejectedValue(
                new Error('SECRET internal detail')
            );
            const res = await handleTechnicalStream(request(), {
                ...params,
                reanalyze: true,
            });
            expect(res.status).toBe(500);
            const text = await res.text();
            expect(text).toBe(
                JSON.stringify({
                    status: 'error',
                    error: { code: 'unexpected_error' },
                })
            );
            expect(text).not.toContain('SECRET');
            expect(h.slotRelease).toHaveBeenCalledTimes(1);
            expect(meterRelease).toHaveBeenCalledTimes(1);
            spy.mockRestore();
        });

        it('인증 단계에서 던져도 500 sentinel이다', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(getCurrentUser).mockRejectedValue(new Error('auth down'));
            const res = await handleTechnicalStream(request(), params);
            expect(res.status).toBe(500);
            expect(h.slotRelease).toHaveBeenCalledTimes(1);
            spy.mockRestore();
        });
    });
});
