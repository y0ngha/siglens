import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runTurn, appendMessages, setTurnAt, executorOptions } = vi.hoisted(
    () => ({
        runTurn: vi.fn(),
        appendMessages: vi.fn(),
        setTurnAt: vi.fn(),
        executorOptions: {
            onChart: undefined as
                | ((
                      call: { name: string; args: Record<string, unknown> },
                      p: Promise<unknown>
                  ) => void)
                | undefined,
        },
    })
);

vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    runAgentTurn: runTurn,
}));
vi.mock('@/entities/llm-provider/api/agent/getAgentProvider', () => ({
    getAgentProvider: () => vi.fn(),
}));
vi.mock('@/app/api/ai/chat/counters', () => ({
    agentGlobalLimitsFromEnv: () => undefined,
    createAgentCounters: () => ({}),
}));
vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    createToolExecutor: (
        _runtime: unknown,
        options?: { onChart?: typeof executorOptions.onChart }
    ) => {
        executorOptions.onChart = options?.onChart;
        return vi.fn();
    },
    availableToolNames: () => new Set(['get_quote']),
}));

import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import { AgentTurnError } from '@/app/api/ai/chat/agentEventStream';
import {
    agentTurnStream,
    appendOrNotFound,
    type AgentTurnStreamParams,
} from '@/app/api/ai/chat/stream/_lib/agentTurnStream';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import type { ReadyTurn } from '@/app/api/ai/chat/stream/_lib/prepareTurn';
import type { TurnSlot } from '@/app/api/ai/chat/stream/_lib/turnSlots';

const OK_TURN = {
    ok: true,
    assistant: { role: 'assistant', content: 'hi' },
    intermediate: [],
    usage: { steps: 1, ms: 5 },
    stopReason: 'end',
    remaining: { turns: 59, fresh: 6, search: 5 },
    promptVersion: 'v',
    toolsUsed: [],
};

const FK_ERROR = Object.assign(new Error('fk'), { cause: { code: '23503' } });

const CHART_BLOCK = {
    version: 1,
    symbol: 'QQQ',
    timeframe: '1Day',
    marketProfile: 'us-equity',
    bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
    overlays: [],
    overlayColors: {},
    overlayLabels: {},
    analyzedAt: null,
};

const memberTurn = (): ReadyTurn => ({
    repo: { appendMessages, setTurnAt } as unknown as NonNullable<
        ReadyTurn['repo']
    >,
    conversationId: 'c1',
    userMessage: 'q',
    userImages: [],
    userMessageId: 'u1',
    userMessageSeq: 1,
    turnAtRowId: 'u1',
    history: [],
    portfolioSymbols: [],
});

/** park 호출과 그 해제를 기록하는 슬롯 — 호출 순서는 이벤트 로그로 단언한다. */
const recordingSlot = (): {
    slot: TurnSlot;
    log: string[];
} => {
    const log: string[] = [];
    return {
        log,
        slot: {
            release: () => log.push('release'),
            park: () => {
                log.push('park');
                return () => log.push('unpark');
            },
        },
    };
};

const start = (
    overrides: Partial<AgentTurnStreamParams> = {}
): {
    stream: ReadableStream<Uint8Array>;
    release: ReturnType<typeof vi.fn>;
} => {
    const release = vi.fn(async () => {});
    const stream = agentTurnStream({
        turn: memberTurn(),
        subject: 'u1',
        guest: false,
        tier: 'member',
        locale: 'ko',
        timeZone: undefined,
        release,
        slot: recordingSlot().slot,
        queuedMs: 0,
        ...overrides,
    });
    return { stream, release };
};

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<string> =>
    new Response(stream).text();

afterEach(() => vi.restoreAllMocks());

describe('appendOrNotFound', () => {
    const repo = { appendMessages } as unknown as NonNullable<
        ReadyTurn['repo']
    >;

    beforeEach(() => vi.clearAllMocks());

    it('저장 결과를 그대로 돌려준다', async () => {
        appendMessages.mockResolvedValue([{ id: 'm1' }]);
        expect(await appendOrNotFound(repo, 'c1', [])).toEqual([{ id: 'm1' }]);
    });

    it('FK 위반은 AgentTurnError(not_found)로 바꾼다', async () => {
        appendMessages.mockRejectedValue(FK_ERROR);
        await expect(appendOrNotFound(repo, 'c1', [])).rejects.toEqual(
            new AgentTurnError('not_found')
        );
    });

    it('그 밖의 오류는 그대로 던진다', async () => {
        const boom = new Error('db down');
        appendMessages.mockRejectedValue(boom);
        await expect(appendOrNotFound(repo, 'c1', [])).rejects.toBe(boom);
    });
});

describe('agentTurnStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appendMessages.mockImplementation(async (_c: string, rows: unknown[]) =>
            rows.map((r, i) => ({ ...(r as object), id: `a${i}`, seq: i + 2 }))
        );
        runTurn.mockResolvedValue(OK_TURN);
    });

    it('성공: done 프레임을 보내고 release를 정확히 한 번 부른다', async () => {
        const { stream, release } = start();
        const text = await readAll(stream);
        expect(text).toContain('event: done');
        expect(text).toContain('"assistantMessageId":"a0"');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('KRX 세션 스펙을 runAgentTurn에 넘긴다', async () => {
        await readAll(start().stream);
        expect(runTurn).toHaveBeenCalledWith(
            expect.objectContaining({ krSession: KR_EQUITY_SESSION }),
            expect.anything()
        );
    });

    describe('턴 시각 저장', () => {
        const AT = '2026-11-20T14:09:00.000Z';
        const savedFor = (id: string) =>
            setTurnAt.mock.calls.filter(call => call[1] === id);

        beforeEach(() => {
            setTurnAt.mockResolvedValue(undefined);
        });

        it('성공: 대화 id·user 행 id와 돌려받은 시각으로 한 번 저장한다', async () => {
            runTurn.mockResolvedValue({ ...OK_TURN, turnAt: AT });
            await readAll(start().stream);
            expect(savedFor('u1')).toEqual([['c1', 'u1', AT]]);
        });

        it('중단(aborted) 결과에도 저장한다', async () => {
            runTurn.mockResolvedValue({
                ok: false,
                error: 'aborted',
                turnAt: AT,
            });
            const { stream } = start();
            const text = await readAll(stream);
            expect(savedFor('u1')).toEqual([['c1', 'u1', AT]]);
            expect(text).toContain('"code":"aborted"');
        });

        it('regenerate: 다시 쓰는 마지막 user 행 id에 덮어쓴다', async () => {
            runTurn.mockResolvedValue({ ...OK_TURN, turnAt: AT });
            await readAll(
                start({
                    turn: {
                        ...memberTurn(),
                        userMessageId: null,
                        userMessageSeq: null,
                        turnAtRowId: 'last-user-row',
                    },
                }).stream
            );
            expect(savedFor('last-user-row')).toEqual([
                ['c1', 'last-user-row', AT],
            ]);
            expect(savedFor('u1')).toEqual([]);
        });

        it('게스트(저장 행 없음)는 저장하지 않는다', async () => {
            runTurn.mockResolvedValue({ ...OK_TURN, turnAt: AT });
            await readAll(
                start({
                    turn: {
                        ...memberTurn(),
                        repo: null,
                        conversationId: null,
                        turnAtRowId: null,
                    },
                    guest: true,
                }).stream
            );
            expect(setTurnAt).not.toHaveBeenCalled();
        });

        it('게이트 거절처럼 시각이 없는 결과는 저장하지 않는다', async () => {
            runTurn.mockResolvedValue({ ok: false, error: 'turn_limit' });
            await readAll(start().stream);
            expect(setTurnAt).not.toHaveBeenCalled();
        });

        it('저장이 거절돼도 턴은 성공하고 경고만 남긴다', async () => {
            runTurn.mockResolvedValue({ ...OK_TURN, turnAt: AT });
            setTurnAt.mockRejectedValue(new Error('db down'));
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { stream, release } = start();
            const text = await readAll(stream);
            expect(text).toContain('event: done');
            expect(text).not.toContain('event: error');
            expect(warn).toHaveBeenCalledWith(
                '[agent] turn time save failed:',
                expect.any(Error)
            );
            expect(release).toHaveBeenCalledTimes(1);
        });
    });

    it('이번 턴 이미지는 base64로 runAgentTurn의 userImages에 실리고, 없으면 키가 없다', async () => {
        const bytes = Buffer.from([1, 2, 3, 4, 5]);
        const { stream } = start({
            turn: {
                ...memberTurn(),
                userImages: [
                    { mediaType: 'image/webp', bytes, width: 1, height: 1 },
                ],
            },
        });
        await readAll(stream);
        expect(runTurn.mock.calls.at(-1)?.[0]).toMatchObject({
            userImages: [
                { mediaType: 'image/webp', data: bytes.toString('base64') },
            ],
        });

        await readAll(start().stream);
        expect(runTurn.mock.calls.at(-1)?.[0]).not.toHaveProperty('userImages');
    });

    it('도구가 낸 차트 블록을 chart 프레임으로 보내고 그 도구 행에 저장한다', async () => {
        const block = {
            version: 1,
            symbol: 'QQQ',
            timeframe: '1Day',
            marketProfile: 'us-equity',
            bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
            overlays: [],
            overlayColors: {},
            overlayLabels: {},
            analyzedAt: null,
        };
        const args = { symbol: 'QQQ', timeframe: '1Day' };
        runTurn.mockImplementation(
            async (
                _params: unknown,
                deps: { onEvent: (e: Record<string, unknown>) => void }
            ) => {
                deps.onEvent({
                    type: 'tool_start',
                    id: 'call-1',
                    name: 'get_bars_indicators',
                    args,
                });
                executorOptions.onChart?.(
                    { name: 'get_bars_indicators', args },
                    Promise.resolve(block)
                );
                deps.onEvent({
                    type: 'tool_end',
                    id: 'call-1',
                    name: 'get_bars_indicators',
                    status: 'ok',
                    ms: 1,
                    summary: '',
                });
                return {
                    ...OK_TURN,
                    intermediate: [
                        {
                            role: 'assistant',
                            content: '',
                            toolCalls: [
                                {
                                    id: 'call-1',
                                    name: 'get_bars_indicators',
                                    args,
                                },
                            ],
                        },
                        {
                            role: 'tool',
                            content: '{}',
                            toolCallId: 'call-1',
                            toolName: 'get_bars_indicators',
                        },
                    ],
                };
            }
        );
        const { stream } = start();
        const text = await readAll(stream);
        expect(text).toContain('event: chart');
        expect(text).toContain('"id":"call-1"');
        expect(text.indexOf('event: chart')).toBeLessThan(
            text.indexOf('event: done')
        );
        expect(appendMessages).toHaveBeenCalledWith('c1', [
            expect.not.objectContaining({ chart: expect.anything() }),
            expect.objectContaining({ role: 'tool', chart: block }),
            expect.objectContaining({ role: 'assistant', content: 'hi' }),
        ]);
    });

    it('실패한 도구(tool_end error)의 블록은 프레임으로도 저장으로도 내지 않는다', async () => {
        const args = { symbol: 'QQQ', timeframe: '1Day' };
        runTurn.mockImplementation(
            async (
                _params: unknown,
                deps: { onEvent: (e: Record<string, unknown>) => void }
            ) => {
                deps.onEvent({
                    type: 'tool_start',
                    id: 'call-1',
                    name: 'get_bars_indicators',
                    args,
                });
                executorOptions.onChart?.(
                    { name: 'get_bars_indicators', args },
                    Promise.resolve(CHART_BLOCK)
                );
                deps.onEvent({
                    type: 'tool_end',
                    id: 'call-1',
                    name: 'get_bars_indicators',
                    status: 'error',
                    ms: 1,
                    summary: '',
                });
                return {
                    ...OK_TURN,
                    intermediate: [
                        {
                            role: 'tool',
                            content: '{"error":"tool_failed"}',
                            toolCallId: 'call-1',
                            toolName: 'get_bars_indicators',
                        },
                    ],
                };
            }
        );
        const { stream } = start();
        const text = await readAll(stream);
        expect(text).not.toContain('event: chart');
        expect(appendMessages).toHaveBeenCalledWith('c1', [
            expect.not.objectContaining({ chart: expect.anything() }),
            expect.objectContaining({ role: 'assistant' }),
        ]);
    });

    it('턴이 실패하면 기다리던 블록도 프레임으로 내지 않는다', async () => {
        const args = { symbol: 'QQQ', timeframe: '1Day' };
        const late = Promise.withResolvers<unknown>();
        runTurn.mockImplementation(
            async (
                _params: unknown,
                deps: { onEvent: (e: Record<string, unknown>) => void }
            ) => {
                deps.onEvent({
                    type: 'tool_start',
                    id: 'call-1',
                    name: 'get_bars_indicators',
                    args,
                });
                executorOptions.onChart?.(
                    { name: 'get_bars_indicators', args },
                    late.promise
                );
                deps.onEvent({
                    type: 'tool_end',
                    id: 'call-1',
                    name: 'get_bars_indicators',
                    status: 'ok',
                    ms: 1,
                    summary: '',
                });
                return { ok: false, error: 'deadline' };
            }
        );
        const { stream } = start();
        const text = await readAll(stream);
        late.resolve(CHART_BLOCK);
        await late.promise;
        expect(text).toContain('event: error');
        expect(text).not.toContain('event: chart');
    });

    it('부분 답변: 실패 코드에 맞는 상태로 저장하고 에러 프레임을 보낸다', async () => {
        runTurn.mockResolvedValue({
            ok: false,
            error: 'deadline',
            partialText: '  절반  ',
        });
        const { stream, release } = start();
        const text = await readAll(stream);
        expect(appendMessages).toHaveBeenCalledWith('c1', [
            {
                role: 'assistant',
                content: '절반',
                modelId: AGENT_MODEL,
                status: 'aborted',
            },
        ]);
        expect(text).toContain('"code":"deadline"');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('부분 답변 저장 중 FK 위반이면 not_found 프레임으로 알린다', async () => {
        runTurn.mockResolvedValue({
            ok: false,
            error: 'aborted',
            partialText: 'x',
        });
        appendMessages.mockRejectedValue(FK_ERROR);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { stream } = start();
        const text = await readAll(stream);
        expect(text).toContain('"code":"not_found"');
        expect(text).not.toContain('fk');
    });

    it('게스트는 부분 답변이 있어도 저장하지 않는다', async () => {
        runTurn.mockResolvedValue({
            ok: false,
            error: 'aborted',
            partialText: 'x',
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { stream } = start({
            turn: { ...memberTurn(), repo: null, conversationId: null },
            guest: true,
        });
        await readAll(stream);
        expect(appendMessages).not.toHaveBeenCalled();
    });

    it('턴이 던지면 server_error 프레임을 보내고 release를 한 번 부른다', async () => {
        runTurn.mockRejectedValue(new Error('provider exploded'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { stream, release } = start();
        const text = await readAll(stream);
        expect(text).toContain('"code":"server_error"');
        expect(text).not.toContain('provider exploded');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('클라이언트가 끊으면 턴 signal을 중단하고 턴이 끝난 뒤 release를 한 번 부른다', async () => {
        let seenSignal: AbortSignal | undefined;
        runTurn.mockImplementation(
            (input: { signal: AbortSignal }) =>
                new Promise(resolve => {
                    seenSignal = input.signal;
                    input.signal.addEventListener('abort', () =>
                        resolve({ ok: false, error: 'aborted' })
                    );
                })
        );
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { stream, release } = start();
        const reader = stream.getReader();
        await reader.read();
        await reader.cancel();
        await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
        expect(seenSignal?.aborted).toBe(true);
    });

    describe('새 분석 대기 중 슬롯 주차', () => {
        const toolEvents = (
            deps: { onEvent: (e: Record<string, unknown>) => void },
            events: Array<Record<string, unknown>>
        ): void => events.forEach(deps.onEvent);

        it('run_fresh_analysis의 tool_start에서 주차하고 같은 호출의 tool_end에서 푼다', async () => {
            const { slot, log } = recordingSlot();
            runTurn.mockImplementation(
                async (
                    _i: unknown,
                    deps: { onEvent: (e: Record<string, unknown>) => void }
                ) => {
                    toolEvents(deps, [
                        {
                            type: 'tool_start',
                            id: 'f1',
                            name: 'run_fresh_analysis',
                            args: {},
                        },
                    ]);
                    log.push('waiting');
                    toolEvents(deps, [
                        {
                            type: 'tool_end',
                            id: 'f1',
                            name: 'run_fresh_analysis',
                            status: 'ok',
                            ms: 5,
                        },
                    ]);
                    return OK_TURN;
                }
            );
            await readAll(start({ slot }).stream);
            expect(log).toEqual(['park', 'waiting', 'unpark']);
        });

        it('다른 도구는 주차하지 않는다', async () => {
            const { slot, log } = recordingSlot();
            runTurn.mockImplementation(
                async (
                    _i: unknown,
                    deps: { onEvent: (e: Record<string, unknown>) => void }
                ) => {
                    toolEvents(deps, [
                        {
                            type: 'tool_start',
                            id: 'q1',
                            name: 'get_quote',
                            args: {},
                        },
                        {
                            type: 'tool_end',
                            id: 'q1',
                            name: 'get_quote',
                            status: 'ok',
                            ms: 5,
                        },
                    ]);
                    return OK_TURN;
                }
            );
            await readAll(start({ slot }).stream);
            expect(log).toEqual([]);
        });

        it('동시에 도는 분석은 호출마다 따로 주차하고, 한 호출의 tool_end는 그 호출만 푼다', async () => {
            const parks: string[] = [];
            const slot: TurnSlot = {
                release: () => {},
                park: () => {
                    const n = parks.length + 1;
                    parks.push(`park${n}`);
                    return () => parks.push(`unpark${n}`);
                },
            };
            runTurn.mockImplementation(
                async (
                    _i: unknown,
                    deps: { onEvent: (e: Record<string, unknown>) => void }
                ) => {
                    toolEvents(deps, [
                        {
                            type: 'tool_start',
                            id: 'f1',
                            name: 'run_fresh_analysis',
                            args: {},
                        },
                        {
                            type: 'tool_start',
                            id: 'f2',
                            name: 'run_fresh_analysis',
                            args: {},
                        },
                        {
                            type: 'tool_end',
                            id: 'f2',
                            name: 'run_fresh_analysis',
                            status: 'ok',
                            ms: 5,
                        },
                    ]);
                    return OK_TURN;
                }
            );
            await readAll(start({ slot }).stream);
            // f2(두 번째 park)만 tool_end로 풀렸고, f1은 턴이 끝날 때 마저 풀린다.
            expect(parks).toEqual(['park1', 'park2', 'unpark2', 'unpark1']);
        });

        it('같은 id의 tool_start가 다시 오면 앞 주차를 먼저 풀어 새지 않는다', async () => {
            const log: string[] = [];
            const slot: TurnSlot = {
                release: () => {},
                park: () => {
                    const n = log.filter(l => l.startsWith('park')).length + 1;
                    log.push(`park${n}`);
                    return () => log.push(`unpark${n}`);
                },
            };
            runTurn.mockImplementation(
                async (
                    _i: unknown,
                    deps: { onEvent: (e: Record<string, unknown>) => void }
                ) => {
                    toolEvents(
                        deps,
                        ['first', 'again'].map(() => ({
                            type: 'tool_start',
                            id: 'dup',
                            name: 'run_fresh_analysis',
                            args: {},
                        }))
                    );
                    return OK_TURN;
                }
            );
            await readAll(start({ slot }).stream);
            // 첫 주차는 두 번째 tool_start에서, 두 번째 주차는 턴 종료 때 풀린다.
            expect(log).toEqual(['park1', 'unpark1', 'park2', 'unpark2']);
        });

        it('tool_end가 오지 않아도 release 전에 푼다 — 턴이 던져도 마찬가지', async () => {
            const { slot, log } = recordingSlot();
            const release = vi.fn(async () => {
                log.push('release');
            });
            runTurn.mockImplementation(
                async (
                    _i: unknown,
                    deps: { onEvent: (e: Record<string, unknown>) => void }
                ) => {
                    toolEvents(deps, [
                        {
                            type: 'tool_start',
                            id: 'f1',
                            name: 'run_fresh_analysis',
                            args: {},
                        },
                    ]);
                    throw new Error('boom');
                }
            );
            vi.spyOn(console, 'error').mockImplementation(() => {});
            await readAll(start({ slot, release }).stream);
            expect(log).toEqual(['park', 'unpark', 'release']);
        });
    });

    it('[Agent] 줄에 대기 시간(queuedMs)을 싣는다', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        await readAll(start({ queuedMs: 4_321 }).stream);
        const line = info.mock.calls.find(([tag]) => tag === '[Agent]');
        expect(JSON.parse(String(line?.[1]))).toMatchObject({
            queuedMs: 4_321,
        });
    });
});
