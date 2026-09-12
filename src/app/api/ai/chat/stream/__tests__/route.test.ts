import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { m, RepoCtor, PortfolioCtor } = vi.hoisted(() => {
    const m = {
        user: vi.fn(),
        isBot: vi.fn(() => false),
        tier: vi.fn(async () => 'member'),
        lock: vi.fn(),
        runTurn: vi.fn(),
        canAccept: vi.fn(() => true),
        repo: {
            create: vi.fn(),
            findForUser: vi.fn(),
            listMessages: vi.fn(),
            appendMessages: vi.fn(),
            countForUser: vi.fn(),
            supersedeAfterLastUser: vi.fn(),
            deleteFromSeq: vi.fn(),
        },
        portfolio: { findByUser: vi.fn(async () => [{ symbol: 'AAPL' }]) },
    };
    const RepoCtor = vi.fn(function (this: unknown) {
        return m.repo;
    });
    const PortfolioCtor = vi.fn(function (this: unknown) {
        return m.portfolio;
    });
    return { m, RepoCtor, PortfolioCtor };
});

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: m.user,
}));
vi.mock('@/shared/api/isBot', () => ({ isBot: m.isBot }));
vi.mock('@/app/api/ai/chat/resolveAgentTier', () => ({
    resolveAgentTier: m.tier,
}));
vi.mock('@/app/api/ai/chat/turnLock', () => ({ acquireTurnLock: m.lock }));
vi.mock('@/app/api/ai/chat/counters', () => ({
    createAgentCounters: () => ({}),
}));
vi.mock('@/app/api/ai/chat/tools', () => ({
    createToolExecutor: () => vi.fn(),
    availableToolNames: () => new Set(['get_quote']),
}));
vi.mock('@/entities/llm-provider', () => ({
    getAgentProvider: () => vi.fn(),
    AGENT_MODEL: 'deepseek-v4.1-flash',
}));
vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: RepoCtor,
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: PortfolioCtor,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/shared/lib/sse/activeStreams', async importOriginal => ({
    ...(await importOriginal<object>()),
    canAcceptAnalysisStream: m.canAccept,
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    runAgentTurn: m.runTurn,
}));

import { POST } from '@/app/api/ai/chat/stream/route';

const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
const postRaw = (raw: string) =>
    new Request('http://localhost/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw,
    });
const frames = async (res: Response): Promise<string[]> =>
    (await res.text()).split('\n\n').filter(Boolean);

const OK_TURN = {
    ok: true,
    assistant: { role: 'assistant', content: 'hi' },
    intermediate: [],
    usage: {
        promptTokens: 1,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 1,
        steps: 1,
        ms: 5,
    },
    stopReason: 'end',
    remaining: { turns: 59, fresh: 6, search: 5 },
    promptVersion: 'v',
    toolsUsed: [],
};

const ROW = (
    seq: number,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    status: 'complete' | 'aborted' | 'error' | 'superseded' = 'complete'
) => ({
    id: `m${seq}`,
    seq,
    role,
    content,
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    status,
});

describe('POST /api/ai/chat/stream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        m.user.mockResolvedValue({ id: 'u1' });
        m.isBot.mockReturnValue(false);
        m.canAccept.mockReturnValue(true);
        m.lock.mockResolvedValue({ release: vi.fn() });
        m.repo.create.mockResolvedValue({ id: 'c-new', title: '제목' });
        m.repo.findForUser.mockResolvedValue({ id: 'c1', title: 't' });
        m.repo.listMessages.mockResolvedValue([]);
        m.repo.countForUser.mockResolvedValue(0);
        m.repo.appendMessages.mockImplementation(
            async (_c: string, rows: unknown[]) =>
                rows.map((r, i) => ({
                    ...(r as object),
                    id: `m${i}`,
                    seq: i + 1,
                }))
        );
        m.runTurn.mockResolvedValue(OK_TURN);
    });
    afterEach(() => vi.unstubAllEnvs());

    // ---- kill switch ----
    it('킬 스위치 → 503, Retry-After, 어떤 사전 작업도 하지 않는다', async () => {
        vi.stubEnv('AGENT_CHAT_DISABLED', '1');
        const res = await POST(post({ message: 'x' }));
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: 'disabled' });
        expect(res.headers.get('Retry-After')).toBe('600');
        expect(m.user).not.toHaveBeenCalled();
        expect(m.lock).not.toHaveBeenCalled();
    });

    // ---- auth / bot / body ----
    it('비로그인은 401, lock/DB를 건드리지 않는다', async () => {
        m.user.mockResolvedValueOnce(null);
        const res = await POST(post({ message: 'x' }));
        expect(res.status).toBe(401);
        expect(m.lock).not.toHaveBeenCalled();
        expect(RepoCtor).not.toHaveBeenCalled();
    });
    it('봇은 403', async () => {
        m.isBot.mockReturnValueOnce(true);
        expect((await POST(post({ message: 'x' }))).status).toBe(403);
    });
    it('4,001자 메시지는 400 invalid_body, lock 획득 전', async () => {
        const res = await POST(post({ message: 'x'.repeat(4001) }));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_body' });
        expect(m.lock).not.toHaveBeenCalled();
    });
    it('malformed JSON은 400 invalid_body, lock 획득 전', async () => {
        const res = await POST(postRaw('not json'));
        expect(res.status).toBe(400);
        expect(m.lock).not.toHaveBeenCalled();
    });
    it('알 수 없는 action 값은 400 invalid_body', async () => {
        const res = await POST(
            post({ message: 'x', action: 'delete-everything' })
        );
        expect(res.status).toBe(400);
        expect(m.lock).not.toHaveBeenCalled();
    });
    it('editSeq가 정수가 아니거나 0 이하이면 400, lock 획득 전', async () => {
        expect(
            (
                await POST(
                    post({
                        conversationId: 'c1',
                        message: 'x',
                        action: 'edit',
                        editSeq: 0,
                    })
                )
            ).status
        ).toBe(400);
        expect(
            (
                await POST(
                    post({
                        conversationId: 'c1',
                        message: 'x',
                        action: 'edit',
                        editSeq: -1,
                    })
                )
            ).status
        ).toBe(400);
        expect(
            (
                await POST(
                    post({
                        conversationId: 'c1',
                        message: 'x',
                        action: 'edit',
                        editSeq: 1.5,
                    })
                )
            ).status
        ).toBe(400);
        expect(m.lock).not.toHaveBeenCalled();
    });

    // ---- ownership / lock / concurrency ----
    it('남의 대화(또는 존재하지 않는 대화)는 404, lock은 해제된다', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.findForUser.mockResolvedValueOnce(null);
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
        expect(release).toHaveBeenCalledTimes(1);
    });
    it('락 획득 실패(다른 턴 보유 또는 Redis 장애) → 409, 추가 로그를 남기지 않는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        m.lock.mockResolvedValueOnce(null);
        const res = await POST(post({ message: 'x' }));
        expect(res.status).toBe(409);
        // acquireTurnLock is mocked here — its own outage log is not re-emitted by the route.
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
    it('동시성 상한 초과 → 503, lock 획득 전', async () => {
        m.canAccept.mockReturnValueOnce(false);
        const res = await POST(post({ message: 'x' }));
        expect(res.status).toBe(503);
        expect(m.lock).not.toHaveBeenCalled();
    });
    it('슬롯은 동시성 게이트 통과 직후 확보된다 — 앞선 요청이 pre-turn DB 대기 중이어도 정원을 채운다', async () => {
        // The slot reservation must happen before the (mocked, pending) `findForUser` call,
        // not after every pre-turn DB round-trip — otherwise many requests racing in that
        // window would all read the same pre-increment count and all proceed.
        // MAX_CONCURRENT_AGENT_TURNS is currently 4 (route.ts, not exported).
        const releaseStuck: Array<() => void> = [];
        m.repo.findForUser.mockImplementation(
            () =>
                new Promise(resolve => {
                    releaseStuck.push(() => resolve({ id: 'c1', title: 't' }));
                })
        );
        const stuck = Array.from({ length: 4 }, () =>
            POST(post({ conversationId: 'c1', message: 'x' }))
        );
        // Flush microtasks so each POST reaches its stuck `findForUser` await.
        await new Promise(r => setTimeout(r, 0));
        // The 4 stuck requests already passed the gate (and acquired the lock, since lock
        // acquisition happens before the stuck `findForUser` call) — a 5th must be rejected
        // without ever calling `acquireTurnLock`.
        const lockCallsBeforeFifth = m.lock.mock.calls.length;
        expect(lockCallsBeforeFifth).toBe(4);
        const fifth = await POST(post({ conversationId: 'c1', message: 'x' }));
        expect(fifth.status).toBe(503);
        expect(m.lock.mock.calls.length).toBe(lockCallsBeforeFifth);
        releaseStuck.forEach(r => r());
        await Promise.all(stuck);
        // Let each request's `work` settle so its slot is released before the next test.
        await new Promise(r => setTimeout(r, 0));
    });

    it('락 획득 실패로 409를 반환해도 슬롯은 반납된다', async () => {
        // Without the decrement on the lock-null branch the slots would leak and the
        // instance would answer 503 for the rest of its life after 4 busy turns.
        m.lock.mockResolvedValue(null);
        for (let i = 0; i < 4; i++) {
            const busy = await POST(
                post({ conversationId: 'c1', message: 'x' })
            );
            expect(busy.status).toBe(409);
        }
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        const after = await POST(post({ conversationId: 'c1', message: 'x' }));
        expect(after.status).not.toBe(503);
        await new Promise(r => setTimeout(r, 0));
    });
    it('대화 개수 상한 초과 → 409, lock 해제', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.countForUser.mockResolvedValueOnce(999);
        const res = await POST(post({ conversationId: null, message: 'x' }));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'conversation_limit' });
        expect(release).toHaveBeenCalledTimes(1);
    });
    it('대화 메시지 상한 초과 → 409 conversation_full, lock 해제', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.listMessages.mockResolvedValue(
            Array.from({ length: 200 }, (_, i) => ROW(i + 1, 'user', 'x'))
        );
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'conversation_full' });
        expect(release).toHaveBeenCalledTimes(1);
    });

    // ---- happy paths ----
    it('새 대화: 생성 → user 저장 → 턴(고정 모델·보유 심볼) → assistant 저장 → meta/done, 락 해제', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        const res = await POST(
            post(
                {
                    conversationId: null,
                    message: 'AAPL?',
                    model: 'claude-opus-5',
                },
                { 'x-siglens-locale': 'en' }
            )
        );
        expect(res.headers.get('content-type')).toContain('text/event-stream');
        expect(res.headers.get('cache-control')).toContain('no-store');
        expect(res.headers.get('cache-control')).toContain('no-transform');
        expect(res.headers.get('x-accel-buffering')).toBe('no');
        const f = await frames(res);
        expect(f[0]).toContain('"conversationId":"c-new"');
        // The client needs the stored user row's `seq` on the `meta` frame to make the
        // optimistic bubble it renders before this response arrives immediately
        // editable (spec §UI) — otherwise Edit only shows up after a reload.
        expect(f[0]).toContain('"userMessageSeq":1');
        expect(f.at(-1)).toContain('event: done');
        expect(m.repo.create).toHaveBeenCalledWith({
            userId: 'u1',
            firstMessage: 'AAPL?',
            locale: 'en',
            modelId: 'deepseek-v4.1-flash',
        });
        const userAppendCall = m.repo.appendMessages.mock.calls.find(
            c => Array.isArray(c[1]) && c[1][0]?.role === 'user'
        );
        const assistantAppendCall = m.repo.appendMessages.mock.calls.find(
            c =>
                Array.isArray(c[1]) &&
                c[1].some((r: { role: string }) => r.role === 'assistant')
        );
        expect(userAppendCall?.[1][0]).toMatchObject({
            role: 'user',
            content: 'AAPL?',
        });
        expect(assistantAppendCall).toBeDefined();
        expect(m.runTurn.mock.lastCall![0]).toMatchObject({
            userId: 'u1',
            tier: 'member',
            model: 'deepseek-v4.1-flash',
            locale: 'en',
            userMessage: 'AAPL?',
            portfolioSymbols: ['AAPL'],
        });
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('send는 기존 이력 전체를 넘긴다(직전 assistant를 자르지 않는다)', async () => {
        m.repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
        ]);
        await POST(post({ conversationId: 'c1', message: 'q2' }));
        expect(m.runTurn.mock.lastCall![0].history).toEqual([
            { role: 'user', content: 'q1' },
            { role: 'assistant', content: 'a1' },
        ]);
    });

    it('regenerate는 마지막 user 이후를 superseded, 그 user를 userMessage로, 이력에서는 제외', async () => {
        m.repo.supersedeAfterLastUser.mockResolvedValue(3);
        m.repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
            ROW(3, 'user', '다시'),
            ROW(4, 'assistant', 'old', 'superseded'),
        ]);
        const res = await POST(
            post({ conversationId: 'c1', action: 'regenerate' })
        );
        const params = m.runTurn.mock.lastCall![0];
        expect(params.userMessage).toBe('다시');
        expect(params.history).toEqual([
            { role: 'user', content: 'q1' },
            { role: 'assistant', content: 'a1' },
        ]);
        // regenerate must not re-append the user row (it's already stored) — only the
        // final assistant reply is appended.
        const userAppendCall = m.repo.appendMessages.mock.calls.find(
            c => Array.isArray(c[1]) && c[1][0]?.role === 'user'
        );
        expect(userAppendCall).toBeUndefined();
        // No new user row was appended this turn, so there is no seq for the client
        // to attach to an (already-existing) bubble.
        const f = await frames(res);
        expect(f[0]).toContain('"userMessageSeq":null');
    });
    it('regenerate 대상 user 행이 없으면 400 invalid_body, lock 해제', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.supersedeAfterLastUser.mockResolvedValue(null);
        const res = await POST(
            post({ conversationId: 'c1', action: 'regenerate' })
        );
        expect(res.status).toBe(400);
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('edit: editSeq가 user 행을 가리키면 그 지점부터 삭제 후 새 메시지를 저장한다', async () => {
        m.repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
            ROW(3, 'user', 'old-q2'),
            ROW(4, 'assistant', 'old-a2'),
        ]);
        await POST(
            post({
                conversationId: 'c1',
                message: 'new-q2',
                action: 'edit',
                editSeq: 3,
            })
        );
        expect(m.repo.deleteFromSeq).toHaveBeenCalledWith('c1', 3);
        expect(m.repo.appendMessages).toHaveBeenCalledWith('c1', [
            { role: 'user', content: 'new-q2' },
        ]);
    });
    it('edit: editSeq가 assistant/tool 행을 가리키면 400 invalid_body, lock 해제, deleteFromSeq 미호출', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.listMessages.mockResolvedValue([
            ROW(1, 'user', 'q1'),
            ROW(2, 'assistant', 'a1'),
        ]);
        const res = await POST(
            post({
                conversationId: 'c1',
                message: 'x',
                action: 'edit',
                editSeq: 2,
            })
        );
        expect(res.status).toBe(400);
        expect(m.repo.deleteFromSeq).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledTimes(1);
    });
    it('edit: 존재하지 않는 editSeq는 400 invalid_body', async () => {
        m.repo.listMessages.mockResolvedValue([ROW(1, 'user', 'q1')]);
        const res = await POST(
            post({
                conversationId: 'c1',
                message: 'x',
                action: 'edit',
                editSeq: 99,
            })
        );
        expect(res.status).toBe(400);
    });

    // ---- repository throw ----
    it('repository가 예외를 던지면 500 server_error, lock 정확히 한 번 해제 (unhandled 500 아님)', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.findForUser.mockRejectedValueOnce(new Error('db down'));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'server_error' });
        expect(release).toHaveBeenCalledTimes(1);
        err.mockRestore();
    });

    it('사용자 메시지 저장 직전에 대화가 삭제되면 404 not_found, lock 한 번 해제', async () => {
        // 턴 락은 사용자 단위라 같은 사용자의 다른 탭·사이드바 삭제를 막지 못한다.
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.appendMessages.mockRejectedValueOnce(
            Object.assign(
                new Error(
                    'insert or update on table "chat_messages" violates foreign key constraint'
                ),
                { cause: { code: '23503' } }
            )
        );
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
        expect(release).toHaveBeenCalledTimes(1);
        err.mockRestore();
    });

    it('턴 도중 대화가 삭제되면 저장 FK 위반을 not_found 프레임으로 알리고 원본 오류는 노출하지 않는다', async () => {
        // cascade는 삭제 시점에 있던 행만 지우므로 늦게 도착한 저장이 FK에 걸린다.
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.repo.appendMessages
            .mockImplementationOnce(async (_c: string, rows: unknown[]) =>
                rows.map((r, i) => ({
                    ...(r as object),
                    id: `m${i}`,
                    seq: i + 1,
                }))
            )
            .mockRejectedValueOnce(
                Object.assign(
                    new Error(
                        'insert or update on table "chat_messages" violates foreign key constraint'
                    ),
                    { cause: { code: '23503' } }
                )
            );
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        const f = await frames(res);
        expect(f.some(x => x.includes('"code":"not_found"'))).toBe(true);
        expect(f.join('\n')).not.toContain('foreign key constraint');
        expect(release).toHaveBeenCalledTimes(1);
        err.mockRestore();
        warn.mockRestore();
    });

    it('부분 저장 중 대화가 삭제되면 원래 턴 오류 대신 not_found 프레임', async () => {
        // 세 번째 저장 지점(부분 저장): 마감·중단으로 부분 텍스트만 남은 턴이
        // 저장되는 순간 대화가 사라진 경우.
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.runTurn.mockResolvedValue({
            ok: false,
            error: 'deadline',
            partialText: '부분 답변',
        });
        m.repo.appendMessages
            .mockImplementationOnce(async (_c: string, rows: unknown[]) =>
                rows.map((r, i) => ({
                    ...(r as object),
                    id: `m${i}`,
                    seq: i + 1,
                }))
            )
            .mockRejectedValueOnce(
                Object.assign(
                    new Error(
                        'insert or update on table "chat_messages" violates foreign key constraint'
                    ),
                    { cause: { code: '23503' } }
                )
            );
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        const f = await frames(res);
        expect(f.some(x => x.includes('"code":"not_found"'))).toBe(true);
        expect(f.join('\n')).not.toContain('"code":"deadline"');
        expect(f.join('\n')).not.toContain('foreign key constraint');
        expect(release).toHaveBeenCalledTimes(1);
        err.mockRestore();
        warn.mockRestore();
    });

    // ---- AgentErrorCode mapping ----
    const CODES: Array<{ code: string; persistedStatus: 'aborted' | 'error' }> =
        [
            { code: 'turn_limit', persistedStatus: 'error' },
            { code: 'premium_turn_limit', persistedStatus: 'error' },
            { code: 'rate_limited', persistedStatus: 'error' },
            { code: 'server_busy', persistedStatus: 'error' },
            { code: 'server_error', persistedStatus: 'error' },
            { code: 'deadline', persistedStatus: 'aborted' },
            { code: 'aborted', persistedStatus: 'aborted' },
        ];
    for (const { code, persistedStatus } of CODES) {
        it(`턴 오류 ${code} → error 프레임, lock 정확히 한 번 해제, partialText는 status=${persistedStatus}로 저장`, async () => {
            const release = vi.fn();
            m.lock.mockResolvedValue({ release });
            m.runTurn.mockResolvedValue({
                ok: false,
                error: code,
                partialText: '중간까지',
            });
            const res = await POST(
                post({ conversationId: 'c1', message: 'x' })
            );
            const f = await frames(res);
            expect(f.at(-1)).toBe(
                `event: error\ndata: {"code":"${code}","message":"${code}"}`
            );
            expect(release).toHaveBeenCalledTimes(1);
            const call = m.repo.appendMessages.mock.calls.find(
                c => Array.isArray(c[1]) && c[1][0]?.content === '중간까지'
            );
            expect(call?.[1][0]).toMatchObject({
                role: 'assistant',
                content: '중간까지',
                status: persistedStatus,
            });
        });
    }
    it('턴 오류에 partialText가 없으면 assistant 행을 저장하지 않는다', async () => {
        m.runTurn.mockResolvedValue({ ok: false, error: 'turn_limit' });
        await POST(post({ conversationId: 'c1', message: 'x' }));
        const assistantAppendCall = m.repo.appendMessages.mock.calls.find(
            c =>
                Array.isArray(c[1]) &&
                c[1].some((r: { role: string }) => r.role === 'assistant')
        );
        expect(assistantAppendCall).toBeUndefined();
    });

    it('runAgentTurn이 예상 못한 예외를 던지면 server_error, lock 정확히 한 번 해제, 원본 예외 메시지는 프레임에 없다', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.runTurn.mockRejectedValue(
            new Error(
                "SELECT * FROM chat_messages WHERE user_id = 'u1' -- boom"
            )
        );
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        const f = await frames(res);
        const errorFrame = f.at(-1)!;
        expect(errorFrame).toBe(
            'event: error\ndata: {"code":"server_error","message":"server_error"}'
        );
        expect(errorFrame).not.toContain('SELECT');
        expect(errorFrame).not.toContain('boom');
        expect(release).toHaveBeenCalledTimes(1);
        err.mockRestore();
    });

    // ---- client disconnect ----
    it('클라이언트 연결 종료 시 turn signal이 abort되고, partial이 aborted로 저장되고, lock이 정확히 한 번 해제된다', async () => {
        const release = vi.fn();
        m.lock.mockResolvedValue({ release });
        m.runTurn.mockImplementation(
            (params: { signal: AbortSignal }) =>
                new Promise(resolve => {
                    params.signal.addEventListener('abort', () =>
                        resolve({
                            ok: false,
                            error: 'aborted',
                            partialText: '중간 답변',
                        })
                    );
                })
        );
        const res = await POST(post({ conversationId: 'c1', message: 'x' }));
        const reader = res.body!.getReader();
        await reader.read(); // meta frame
        await reader.cancel();
        // Flush the microtask queue so `work`'s finally (releaseAll) and the
        // assistant-row append after the signal's `abort` listener fire.
        await new Promise(r => setTimeout(r, 0));
        expect(release).toHaveBeenCalledTimes(1);
        const call = m.repo.appendMessages.mock.calls.find(
            c => Array.isArray(c[1]) && c[1][0]?.content === '중간 답변'
        );
        expect(call?.[1][0]).toMatchObject({ status: 'aborted' });
    });

    // ---- fixed model ----
    it('클라이언트가 model을 보내도 무시하고 AGENT_MODEL을 사용·저장한다', async () => {
        await POST(
            post({ conversationId: null, message: 'x', model: 'claude-opus-5' })
        );
        expect(m.repo.create).toHaveBeenCalledWith(
            expect.objectContaining({ modelId: 'deepseek-v4.1-flash' })
        );
        expect(m.runTurn.mock.lastCall![0].model).toBe('deepseek-v4.1-flash');
    });

    it('[Agent] 로그에 tool_end 타이밍이 실린다', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        m.runTurn.mockImplementation(
            async (_p: unknown, deps: { onEvent: (e: unknown) => void }) => {
                deps.onEvent({
                    type: 'tool_end',
                    id: 't',
                    name: 'get_quote',
                    status: 'ok',
                    ms: 12,
                    summary: '',
                });
                return { ...OK_TURN, toolsUsed: ['get_quote'] };
            }
        );
        await frames(await POST(post({ conversationId: 'c1', message: 'x' })));
        const line = info.mock.calls.find(
            c => c[0] === '[Agent]'
        )![1] as string;
        expect(JSON.parse(line).toolCalls).toEqual([
            { name: 'get_quote', ms: 12, status: 'ok' },
        ]);
        info.mockRestore();
    });

    it('tool_end summary가 민감정보를 담고 있어도 SSE 출력에는 안전한 요약만 실린다(운반만, 가공은 tools 계층 책임)', async () => {
        m.runTurn.mockImplementation(
            async (_p: unknown, deps: { onEvent: (e: unknown) => void }) => {
                // tools/createToolExecutor (Task 9) already guarantees `summary` never
                // carries raw error text/SQL — this asserts the route does not add its
                // own leak by re-logging or re-shaping the event with extra fields.
                deps.onEvent({
                    type: 'tool_end',
                    id: 't',
                    name: 'get_quote',
                    status: 'error',
                    ms: 3,
                    summary: 'tool_failed',
                });
                return OK_TURN;
            }
        );
        const f = await frames(
            await POST(post({ conversationId: 'c1', message: 'x' }))
        );
        const toolEndFrame = f.find(x => x.startsWith('event: tool_end'));
        expect(toolEndFrame).not.toContain('u1');
        expect(toolEndFrame).not.toContain('SELECT');
        expect(toolEndFrame).toContain('tool_failed');
    });
});
