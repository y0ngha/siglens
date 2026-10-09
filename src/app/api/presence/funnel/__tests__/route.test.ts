import { constants } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNNEL_BODY_MAX_BYTES } from '@/shared/lib/funnel/funnelEvents';

const {
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

const HUMAN_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0.0.0';
const BOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const record = vi.fn().mockResolvedValue(undefined);
const pruneOlderThan = vi.fn().mockResolvedValue(undefined);
let requestHeaders = new Headers();
const { afterTasks, auth } = vi.hoisted(() => ({
    afterTasks: [] as Promise<unknown>[],
    auth: { user: null as { id: string } | null, fail: false },
}));

async function flushAfter(): Promise<void> {
    while (afterTasks.length > 0) {
        await Promise.all(afterTasks.splice(0));
    }
}

vi.mock('next/headers', () => ({
    headers: () => Promise.resolve(requestHeaders),
}));
vi.mock('next/server', async importOriginal => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        after: (fn: () => unknown) => {
            afterTasks.push(Promise.resolve(fn()));
        },
    };
});
const getDatabaseClient = vi.fn(() => ({ db: {} }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => getDatabaseClient(),
}));
vi.mock('@/entities/funnel/api', () => ({
    DrizzleFunnelEventRepository: class {
        record = record;
        pruneOlderThan = pruneOlderThan;
    },
}));
vi.mock('@/entities/visitor/lib/visitorHash', () => ({
    buildVisitorHash: (pepper: string, ip: string, ua: string) =>
        `hash(${pepper}|${ip}|${ua})`,
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: () =>
        auth.fail
            ? Promise.reject(new Error('session store down'))
            : Promise.resolve(auth.user),
}));

/** 라우트가 모듈 스코프에 마지막 prune 날짜를 들고 있어 테스트마다 새로 import한다. */
async function importRoute() {
    vi.resetModules();
    return import('@/app/api/presence/funnel/route');
}

function makeRequest(body: unknown): Request {
    return new Request('http://localhost:4200/api/presence/funnel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

const VALID = { event: 'gate_clicked', context: { gate: 'timeframe' } };

describe('POST /api/presence/funnel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        afterTasks.length = 0;
        auth.user = null;
        auth.fail = false;
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getDatabaseClient.mockReturnValue({ db: {} });
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('VISITOR_HASH_PEPPER', 'test-pepper');
        requestHeaders = new Headers({
            'user-agent': HUMAN_UA,
            'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it('사람의 유효한 이벤트를 기록하고 204를 준다', async () => {
        const { POST } = await importRoute();
        const res = await POST(makeRequest(VALID));
        await flushAfter();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(record).toHaveBeenCalledWith({
            visitorHash: `hash(test-pepper|203.0.113.10|${HUMAN_UA})`,
            userId: null,
            event: 'gate_clicked',
            context: { gate: 'timeframe' },
        });
    });

    it('로그인 회원이면 user_id를 채운다', async () => {
        auth.user = { id: 'user-42' };
        const { POST } = await importRoute();
        await POST(makeRequest(VALID));
        await flushAfter();
        expect(record).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-42' })
        );
    });

    it('회원 확정이 실패하면 비회원으로 기록하고 로그를 남긴다', async () => {
        auth.fail = true;
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { POST } = await importRoute();
        expect((await POST(makeRequest(VALID))).status).toBe(
            HTTP_STATUS_NO_CONTENT
        );
        await flushAfter();
        expect(record).toHaveBeenCalledWith(
            expect.objectContaining({ userId: null })
        );
        expect(spy).toHaveBeenCalledWith(
            '[funnel] getCurrentUser failed:',
            expect.any(Error)
        );
        spy.mockRestore();
    });

    it('봇 User-Agent는 본문을 보지도 않고 204', async () => {
        requestHeaders.set('user-agent', BOT_UA);
        const { POST } = await importRoute();
        expect((await POST(makeRequest('{not json'))).status).toBe(
            HTTP_STATUS_NO_CONTENT
        );
        await flushAfter();
        expect(record).not.toHaveBeenCalled();
    });

    it('프로덕션이 아니면 기록하지 않는다', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { POST } = await importRoute();
        expect((await POST(makeRequest(VALID))).status).toBe(
            HTTP_STATUS_NO_CONTENT
        );
        await flushAfter();
        expect(record).not.toHaveBeenCalled();
    });

    it('모르는 event는 400', async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({ event: 'page_view', context: {} })
        );
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
        await flushAfter();
        expect(record).not.toHaveBeenCalled();
    });

    it('context 여분 키는 400 — 자유 텍스트의 통로다', async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                event: 'gate_clicked',
                context: { gate: 'timeframe', query: 'nvda' },
            })
        );
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });

    it('본문이 1KB를 넘으면 파싱 전에 400', async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                event: 'gate_clicked',
                context: { gate: 'x'.repeat(FUNNEL_BODY_MAX_BYTES) },
            })
        );
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });

    it('JSON이 아니면 400', async () => {
        const { POST } = await importRoute();
        expect((await POST(makeRequest('{not json'))).status).toBe(
            HTTP_STATUS_BAD_REQUEST
        );
    });

    it('pepper가 없으면 500과 함께 로그를 남긴다', async () => {
        vi.stubEnv('VISITOR_HASH_PEPPER', '');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { POST } = await importRoute();
        const res = await POST(makeRequest(VALID));
        await flushAfter();
        expect(res.status).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('VISITOR_HASH_PEPPER')
        );
        expect(record).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('DB 기록이 실패해도 204를 주고 정리를 소진하지 않는다', async () => {
        record.mockRejectedValueOnce(new Error('rds down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { POST } = await importRoute();
        expect((await POST(makeRequest(VALID))).status).toBe(
            HTTP_STATUS_NO_CONTENT
        );
        await flushAfter();
        expect(spy).toHaveBeenCalledWith(
            '[funnel] record failed:',
            expect.any(Error)
        );
        expect(pruneOlderThan).not.toHaveBeenCalled();

        await POST(makeRequest(VALID));
        await flushAfter();
        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('정리는 하루 한 번, 기준일은 오늘(KST)로부터 400일 전', async () => {
        vi.setSystemTime(new Date('2026-09-02T03:00:00.000Z'));
        const { POST } = await importRoute();
        await POST(makeRequest(VALID));
        await flushAfter();
        await POST(makeRequest(VALID));
        await flushAfter();
        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
        expect(pruneOlderThan).toHaveBeenCalledWith('2025-07-29');
    });

    it('응답은 기록을 기다리지 않는다 — after()로 응답 뒤에 돈다', async () => {
        let release!: () => void;
        record.mockImplementationOnce(
            () =>
                new Promise<void>(resolve => {
                    release = resolve;
                })
        );
        const { POST } = await importRoute();
        const res = await POST(makeRequest(VALID));
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(record).toHaveBeenCalledTimes(1);
        expect(pruneOlderThan).not.toHaveBeenCalled();
        release();
        await flushAfter();
        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
    });
});
