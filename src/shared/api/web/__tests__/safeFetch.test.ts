import { beforeEach, describe, expect, it, vi } from 'vitest';

const dns = vi.hoisted(() => ({
    lookup: vi.fn<
        (host: string, opts: unknown) => Promise<Array<{ address: string }>>
    >(),
}));
vi.mock('node:dns/promises', () => ({ lookup: dns.lookup }));

const transport = vi.hoisted(() => ({
    get: vi.fn<
        (url: URL, init: Record<string, unknown>) => Promise<Response>
    >(),
}));
// The transport is replaced; the connect-time address check has its own tests (pinnedRequest.test.ts).
vi.mock('@/shared/api/web/pinnedRequest', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/web/pinnedRequest')
    >()),
    pinnedGet: transport.get,
}));

import { isBlockedAddress } from '@/shared/api/web/ipGuard';
import { BlockedAddressError } from '@/shared/api/web/pinnedRequest';
import {
    resolvePublicUrl,
    safeFetch,
    SafeFetchError,
} from '@/shared/api/web/safeFetch';

const PUBLIC_V4 = '93.184.216.34';
const live = () => ({ signal: new AbortController().signal });

describe('isBlockedAddress', () => {
    it.each([
        '0.0.0.0',
        '10.1.2.3',
        '127.0.0.1',
        '127.255.255.254',
        '100.64.0.1',
        '100.127.255.255',
        '169.254.169.254',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '224.0.0.1',
        '255.255.255.255',
        '::',
        '::1',
        'fe80::1',
        'febf::1',
        'fc00::1',
        'fdff::1',
        'ff02::1',
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        '::ffff:10.0.0.1',
        '::ffff:a9fe:a9fe',
        '64:ff9b::7f00:1',
        '2002:7f00:1::1',
        '::127.0.0.1',
    ])('blocks %s', address => {
        expect(isBlockedAddress(address)).toBe(true);
    });

    it.each([
        // One step outside each blocked range.
        '11.0.0.1',
        '126.255.255.255',
        '128.0.0.1',
        '100.63.255.255',
        '100.128.0.1',
        '169.253.255.255',
        '169.255.0.1',
        '172.15.255.255',
        '172.32.0.1',
        '192.167.255.255',
        '192.169.0.1',
        '223.255.255.255',
        PUBLIC_V4,
        '2606:4700:4700::1111',
        'fb00::1',
        'fe00::1',
        '::ffff:5db8:d822',
        '64:ff9b::5db8:d822',
        '2002:5db8:d822::1',
    ])('accepts public %s', address => {
        expect(isBlockedAddress(address)).toBe(false);
    });

    it.each(['not-an-ip', '', '1.2.3', 'fe80::1%eth0', '1:2:3:4:5:6:7:8:9'])(
        'fails closed on %j',
        address => {
            expect(isBlockedAddress(address)).toBe(true);
        }
    );
});

describe('resolvePublicUrl', () => {
    beforeEach(() => {
        dns.lookup.mockReset();
        dns.lookup.mockResolvedValue([{ address: PUBLIC_V4 }]);
    });

    it('accepts a public https host and returns the parsed URL', async () => {
        const url = await resolvePublicUrl('https://news.example.com/a?b=1');
        expect(url?.href).toBe('https://news.example.com/a?b=1');
        expect(dns.lookup).toHaveBeenCalledWith('news.example.com', {
            all: true,
        });
    });

    it.each([
        'ftp://example.com/x',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'not a url',
        'https://example.com:8443/x',
        'http://example.com:8080/x',
        'https://user:pw@example.com/x',
        'https://user@example.com/x',
        'http://localhost/x',
        'http://localhost./x',
        'http://app.localhost/x',
        'http://printer.local/x',
        'http://db.internal/x',
    ])('refuses %s without a lookup', async raw => {
        expect(await resolvePublicUrl(raw)).toBeNull();
        expect(dns.lookup).not.toHaveBeenCalled();
    });

    it('refuses IP-literal hosts that are private, in every notation', async () => {
        for (const raw of [
            'http://127.0.0.1/',
            'http://10.0.0.5/x',
            'http://[::1]/',
            'http://[::ffff:127.0.0.1]/',
            'http://[fd00::1]/',
            // The URL parser normalises these to dotted form before the check.
            'http://2130706433/',
            'http://0x7f000001/',
            'http://0177.0.0.1/',
            'http://127.1/',
        ])
            expect(await resolvePublicUrl(raw)).toBeNull();
        expect(dns.lookup).not.toHaveBeenCalled();
    });

    it('accepts a public IP literal without a lookup', async () => {
        expect(
            (await resolvePublicUrl(`http://${PUBLIC_V4}/x`))?.hostname
        ).toBe(PUBLIC_V4);
        expect(
            await resolvePublicUrl('https://[2606:4700:4700::1111]/')
        ).not.toBeNull();
        expect(dns.lookup).not.toHaveBeenCalled();
    });

    it('refuses a hostname when ANY resolved address is private', async () => {
        dns.lookup.mockResolvedValue([
            { address: PUBLIC_V4 },
            { address: '10.0.0.7' },
        ]);
        expect(await resolvePublicUrl('https://mixed.example.com/')).toBeNull();
    });

    it('refuses a hostname that resolves to a mapped IPv6 loopback', async () => {
        dns.lookup.mockResolvedValue([{ address: '::ffff:127.0.0.1' }]);
        expect(
            await resolvePublicUrl('https://rebind.example.com/')
        ).toBeNull();
    });

    it('accepts a hostname whose addresses sit just outside the blocked ranges', async () => {
        dns.lookup.mockResolvedValue([
            { address: '172.32.0.1' },
            { address: '100.128.0.1' },
        ]);
        expect(
            await resolvePublicUrl('https://near-miss.example.com/')
        ).not.toBeNull();
    });

    it('refuses when DNS fails or returns nothing', async () => {
        dns.lookup.mockRejectedValueOnce(new Error('ENOTFOUND'));
        expect(await resolvePublicUrl('https://gone.example.com/')).toBeNull();
        dns.lookup.mockResolvedValueOnce([]);
        expect(await resolvePublicUrl('https://empty.example.com/')).toBeNull();
    });
});

describe('safeFetch', () => {
    const fetchMock = transport.get;
    const urlOf = (call: unknown[]): string => String(call[0]);

    beforeEach(() => {
        dns.lookup.mockReset();
        dns.lookup.mockResolvedValue([{ address: PUBLIC_V4 }]);
        fetchMock.mockReset();
        // Reject by default: a request nobody routed must never reach the network.
        fetchMock.mockRejectedValue(new Error('unrouted request'));
    });

    it('sends a manual-redirect GET with the given headers and returns the response', async () => {
        fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
        const response = await safeFetch('https://example.com/a', {
            headers: { 'User-Agent': 'x' },
            signal: new AbortController().signal,
        });
        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(
            fetchMock.mock.calls.find(
                c => urlOf(c) === 'https://example.com/a'
            )?.[1]
        ).toMatchObject({
            headers: { 'User-Agent': 'x' },
        });
    });

    it('throws blocked for a private target and never calls fetch', async () => {
        await expect(
            safeFetch('http://127.0.0.1/admin', live())
        ).rejects.toMatchObject({
            name: 'SafeFetchError',
            code: 'blocked',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('re-validates every hop: a redirect to a private address is refused', async () => {
        fetchMock.mockImplementation(async url =>
            String(url) === 'https://example.com/start'
                ? new Response(null, {
                      status: 302,
                      headers: { location: 'http://169.254.169.254/latest' },
                  })
                : new Response('secret', { status: 200 })
        );
        await expect(
            safeFetch('https://example.com/start', live())
        ).rejects.toBeInstanceOf(SafeFetchError);
        expect(
            fetchMock.mock.calls.filter(c => urlOf(c).includes('169.254'))
        ).toHaveLength(0);
    });

    it('re-validates a redirect to a hostname that resolves privately', async () => {
        dns.lookup.mockImplementation(async host => [
            { address: host === 'evil.example.net' ? '10.9.9.9' : PUBLIC_V4 },
        ]);
        fetchMock.mockImplementation(async url =>
            String(url) === 'https://example.com/start'
                ? new Response(null, {
                      status: 301,
                      headers: { location: 'https://evil.example.net/x' },
                  })
                : new Response('secret', { status: 200 })
        );
        await expect(
            safeFetch('https://example.com/start', live())
        ).rejects.toMatchObject({
            code: 'blocked',
        });
    });

    it('follows a relative redirect to a public host', async () => {
        fetchMock.mockImplementation(async url =>
            String(url) === 'https://example.com/old'
                ? new Response(null, {
                      status: 301,
                      headers: { location: '/new' },
                  })
                : new Response('final', { status: 200 })
        );
        const response = await safeFetch('https://example.com/old', live());
        expect(await response.text()).toBe('final');
        expect(
            fetchMock.mock.calls.some(
                c => urlOf(c) === 'https://example.com/new'
            )
        ).toBe(true);
    });

    it('stops after 3 redirects', async () => {
        fetchMock.mockImplementation(
            async () =>
                new Response(null, {
                    status: 302,
                    headers: { location: 'https://example.com/loop' },
                })
        );
        await expect(
            safeFetch('https://example.com/loop', live())
        ).rejects.toMatchObject({
            code: 'redirects',
        });
        // The first request plus 3 followed hops.
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('treats a 3xx without Location as a redirect failure', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 302 }));
        await expect(
            safeFetch('https://example.com/x', live())
        ).rejects.toMatchObject({
            code: 'redirects',
        });
    });

    it('reports blocked when the connect-time address check refuses (DNS changed after validation)', async () => {
        fetchMock.mockRejectedValue(new BlockedAddressError());
        await expect(
            safeFetch('https://example.com/x', live())
        ).rejects.toMatchObject({
            code: 'blocked',
        });
        fetchMock.mockRejectedValue(
            new Error('socket', { cause: new BlockedAddressError() })
        );
        await expect(
            safeFetch('https://example.com/x', live())
        ).rejects.toMatchObject({
            code: 'blocked',
        });
    });

    it('lets a network error propagate as itself', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));
        await expect(
            safeFetch('https://example.com/x', live())
        ).rejects.toBeInstanceOf(TypeError);
    });
});
