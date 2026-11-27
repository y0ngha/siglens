const dns = vi.hoisted(() => ({
    lookup: vi.fn<
        (
            host: string,
            opts: unknown
        ) => Promise<Array<{ address: string; family: number }>>
    >(),
}));
vi.mock('node:dns/promises', () => ({ lookup: dns.lookup }));
const net = vi.hoisted(() => ({
    reply: null as null | FakeReply,
    error: null as Error | null,
    options: [] as Array<Record<string, unknown>>,
    requestDestroy: null as null | ((error?: Error) => void),
    lastRes: null as null | {
        destroyed: boolean;
        destroy: (e?: Error) => unknown;
    },
    produced: 0,
    decoders: [] as Array<{ destroyed: boolean }>,
}));
vi.mock('node:https', () => ({
    default: {
        request: (
            _url: URL,
            options: Record<string, unknown>,
            cb: (res: unknown) => void
        ) => {
            net.options.push(options);
            const emitter = new EventEmitter() as EventEmitter & {
                end: () => void;
                destroy: (e?: Error) => void;
            };
            emitter.destroy = vi.fn();
            net.requestDestroy = emitter.destroy;
            emitter.end = () => {
                if (net.error !== null) {
                    const failure = net.error;
                    queueMicrotask(() => emitter.emit('error', failure));
                    return;
                }
                const reply = net.reply as FakeReply;
                net.produced = 0;
                const res = Object.assign(
                    new Readable({
                        read() {
                            const next = reply.chunks[net.produced];
                            if (next === undefined && reply.hang) return;
                            net.produced += 1;
                            this.push(next ?? null);
                        },
                    }),
                    { statusCode: reply.statusCode, headers: reply.headers }
                );
                net.lastRes = res;
                queueMicrotask(() => cb(res));
            };
            return emitter;
        },
    },
}));
vi.mock('node:http', () => ({ default: { request: vi.fn() } }));
vi.mock('node:zlib', async importOriginal => {
    const actual = await importOriginal<typeof import('node:zlib')>();
    return {
        ...actual,
        createGunzip: () => {
            const decoder = actual.createGunzip();
            net.decoders.push(decoder);
            return decoder;
        },
    };
});

import { EventEmitter, getEventListeners } from 'node:events';
import { Readable } from 'node:stream';
import { deflateSync, gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    BlockedAddressError,
    pinnedGet,
    pinnedLookup,
    resolveCheckedAddresses,
    UnsupportedEncodingError,
} from '@/shared/api/web/pinnedRequest';

interface FakeReply {
    statusCode: number;
    headers: Record<string, string | string[]>;
    /** Chunks are pushed one per read, so a consumer can stop before the end. */
    chunks: Buffer[];
    /** Never end the stream after the last chunk (a stalled server). */
    hang?: boolean;
}

const PUBLIC = { address: '93.184.216.34', family: 4 };

function runLookup(host: string, options: { all?: boolean } | undefined) {
    return new Promise<{
        error: Error | null;
        address: unknown;
        family?: number;
    }>(resolve =>
        pinnedLookup(host, options, (error, address, family) =>
            resolve({ error, address, family })
        )
    );
}

describe('connect-time address check', () => {
    beforeEach(() => {
        dns.lookup.mockReset();
        dns.lookup.mockResolvedValue([PUBLIC]);
    });

    it('refuses a lookup that returns a private address at connect time', async () => {
        dns.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
        const out = await runLookup('rebind.example.com', { all: true });
        expect(out.error).toBeInstanceOf(BlockedAddressError);
        await expect(
            resolveCheckedAddresses('rebind.example.com')
        ).rejects.toBeInstanceOf(BlockedAddressError);
    });

    it.each([
        '127.0.0.1',
        '169.254.169.254',
        '::1',
        '::ffff:10.0.0.1',
        'fd00::1',
    ])(
        'refuses when any one of several addresses is blocked (%s)',
        async address => {
            dns.lookup.mockResolvedValue([
                PUBLIC,
                { address, family: address.includes(':') ? 6 : 4 },
            ]);
            expect(
                (await runLookup('mixed.example.com', { all: true })).error
            ).toBeInstanceOf(BlockedAddressError);
        }
    );

    it('refuses an empty answer', async () => {
        dns.lookup.mockResolvedValue([]);
        expect((await runLookup('empty.example.com', {})).error).toBeInstanceOf(
            BlockedAddressError
        );
    });

    it('hands back only checked addresses, in the shape the caller asked for', async () => {
        dns.lookup.mockResolvedValue([
            PUBLIC,
            { address: '2606:4700:4700::1111', family: 6 },
        ]);
        const all = await runLookup('ok.example.com', { all: true });
        expect(all.address).toEqual([
            PUBLIC,
            { address: '2606:4700:4700::1111', family: 6 },
        ]);
        const single = await runLookup('ok.example.com', undefined);
        expect(single).toMatchObject({
            error: null,
            address: PUBLIC.address,
            family: 4,
        });
        expect(dns.lookup).toHaveBeenCalledWith('ok.example.com', {
            all: true,
        });
    });

    it('passes a DNS failure through as an error', async () => {
        dns.lookup.mockRejectedValue(new Error('ENOTFOUND'));
        expect((await runLookup('gone.example.com', {})).error?.message).toBe(
            'ENOTFOUND'
        );
    });
});

const live = () => new AbortController().signal;
const one = (text: string | Buffer): Buffer[] => [Buffer.from(text)];

describe('pinnedGet', () => {
    beforeEach(() => {
        net.options.length = 0;
        net.error = null;
        net.decoders.length = 0;
        net.reply = {
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            chunks: one('hello'),
        };
    });

    it('connects through the pinned lookup and returns a fetch Response', async () => {
        const signal = live();
        const response = await pinnedGet(new URL('https://example.com/a'), {
            headers: { 'User-Agent': 'x' },
            signal,
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/html');
        expect(await response.text()).toBe('hello');
        const options = net.options.at(-1);
        expect(options?.lookup).toBe(pinnedLookup);
        expect(options?.signal).toBe(signal);
        expect(options).toMatchObject({
            method: 'GET',
            headers: { 'User-Agent': 'x' },
        });
    });

    it('decodes gzip and drops the now-wrong encoding and length headers', async () => {
        net.reply = {
            statusCode: 200,
            headers: {
                'content-encoding': 'gzip',
                'content-length': '999',
                'content-type': 'text/html',
            },
            chunks: one(gzipSync('squeezed page')),
        };
        const response = await pinnedGet(new URL('https://example.com/z'), {
            signal: live(),
        });
        expect(response.headers.get('content-encoding')).toBeNull();
        expect(response.headers.get('content-length')).toBeNull();
        expect(await response.text()).toBe('squeezed page');
    });

    it('decodes stacked encodings in reverse order and ignores identity', async () => {
        // "Content-Encoding: deflate, gzip" means deflate was applied first, then gzip.
        net.reply = {
            statusCode: 200,
            headers: { 'content-encoding': 'identity, Deflate , GZIP' },
            chunks: one(gzipSync(deflateSync('layered'))),
        };
        const response = await pinnedGet(new URL('https://example.com/s'), {
            signal: live(),
        });
        expect(await response.text()).toBe('layered');
    });

    it('rejects an encoding it cannot decode, and closes the socket', async () => {
        net.reply = {
            statusCode: 200,
            headers: { 'content-encoding': 'zstd' },
            chunks: one('x'),
        };
        await expect(
            pinnedGet(new URL('https://example.com/u'), { signal: live() })
        ).rejects.toBeInstanceOf(UnsupportedEncodingError);
        expect(net.requestDestroy).toHaveBeenCalled();
        expect(net.lastRes?.destroyed).toBe(true);
    });

    it('stops decompressing when the consumer cancels: a small gzip bomb is not read to the end', async () => {
        const BOMB_SLICE = 256;
        const bomb = gzipSync(Buffer.alloc(60_000_000));
        expect(bomb.length).toBeLessThan(200_000);
        net.reply = {
            statusCode: 200,
            headers: {
                'content-encoding': 'gzip',
                'content-type': 'text/html',
            },
            // Feed the compressed bytes in small slices so the source can be cut off part-way.
            chunks: Array.from(
                { length: Math.ceil(bomb.length / BOMB_SLICE) },
                (_, i) => bomb.subarray(i * BOMB_SLICE, (i + 1) * BOMB_SLICE)
            ),
        };
        const response = await pinnedGet(new URL('https://example.com/bomb'), {
            signal: live(),
        });
        const reader = response.body?.getReader();
        const read = async (total: number): Promise<number> => {
            const chunk = await reader?.read();
            if (chunk === undefined || chunk.done) return total;
            const next = total + chunk.value.byteLength;
            return next > 1_500_000 ? next : read(next);
        };
        const total = await read(0);
        await reader?.cancel();
        expect(total).toBeGreaterThan(1_500_000);
        // One decompressed chunk of slack past the cap, not the whole 60 MB.
        expect(total).toBeLessThan(1_500_000 + 1_048_576);
        // Cancelling the body stops the decompressor itself (not just the reader) and closes the socket.
        // The compressed bomb is tiny, so the input is buffered ahead whatever the consumer does (the
        // pulled-slice count cannot tell the two apart); the destroyed decoder is what proves no further
        // expansion happens.
        expect(net.decoders.at(0)?.destroyed).toBe(true);
        expect(net.lastRes?.destroyed).toBe(true);
    });

    it('returns redirects unfollowed, with their Location', async () => {
        net.reply = {
            statusCode: 302,
            headers: { location: '/next' },
            chunks: [],
        };
        const response = await pinnedGet(new URL('https://example.com/r'), {
            signal: live(),
        });
        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('/next');
    });

    it('gives a bodiless status no body', async () => {
        net.reply = { statusCode: 304, headers: {}, chunks: [] };
        const response = await pinnedGet(new URL('https://example.com/n'), {
            signal: live(),
        });
        expect(response.status).toBe(304);
        expect(response.body).toBeNull();
    });

    it('rejects with the socket error', async () => {
        net.error = new Error('ECONNRESET');
        await expect(
            pinnedGet(new URL('https://example.com/e'), { signal: live() })
        ).rejects.toThrow('ECONNRESET');
    });

    it('rejects and destroys the request when the status is outside 200-599', async () => {
        net.reply = { statusCode: 700, headers: {}, chunks: one('x') };
        await expect(
            pinnedGet(new URL('https://example.com/w'), { signal: live() })
        ).rejects.toBeInstanceOf(RangeError);
        expect(net.requestDestroy).toHaveBeenCalled();
        expect(net.lastRes?.destroyed).toBe(true);
    });

    it('rejects and destroys the request when a header value is invalid', async () => {
        net.reply = {
            statusCode: 200,
            headers: { 'x-bad': 'line\nbreak' },
            chunks: one('x'),
        };
        await expect(
            pinnedGet(new URL('https://example.com/h'), { signal: live() })
        ).rejects.toBeInstanceOf(TypeError);
        expect(net.requestDestroy).toHaveBeenCalled();
        expect(net.lastRes?.destroyed).toBe(true);
    });
});

describe('pinnedGet abort during the body', () => {
    it('surfaces the signal reason (not ECONNRESET), destroys the socket and removes its listener', async () => {
        net.error = null;
        net.reply = {
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            // The source never ends: only the abort can stop this read.
            chunks: [],
            hang: true,
        };
        const controller = new AbortController();
        const baseline = getEventListeners(controller.signal, 'abort').length;
        const response = await pinnedGet(new URL('https://example.com/slow'), {
            signal: controller.signal,
        });
        const pending = response.text();
        const reason = new DOMException('timed out', 'TimeoutError');
        expect(getEventListeners(controller.signal, 'abort').length).toBe(
            baseline + 1
        );
        controller.abort(reason);
        await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        expect(net.lastRes?.destroyed).toBe(true);
        expect(getEventListeners(controller.signal, 'abort').length).toBe(
            baseline
        );
    });

    it('removes its abort listener when the body finishes normally', async () => {
        net.reply = {
            statusCode: 200,
            headers: {},
            chunks: one('done'),
        };
        const controller = new AbortController();
        const baseline = getEventListeners(controller.signal, 'abort').length;
        const response = await pinnedGet(new URL('https://example.com/ok'), {
            signal: controller.signal,
        });
        await response.text();
        await new Promise(resolve => setImmediate(resolve));
        expect(getEventListeners(controller.signal, 'abort').length).toBe(
            baseline
        );
    });
});
