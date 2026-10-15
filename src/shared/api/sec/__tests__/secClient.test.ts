import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetSecThrottleForTests,
    dailyFormIndexUrl,
    fetchDailyFormIndex,
    fetchFilingDocumentStream,
    fetchFilingDocumentText,
    fetchFilingIndexJson,
    fetchSubmissionsJson,
    submissionsFileName,
    filingFolderUrl,
    SecBodyTimeoutError,
    SecHttpError,
    SecSlotTimeoutError,
    streamWithLimits,
} from '../secClient';
import {
    SEC_HEADER_TIMEOUT_MS,
    SEC_MAX_INFO_TABLE_BYTES,
} from '@/shared/config/investorFlows';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
}));

/** Deny-by-default fetch: any URL not handled by the test throws instead of reaching the network. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

const ACCESS_DENIED =
    '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>';

function respond(
    status: number,
    body: string | object = '',
    headers: Record<string, string> = {}
): Response {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(status === 204 ? null : text, { status, headers });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    __resetSecThrottleForTests();
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('SEC_USER_AGENT', undefined);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('URLs', () => {
    it('builds the quarter-specific daily index URL', () => {
        expect(dailyFormIndexUrl('2026-10-14')).toBe(
            'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR4/form.20261014.idx'
        );
        expect(dailyFormIndexUrl('2026-03-31')).toContain(
            '/2026/QTR1/form.20260331.idx'
        );
        expect(dailyFormIndexUrl('2026-06-30')).toContain('/QTR2/');
    });

    it('builds the filing folder URL without leading zeros or dashes', () => {
        expect(filingFolderUrl('0002148692', '0002085853-26-001185')).toBe(
            'https://www.sec.gov/Archives/edgar/data/2148692/000208585326001185'
        );
    });
});

describe('request identity', () => {
    it('sends the contact User-Agent SEC requires', async () => {
        fetchSpy.mockResolvedValueOnce(respond(200, 'idx'));
        const run = fetchDailyFormIndex('2026-10-14');
        await vi.runAllTimersAsync();
        await run;
        const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        expect((init.headers as Record<string, string>)['User-Agent']).toBe(
            'SigLens dev.y0ngha@gmail.com'
        );
    });

    it('lets SEC_USER_AGENT override the default', async () => {
        vi.stubEnv('SEC_USER_AGENT', 'Other contact@example.com');
        fetchSpy.mockResolvedValueOnce(respond(200, 'idx'));
        const run = fetchDailyFormIndex('2026-10-14');
        await vi.runAllTimersAsync();
        await run;
        const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        expect((init.headers as Record<string, string>)['User-Agent']).toBe(
            'Other contact@example.com'
        );
    });
});

describe('rate gate', () => {
    it('spaces concurrent requests at least 220ms apart regardless of how many callers wait', async () => {
        const startedAt: number[] = [];
        fetchSpy.mockImplementation(async () => {
            startedAt.push(Date.now());
            return respond(200, '{}');
        });
        const runs = Array.from({ length: 5 }, () =>
            fetchFilingIndexJson('1', '0000000001-26-000001')
        );
        await vi.runAllTimersAsync();
        await Promise.all(runs);
        expect(startedAt).toHaveLength(5);
        const gaps = startedAt
            .slice(1)
            .map((t, i) => t - (startedAt[i] as number));
        expect(gaps.every(gap => gap >= 220)).toBe(true);
        // 5 requests ⇒ ≥ 4 gaps of 220ms ⇒ at most ~4.5 requests per second
        expect(
            (startedAt.at(-1) as number) - (startedAt[0] as number)
        ).toBeGreaterThanOrEqual(880);
    });
});

describe('missing documents', () => {
    it('returns null for 404', async () => {
        fetchSpy.mockResolvedValueOnce(respond(404, 'nope'));
        const run = fetchFilingIndexJson('1', '0000000001-26-000001');
        await vi.runAllTimersAsync();
        expect(await run).toBeNull();
    });

    it('returns null for the S3 AccessDenied 403 (a daily index that does not exist yet)', async () => {
        fetchSpy.mockResolvedValueOnce(respond(403, ACCESS_DENIED));
        const run = fetchDailyFormIndex('2026-10-16');
        await vi.runAllTimersAsync();
        expect(await run).toBeNull();
    });

    it('throws SecHttpError for any other 403 (a block must not look like a missing day)', async () => {
        fetchSpy.mockResolvedValueOnce(
            respond(403, '<html>Request Rate Threshold Exceeded</html>')
        );
        const run = fetchDailyFormIndex('2026-10-14');
        const assertion = expect(run).rejects.toMatchObject({
            name: 'SecHttpError',
            status: 403,
        });
        await vi.runAllTimersAsync();
        await assertion;
        expect(fetchSpy).toHaveBeenCalledTimes(1); // 403 is not retried
    });
});

describe('retries (5xx / network only; 429 is a block)', () => {
    it('does NOT retry a 429: it is a blocking signal and surfaces immediately', async () => {
        fetchSpy.mockResolvedValue(respond(429, '', { 'retry-after': '1' }));
        const run = fetchFilingDocumentText(
            '1',
            '0000000001-26-000001',
            'primary_doc.xml'
        );
        const assertion = expect(run).rejects.toMatchObject({
            name: 'SecHttpError',
            status: 429,
        });
        await vi.runAllTimersAsync();
        await assertion;
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('retries a 503 once and then succeeds', async () => {
        fetchSpy
            .mockResolvedValueOnce(respond(503, 'busy'))
            .mockResolvedValueOnce(respond(200, 'ok'));
        const run = fetchFilingDocumentText(
            '1',
            '0000000001-26-000001',
            'primary_doc.xml'
        );
        await vi.runAllTimersAsync();
        expect(await run).toBe('ok');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('caps Retry-After at 10 seconds', async () => {
        fetchSpy
            .mockResolvedValueOnce(
                respond(503, 'busy', { 'retry-after': '600' })
            )
            .mockResolvedValueOnce(respond(200, 'ok'));
        const run = fetchFilingDocumentText(
            '1',
            '0000000001-26-000001',
            'primary_doc.xml'
        );
        await vi.advanceTimersByTimeAsync(9_900);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(300);
        expect(await run).toBe('ok');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('gives up after one retry and surfaces the status', async () => {
        fetchSpy.mockImplementation(async () => respond(503, 'busy'));
        const run = fetchFilingDocumentText(
            '1',
            '0000000001-26-000001',
            'primary_doc.xml'
        );
        const assertion = expect(run).rejects.toBeInstanceOf(SecHttpError);
        await vi.runAllTimersAsync();
        await assertion;
        expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 + SEC_MAX_RETRIES
    });

    it('does not retry a 400', async () => {
        fetchSpy.mockResolvedValueOnce(respond(400, 'bad'));
        const run = fetchFilingDocumentText(
            '1',
            '0000000001-26-000001',
            'x.xml'
        );
        const assertion = expect(run).rejects.toMatchObject({ status: 400 });
        await vi.runAllTimersAsync();
        await assertion;
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});

describe('streaming documents', () => {
    it('yields the body chunks without buffering', async () => {
        fetchSpy.mockResolvedValueOnce(respond(200, '<informationTable/>'));
        const run = fetchFilingDocumentStream(
            '1',
            '0000000001-26-000001',
            'infotable.xml'
        );
        await vi.runAllTimersAsync();
        const stream = await run;
        let text = '';
        for await (const chunk of stream as AsyncIterable<Uint8Array>)
            text += new TextDecoder().decode(chunk);
        expect(text).toBe('<informationTable/>');
    });

    it('returns null when the document is missing', async () => {
        fetchSpy.mockResolvedValueOnce(respond(404));
        const run = fetchFilingDocumentStream(
            '1',
            '0000000001-26-000001',
            'infotable.xml'
        );
        await vi.runAllTimersAsync();
        expect(await run).toBeNull();
    });

    it('requests the encoded file name inside the filing folder', async () => {
        fetchSpy.mockResolvedValueOnce(respond(200, 'x'));
        const run = fetchFilingDocumentText(
            '0002148692',
            '0002085853-26-001185',
            'a b.xml'
        );
        await vi.runAllTimersAsync();
        await run;
        expect(fetchSpy.mock.calls[0]?.[0]).toBe(
            'https://www.sec.gov/Archives/edgar/data/2148692/000208585326001185/a%20b.xml'
        );
    });
});

describe('submissions', () => {
    it('pads the CIK to ten digits', () => {
        expect(submissionsFileName('320193')).toBe('CIK0000320193.json');
        expect(submissionsFileName('0000320193')).toBe('CIK0000320193.json');
    });

    it('requests data.sec.gov with the SEC User-Agent through the shared gate', async () => {
        fetchSpy.mockResolvedValueOnce(respond(200, { cik: '320193' }));
        const run = fetchSubmissionsJson('CIK0000320193.json');
        await vi.runAllTimersAsync();
        expect(await run).toEqual({ cik: '320193' });
        expect(fetchSpy.mock.calls[0]?.[0]).toBe(
            'https://data.sec.gov/submissions/CIK0000320193.json'
        );
        const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        expect((init.headers as Record<string, string>)['User-Agent']).toBe(
            'SigLens dev.y0ngha@gmail.com'
        );
    });

    it('does not retry (a render path degrades instead of waiting)', async () => {
        fetchSpy.mockImplementation(async () => respond(503, 'busy'));
        const run = fetchSubmissionsJson('CIK0000320193.json');
        const assertion = expect(run).rejects.toBeInstanceOf(SecHttpError);
        await vi.runAllTimersAsync();
        await assertion;
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns null when the company has no submissions file', async () => {
        fetchSpy.mockResolvedValueOnce(respond(404));
        const run = fetchSubmissionsJson('CIK0000000001.json');
        await vi.runAllTimersAsync();
        expect(await run).toBeNull();
    });
});

/** A stream that emits `chunks` chunks of `size` bytes, one every `everyMs` (fake-timer driven). */
function slowStream(
    chunks: number,
    everyMs: number,
    size = 10
): ReadableStream<Uint8Array> {
    let sent = 0;
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            return new Promise<void>(resolve => {
                setTimeout(() => {
                    try {
                        if (sent >= chunks) controller.close();
                        else {
                            controller.enqueue(new Uint8Array(size));
                            sent += 1;
                        }
                    } catch {
                        // the consumer already cancelled/closed the stream (a timeout test) — nothing to deliver
                    }
                    resolve();
                }, everyMs);
            });
        },
    });
}

async function drain(source: AsyncIterable<Uint8Array>): Promise<number> {
    let total = 0;
    for await (const chunk of source) total += chunk.byteLength;
    return total;
}

const LIMITS = { maxBytes: 1_000_000, idleMs: 30_000, totalMs: 600_000 };

describe('streamWithLimits (information table bodies)', () => {
    it('lets a slow but PROGRESSING body finish even though it takes far longer than any single timeout', async () => {
        // 20 chunks, one every 20s = 400s total; idle limit is 30s, so every gap is fine
        const run = drain(streamWithLimits(slowStream(20, 20_000), LIMITS));
        await vi.advanceTimersByTimeAsync(430_000);
        expect(await run).toBe(200);
    });

    it('fails a STALLED body after the idle timeout and aborts the underlying request', async () => {
        const onAbort = vi.fn();
        const stalled = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(5));
            }, // then silence
        });
        const run = drain(streamWithLimits(stalled, { ...LIMITS, onAbort }));
        const assertion = expect(run).rejects.toMatchObject({
            name: 'SecBodyTimeoutError',
            kind: 'idle',
        });
        await vi.advanceTimersByTimeAsync(31_000);
        await assertion;
        expect(onAbort).toHaveBeenCalledTimes(1);
    });

    it('enforces the overall body budget even when bytes keep arriving', async () => {
        const run = drain(
            streamWithLimits(slowStream(1_000, 10_000), {
                ...LIMITS,
                totalMs: 55_000,
            })
        );
        const assertion = expect(run).rejects.toMatchObject({ kind: 'budget' });
        await vi.advanceTimersByTimeAsync(70_000);
        await assertion;
    });

    it('refuses to read past the byte cap', async () => {
        const run = drain(
            streamWithLimits(slowStream(10, 1, 100), {
                ...LIMITS,
                maxBytes: 450,
            })
        );
        const assertion = expect(run).rejects.toThrow('exceeds 450 bytes');
        await vi.advanceTimersByTimeAsync(100);
        await assertion;
    });

    it('lets a body of exactly the cap through', async () => {
        const run = drain(
            streamWithLimits(slowStream(4, 1, 100), {
                ...LIMITS,
                maxBytes: 400,
            })
        );
        await vi.advanceTimersByTimeAsync(100);
        expect(await run).toBe(400);
    });

    it('the production cap for an information table is 200 MB', () => {
        expect(SEC_MAX_INFO_TABLE_BYTES).toBe(200 * 1024 * 1024);
    });

    it('reports the timeout kind through SecBodyTimeoutError', () => {
        expect(new SecBodyTimeoutError('idle').kind).toBe('idle');
    });
});

describe('fetchFilingDocumentStream timeouts', () => {
    it('applies the timeout to the HEADERS only: a body that takes minutes still completes', async () => {
        // headers arrive after 10s (< 20s header timeout); the body then trickles for ~3.3 minutes (> the old 30s whole-request
        // timeout, < the 4-minute body budget), a chunk every 20s (< the 30s idle limit)
        fetchSpy.mockImplementation(
            () =>
                new Promise<Response>(resolve =>
                    setTimeout(
                        () =>
                            resolve(
                                new Response(slowStream(10, 20_000), {
                                    status: 200,
                                })
                            ),
                        10_000
                    )
                )
        );
        const run = fetchFilingDocumentStream(
            '1',
            '0000000001-26-000001',
            'infotable.xml'
        ).then(stream => drain(stream as AsyncIterable<Uint8Array>));
        await vi.advanceTimersByTimeAsync(230_000);
        expect(await run).toBe(100);
    });

    it('does not abort the response after the headers arrived (the signal passed to fetch is not a whole-request timeout)', async () => {
        let signal: AbortSignal | undefined;
        fetchSpy.mockImplementation(async (_url, init) => {
            signal = (init as RequestInit).signal as AbortSignal;
            return new Response(slowStream(2, 25_000), { status: 200 });
        });
        const run = fetchFilingDocumentStream(
            '1',
            '0000000001-26-000001',
            'infotable.xml'
        ).then(stream => drain(stream as AsyncIterable<Uint8Array>));
        await vi.advanceTimersByTimeAsync(80_000);
        await run;
        expect(signal?.aborted).toBe(false);
    });

    it('aborts when the HEADERS never arrive within the header timeout, retrying once', async () => {
        fetchSpy.mockImplementation(
            (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    (init as RequestInit).signal?.addEventListener(
                        'abort',
                        () => reject(new DOMException('aborted', 'AbortError'))
                    );
                })
        );
        const run = fetchFilingDocumentStream(
            '1',
            '0000000001-26-000001',
            'infotable.xml'
        );
        const assertion = expect(run).rejects.toBeInstanceOf(DOMException);
        await vi.advanceTimersByTimeAsync(SEC_HEADER_TIMEOUT_MS * 2 + 15_000);
        await assertion;
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});

describe('render-path submissions lookup budget', () => {
    it('fails fast (no request) when the throttle queue alone would exceed the budget', async () => {
        fetchSpy.mockImplementation(async () => respond(200, '{}'));
        // queue ~60 requests ahead => the next slot is ~13s away, beyond the 8s budget
        for (let i = 0; i < 60; i++)
            void fetchFilingIndexJson('1', '0000000001-26-000001');
        await vi.advanceTimersByTimeAsync(0);
        fetchSpy.mockClear();
        await expect(
            fetchSubmissionsJson('CIK0000320193.json')
        ).rejects.toBeInstanceOf(SecSlotTimeoutError);
        expect(
            fetchSpy.mock.calls.filter(call =>
                String(call[0]).includes('data.sec.gov')
            )
        ).toEqual([]);
        await vi.runAllTimersAsync();
    });

    it('bounds the whole lookup, including a body that never arrives', async () => {
        fetchSpy.mockImplementation(async (_url, init) => {
            const signal = (init as RequestInit).signal as AbortSignal;
            return new Response(
                new ReadableStream<Uint8Array>({
                    start(controller) {
                        signal.addEventListener('abort', () =>
                            controller.error(
                                new DOMException('aborted', 'AbortError')
                            )
                        );
                    },
                }),
                { status: 200 }
            );
        });
        const run = fetchSubmissionsJson('CIK0000320193.json');
        const assertion = expect(run).rejects.toBeInstanceOf(DOMException);
        await vi.advanceTimersByTimeAsync(9_000);
        await assertion;
    });
});
