vi.mock('server-only', () => ({}));

const { mockCredentials } = vi.hoisted(() => ({
    mockCredentials: vi.fn<() => { url: string; token: string } | null>(),
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getUpstashWriterCredentials: mockCredentials,
}));

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { runUpstashCommandOutsideFetch } from '../upstashRenderSafeCommand';

interface Received {
    readonly method: string | undefined;
    readonly auth: string | undefined;
    readonly body: unknown;
}

// 실제 HTTP 서버로 프로토콜(POST, Bearer, 문자열 인자 배열)과 응답 처리를 본다.
function startServer(reply: { status: number; body: string }): Promise<{
    url: string;
    received: Received[];
    close: () => Promise<void>;
}> {
    const received: Received[] = [];
    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            received.push({
                method: req.method,
                auth: req.headers.authorization,
                body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
            res.writeHead(reply.status, { 'Content-Type': 'application/json' });
            res.end(reply.body);
        });
    });
    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as AddressInfo;
            resolve({
                url: `http://127.0.0.1:${port}`,
                received,
                close: () => new Promise(r => server.close(() => r())),
            });
        });
    });
}

describe('runUpstashCommandOutsideFetch', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // 전역 fetch를 타면 안 된다 — 탔다면 이 거부가 실패로 드러난다.
        fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('global fetch must not be used'));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it('명령을 문자열 배열로 POST하고 result를 돌려준다(전역 fetch 미사용)', async () => {
        const server = await startServer({
            status: 200,
            body: '{"result":"OK"}',
        });
        mockCredentials.mockReturnValue({ url: server.url, token: 'tok' });
        try {
            await expect(
                runUpstashCommandOutsideFetch(['SET', 'k', '1', 'EX', 172800])
            ).resolves.toBe('OK');
            expect(server.received).toEqual([
                {
                    method: 'POST',
                    auth: 'Bearer tok',
                    body: ['SET', 'k', '1', 'EX', '172800'],
                },
            ]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            await server.close();
        }
    });

    it('{"error"} 응답이면 던진다', async () => {
        const server = await startServer({
            status: 200,
            body: '{"error":"NOPERM"}',
        });
        mockCredentials.mockReturnValue({ url: server.url, token: 'tok' });
        try {
            await expect(
                runUpstashCommandOutsideFetch(['SET', 'k', '1'])
            ).rejects.toThrow('upstash error: NOPERM');
        } finally {
            await server.close();
        }
    });

    it('2xx가 아니면 던진다', async () => {
        const server = await startServer({ status: 401, body: '{}' });
        mockCredentials.mockReturnValue({ url: server.url, token: 'tok' });
        try {
            await expect(
                runUpstashCommandOutsideFetch(['GET', 'k'])
            ).rejects.toThrow('upstash http 401');
        } finally {
            await server.close();
        }
    });

    it('2xx인데 본문이 JSON이 아니면 던진다', async () => {
        const server = await startServer({ status: 200, body: 'not json' });
        mockCredentials.mockReturnValue({ url: server.url, token: 'tok' });
        try {
            await expect(
                runUpstashCommandOutsideFetch(['GET', 'k'])
            ).rejects.toThrow(SyntaxError);
        } finally {
            await server.close();
        }
    });

    // 응답이 오지 않아도 promise가 settle돼야 ISR 렌더가 멈추지 않는다.
    it('응답이 없으면 2초 timeout으로 거부한다', async () => {
        const hanging = http.createServer(() => undefined);
        await new Promise<void>(r => hanging.listen(0, '127.0.0.1', () => r()));
        const { port } = hanging.address() as AddressInfo;
        mockCredentials.mockReturnValue({
            url: `http://127.0.0.1:${port}`,
            token: 'tok',
        });
        try {
            await expect(
                runUpstashCommandOutsideFetch(['GET', 'k'])
            ).rejects.toThrow('upstash timeout after 2000ms');
        } finally {
            hanging.closeAllConnections();
            await new Promise<void>(r => hanging.close(() => r()));
        }
    }, 6_000);

    it('자격증명이 없으면 던진다', async () => {
        mockCredentials.mockReturnValue(null);
        await expect(
            runUpstashCommandOutsideFetch(['GET', 'k'])
        ).rejects.toThrow('upstash not configured');
    });
});
