const dns = vi.hoisted(() => ({
    lookup: vi.fn<
        (host: string, opts: unknown) => Promise<Array<{ address: string }>>
    >(),
}));
vi.mock('node:dns/promises', () => ({ lookup: dns.lookup }));

const transport = vi.hoisted(() => ({
    get: vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(),
}));
// The pinned transport is replaced: no real socket opens in these tests.
vi.mock('@/shared/api/web/pinnedRequest', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/web/pinnedRequest')
    >()),
    pinnedGet: transport.get,
}));

const redis = vi.hoisted(() => ({
    client: null as null | {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown, opts: unknown) => Promise<unknown>;
    },
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => redis.client,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fetchPageExcerpt,
    SIGLENS_AI_USER_AGENT,
} from '@/app/api/ai/chat/tools/fetchPageExcerpt';
import { UnsupportedEncodingError } from '@/shared/api/web/pinnedRequest';
import { __resetInFlightForTests } from '@/shared/cache/getOrSetCache';

const PUBLIC_V4 = '93.184.216.34';
const html = (body: string, head = '') =>
    `<!doctype html><html><head>${head}</head><body><article>${body}</article></body></html>`;
const ARTICLE = html(
    '<p>The central bank held interest rates steady on Wednesday and signalled patience on future cuts.</p>'.repeat(
        3
    ),
    '<meta property="article:published_time" content="2026-11-20T09:00:00Z">'
);

type Route = (url: string) => Response | Promise<Response> | undefined;
const fetchMock = transport.get;
function route(handler: Route) {
    fetchMock.mockImplementation(async url => {
        const response = await handler(String(url));
        if (response === undefined)
            throw new Error(`unrouted request: ${String(url)}`);
        return response;
    });
}
const htmlResponse = (
    body: BodyInit,
    contentType = 'text/html; charset=utf-8'
) =>
    new Response(body, {
        status: 200,
        headers: { 'content-type': contentType },
    });
const robotsAt = (host: string) => `https://${host}/robots.txt`;
const callsTo = (url: string) =>
    fetchMock.mock.calls.filter(c => String(c[0]) === url);
const live = () => new AbortController().signal;

describe('fetchPageExcerpt', () => {
    beforeEach(() => {
        dns.lookup.mockReset();
        dns.lookup.mockResolvedValue([{ address: PUBLIC_V4 }]);
        fetchMock.mockReset();
        // Reject by default: an unrouted request must never reach the network.
        fetchMock.mockRejectedValue(new Error('unrouted request'));
        redis.client = null;
        __resetInFlightForTests();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the excerpt and publishedAt, with an honest user agent and no cookies', async () => {
        route(url => {
            if (url === robotsAt('a.example.com'))
                return new Response('', { status: 404 });
            if (url === 'https://a.example.com/news/1')
                return htmlResponse(ARTICLE);
        });
        const result = await fetchPageExcerpt(
            'https://a.example.com/news/1',
            ['rates'],
            live(),
            3_000
        );
        expect(result).toMatchObject({
            ok: true,
            publishedAt: '2026-11-20T09:00:00.000Z',
        });
        expect(result.ok && result.excerpt).toContain(
            'central bank held interest rates'
        );
        const pageCall = callsTo('https://a.example.com/news/1').at(0);
        const headers = pageCall?.[1].headers as Record<string, string>;
        expect(headers['User-Agent']).toBe(SIGLENS_AI_USER_AGENT);
        expect(headers['User-Agent']).toContain('SiglensAI');
        expect(Object.keys(headers).map(k => k.toLowerCase())).not.toContain(
            'cookie'
        );
    });

    it('is refused by robots.txt for the site-wide `*` group, without fetching the page', async () => {
        route(url => {
            if (url === robotsAt('b.example.com'))
                return new Response('User-agent: *\nDisallow: /', {
                    status: 200,
                });
        });
        expect(
            await fetchPageExcerpt('https://b.example.com/x', [], live(), 3_000)
        ).toEqual({ ok: false, status: 'robots' });
        expect(callsTo('https://b.example.com/x')).toHaveLength(0);
    });

    it('lets a SiglensAI-specific group override the `*` group', async () => {
        route(url => {
            if (url === robotsAt('c.example.com'))
                return new Response(
                    'User-agent: *\nDisallow: /\n\nUser-agent: SiglensAI\nDisallow: /private',
                    { status: 200 }
                );
            if (url === 'https://c.example.com/public/a')
                return htmlResponse(ARTICLE);
        });
        expect(
            (
                await fetchPageExcerpt(
                    'https://c.example.com/public/a',
                    ['rates'],
                    live(),
                    3_000
                )
            ).ok
        ).toBe(true);
        expect(
            await fetchPageExcerpt(
                'https://c.example.com/private/a',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'robots' });
    });

    it('treats a 5xx robots.txt as disallowed and does not cache that outcome', async () => {
        const store = new Map<string, unknown>();
        redis.client = {
            get: async key => store.get(key) ?? null,
            set: async (key, value) => void store.set(key, value),
        };
        route(url => {
            if (url === robotsAt('d.example.com'))
                return new Response('oops', { status: 503 });
        });
        expect(
            await fetchPageExcerpt('https://d.example.com/x', [], live(), 3_000)
        ).toEqual({ ok: false, status: 'robots' });
        expect(store.size).toBe(0);
        await fetchPageExcerpt('https://d.example.com/y', [], live(), 3_000);
        expect(callsTo(robotsAt('d.example.com'))).toHaveLength(2);
    });

    it('treats a robots.txt timeout as disallowed: a real 1 s signal fires and ends the request', async () => {
        const realTimeout = AbortSignal.timeout.bind(AbortSignal);
        const robotsClock = new AbortController();
        const timeoutSpy = vi
            .spyOn(AbortSignal, 'timeout')
            .mockImplementation(ms =>
                ms === 1_000 ? robotsClock.signal : realTimeout(ms)
            );
        const turn = live();
        const seen: AbortSignal[] = [];
        fetchMock.mockImplementation(
            (url, init) =>
                new Promise<Response>((resolve, reject) => {
                    if (String(url) !== robotsAt('e.example.com'))
                        return resolve(htmlResponse(ARTICLE));
                    const signal = init.signal as AbortSignal;
                    seen.push(signal);
                    signal.addEventListener('abort', () =>
                        reject(signal.reason)
                    );
                })
        );
        const pending = fetchPageExcerpt(
            'https://e.example.com/x',
            [],
            turn,
            3_000
        );
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        // Its own 1,000 ms signal, not the turn's, and nothing else aborts it.
        expect(timeoutSpy).toHaveBeenCalledWith(1_000);
        expect(seen[0]).toBe(robotsClock.signal);
        expect(seen[0]).not.toBe(turn);
        expect(seen[0].aborted).toBe(false);
        robotsClock.abort(new DOMException('timed out', 'TimeoutError'));
        expect(await pending).toEqual({ ok: false, status: 'robots' });
        expect(callsTo('https://e.example.com/x')).toHaveLength(0);
    });

    it('maps an abort during the page body to timeout (the signal reason, not a connection reset)', async () => {
        const turn = new AbortController();
        fetchMock.mockImplementation(async (url, init) => {
            if (String(url) === robotsAt('v.example.com'))
                return new Response('', { status: 404 });
            const signal = init.signal as AbortSignal;
            return htmlResponse(
                new ReadableStream({
                    start(controller) {
                        signal.addEventListener('abort', () =>
                            controller.error(signal.reason)
                        );
                    },
                })
            );
        });
        const pending = fetchPageExcerpt(
            'https://v.example.com/x',
            [],
            turn.signal,
            3_000
        );
        await vi.waitFor(() =>
            expect(callsTo('https://v.example.com/x')).toHaveLength(1)
        );
        turn.abort();
        expect(await pending).toEqual({ ok: false, status: 'timeout' });
    });

    it('caches a parsed robots.txt for the host (second page of the same host reuses it)', async () => {
        const store = new Map<string, unknown>();
        redis.client = {
            get: async key => store.get(key) ?? null,
            set: async (key, value) => void store.set(key, value),
        };
        route(url => {
            if (url === robotsAt('f.example.com'))
                return new Response('User-agent: *\nDisallow: /nope', {
                    status: 200,
                });
            if (url.startsWith('https://f.example.com/ok'))
                return htmlResponse(ARTICLE);
        });
        await fetchPageExcerpt(
            'https://f.example.com/ok/1',
            ['rates'],
            live(),
            3_000
        );
        await fetchPageExcerpt(
            'https://f.example.com/ok/2',
            ['rates'],
            live(),
            3_000
        );
        expect(callsTo(robotsAt('f.example.com'))).toHaveLength(1);
        expect([...store.keys()]).toEqual([
            'web:robots:v1:https://f.example.com',
        ]);
        expect(
            await fetchPageExcerpt(
                'https://f.example.com/nope/3',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'robots' });
    });

    it('does not trust a malformed cached robots entry', async () => {
        redis.client = {
            get: async () => ({ data: { kind: 'rules', rules: 'not-a-list' } }),
            set: async () => undefined,
        };
        route(() => undefined);
        expect(
            await fetchPageExcerpt('https://g.example.com/x', [], live(), 3_000)
        ).toEqual({ ok: false, status: 'robots' });
        expect(callsTo('https://g.example.com/x')).toHaveLength(0);
    });

    it('reports blocked for a host that resolves to a private address, with no request sent', async () => {
        dns.lookup.mockResolvedValue([{ address: '10.0.0.8' }]);
        expect(
            await fetchPageExcerpt('https://h.example.com/x', [], live(), 3_000)
        ).toEqual({ ok: false, status: 'blocked' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports blocked when a redirect leads to a private address', async () => {
        route(url => {
            if (url === robotsAt('i.example.com'))
                return new Response('', { status: 404 });
            if (url === 'https://i.example.com/x')
                return new Response(null, {
                    status: 302,
                    headers: {
                        location: 'http://169.254.169.254/latest/meta-data',
                    },
                });
        });
        expect(
            await fetchPageExcerpt('https://i.example.com/x', [], live(), 3_000)
        ).toEqual({ ok: false, status: 'blocked' });
        expect(
            fetchMock.mock.calls.filter(c => String(c[0]).includes('169.254'))
        ).toHaveLength(0);
    });

    it('rejects a non-HTML content type', async () => {
        route(url => {
            if (url === robotsAt('j.example.com'))
                return new Response('', { status: 404 });
            if (url === 'https://j.example.com/data')
                return htmlResponse('{"a":1}', 'application/json');
        });
        expect(
            await fetchPageExcerpt(
                'https://j.example.com/data',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'not_html' });
    });

    it('reports error for a non-200 page and for a page with no readable text', async () => {
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://k.example.com/gone')
                return new Response('gone', { status: 410 });
            if (url === 'https://k.example.com/empty')
                return htmlResponse('<html><body><div>hi</div></body></html>');
        });
        expect(
            await fetchPageExcerpt(
                'https://k.example.com/gone',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'error' });
        expect(
            await fetchPageExcerpt(
                'https://k.example.com/empty',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'error' });
    });

    it('rejects an oversized page by Content-Length, and a streamed one that outgrows the cap', async () => {
        const chunk = new Uint8Array(1_000_000);
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://l.example.com/declared')
                return new Response('x', {
                    status: 200,
                    headers: {
                        'content-type': 'text/html',
                        'content-length': '2000000',
                    },
                });
            if (url === 'https://l.example.com/streamed')
                return htmlResponse(
                    new ReadableStream({
                        start(controller) {
                            controller.enqueue(chunk);
                            controller.enqueue(chunk);
                            controller.close();
                        },
                    })
                );
        });
        expect(
            await fetchPageExcerpt(
                'https://l.example.com/declared',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'too_large' });
        expect(
            await fetchPageExcerpt(
                'https://l.example.com/streamed',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'too_large' });
    });

    it('treats a robots.txt that redirects too many times as having no rules (RFC 9309)', async () => {
        route(url => {
            if (url === robotsAt('s.example.com'))
                return new Response(null, {
                    status: 302,
                    headers: { location: 'https://s.example.com/robots.txt' },
                });
            if (url === 'https://s.example.com/x') return htmlResponse(ARTICLE);
        });
        expect(
            (
                await fetchPageExcerpt(
                    'https://s.example.com/x',
                    ['rates'],
                    live(),
                    3_000
                )
            ).ok
        ).toBe(true);
    });

    it('fetches robots.txt on its own timeout signal, not the first caller turn signal', async () => {
        const turn = new AbortController();
        const seen: boolean[] = [];
        route(url => {
            if (url === robotsAt('t.example.com')) {
                const init = fetchMock.mock.calls.find(
                    c => String(c[0]) === url
                )?.[1];
                seen.push(init?.signal === turn.signal);
                return new Response('', { status: 404 });
            }
            if (url === 'https://t.example.com/x') return htmlResponse(ARTICLE);
        });
        await fetchPageExcerpt(
            'https://t.example.com/x',
            ['rates'],
            turn.signal,
            3_000
        );
        expect(seen).toEqual([false]);
    });

    it('an aborted first caller does not poison robots.txt for a second caller of the same host', async () => {
        const first = new AbortController();
        route(url => {
            if (url === robotsAt('u.example.com'))
                return new Response('', { status: 404 });
            if (url === 'https://u.example.com/x') return htmlResponse(ARTICLE);
        });
        const [a, b] = await Promise.all([
            fetchPageExcerpt(
                'https://u.example.com/x',
                ['rates'],
                first.signal,
                3_000
            ),
            fetchPageExcerpt(
                'https://u.example.com/x',
                ['rates'],
                live(),
                3_000
            ),
        ]);
        first.abort();
        expect(a.ok).toBe(true);
        expect(b.ok).toBe(true);
        expect(callsTo(robotsAt('u.example.com'))).toHaveLength(1);
    });

    it('accepts a page just under the size cap', async () => {
        const filler = ' '.repeat(1_400_000);
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://m.example.com/big')
                return htmlResponse(`${ARTICLE}<!--${filler}-->`);
        });
        expect(
            (
                await fetchPageExcerpt(
                    'https://m.example.com/big',
                    ['rates'],
                    live(),
                    3_000
                )
            ).ok
        ).toBe(true);
    });

    it('maps a fetch timeout to timeout, and an exhausted turn signal to timeout', async () => {
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://n.example.com/slow')
                throw new DOMException('timed out', 'TimeoutError');
        });
        expect(
            await fetchPageExcerpt(
                'https://n.example.com/slow',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'timeout' });
        const aborted = new AbortController();
        aborted.abort();
        fetchMock.mockImplementation(async (_url, init) => {
            if (init.signal?.aborted)
                throw new DOMException('aborted', 'AbortError');
            return new Response('', { status: 404 });
        });
        expect(
            await fetchPageExcerpt(
                'https://n.example.com/x',
                [],
                aborted.signal,
                3_000
            )
        ).toEqual({ ok: false, status: 'timeout' });
    });

    it('reports error and logs only the error name for an unexpected failure', async () => {
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://o.example.com/x')
                throw new TypeError(
                    'connect ECONNREFUSED 10.0.0.1:443 secret-detail'
                );
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(
            await fetchPageExcerpt('https://o.example.com/x', [], live(), 3_000)
        ).toEqual({ ok: false, status: 'error' });
        const logged = JSON.stringify(warn.mock.calls);
        expect(logged).toContain('TypeError');
        expect(logged).not.toContain('secret-detail');
        expect(logged).not.toContain('o.example.com');
    });

    it('reports error and warns with the error name when the page uses an encoding we cannot decode', async () => {
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://w.example.com/zstd')
                throw new UnsupportedEncodingError();
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(
            await fetchPageExcerpt(
                'https://w.example.com/zstd',
                [],
                live(),
                3_000
            )
        ).toEqual({ ok: false, status: 'error' });
        expect(JSON.stringify(warn.mock.calls)).toContain(
            'UnsupportedEncodingError'
        );
    });

    it('decodes an euc-kr page declared in the Content-Type header', async () => {
        // "한국" in EUC-KR is C7 D1 B1 B9.
        const korean = Uint8Array.from(
            Array.from({ length: 20 }, () => [0xc7, 0xd1, 0xb1, 0xb9]).flat()
        );
        const bytes = Buffer.concat([
            Buffer.from('<html><body><article><p>'),
            Buffer.from(korean),
            Buffer.from('</p></article></body></html>'),
        ]);
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://p.example.com/kr')
                return htmlResponse(bytes, 'text/html; charset=EUC-KR');
        });
        const result = await fetchPageExcerpt(
            'https://p.example.com/kr',
            ['한국'],
            live(),
            3_000
        );
        expect(result.ok && result.excerpt).toBe('한국'.repeat(20));
    });

    it('decodes an euc-kr page declared only in <meta charset>', async () => {
        const korean = Uint8Array.from(
            Array.from({ length: 20 }, () => [0xc7, 0xd1, 0xb1, 0xb9]).flat()
        );
        const bytes = Buffer.concat([
            Buffer.from('<html><head><meta charset="euc-kr"></head><body><p>'),
            Buffer.from(korean),
            Buffer.from('</p></body></html>'),
        ]);
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://q.example.com/kr')
                return htmlResponse(bytes, 'text/html');
        });
        const result = await fetchPageExcerpt(
            'https://q.example.com/kr',
            ['한국'],
            live(),
            3_000
        );
        expect(result.ok && result.excerpt).toBe('한국'.repeat(20));
    });

    it('falls back to UTF-8 for an unknown charset name', async () => {
        route(url => {
            if (url.endsWith('/robots.txt'))
                return new Response('', { status: 404 });
            if (url === 'https://r.example.com/x')
                return htmlResponse(ARTICLE, 'text/html; charset=x-made-up');
        });
        expect(
            (
                await fetchPageExcerpt(
                    'https://r.example.com/x',
                    ['rates'],
                    live(),
                    3_000
                )
            ).ok
        ).toBe(true);
    });
});
