import 'server-only';
import { lookup as resolveAll } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import type { LookupAddress } from 'node:dns';
import { pipeline, Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { isBlockedAddress } from '@/shared/api/web/ipGuard';

/**
 * 연결 시점에 주소를 고정하는 GET (DNS 리바인딩 방어).
 *
 * `fetch`는 URL을 검증한 뒤 연결하면서 DNS를 한 번 더 조회하므로, 그 사이 응답이 사설 주소로 바뀌면(리바인딩)
 * 사전 검증이 무력해진다. 여기서는 소켓이 연결할 주소를 정하는 `lookup`을 직접 쥔다: 해석된 **모든** 주소를
 * {@link isBlockedAddress}로 다시 검사하고, 하나라도 막힌 주소면 연결하지 않는다. 연결은 검사를 통과한 해석 결과
 * 안에서만 일어나므로 검증과 연결 사이에 창이 없다.
 *
 * undici `Agent`의 `connect.lookup`으로도 같은 일을 할 수 있지만 undici는 이 레포의 직접 의존성이 아니다(전이
 * 의존성으로만 있고 버전이 둘이다). 의존성을 더하지 않으려고 Node 내장 `http`/`https`의 `lookup` 옵션을 쓴다.
 * 응답은 `fetch`와 같은 `Response`로 감싸 호출부가 달라지지 않게 한다(gzip·deflate·br은 풀어서 준다).
 */
export class BlockedAddressError extends Error {
    constructor() {
        super('blocked address');
        this.name = 'BlockedAddressError';
    }
}

/** 해석 결과 전부가 공인 주소일 때만 돌려준다. 비어 있거나 하나라도 막혔으면 던진다. */
export async function resolveCheckedAddresses(
    hostname: string
): Promise<LookupAddress[]> {
    const records = await resolveAll(hostname, { all: true });
    if (records.length === 0 || records.some(r => isBlockedAddress(r.address)))
        throw new BlockedAddressError();
    return records;
}

type LookupCallback = (
    error: Error | null,
    address: string | LookupAddress[],
    family?: number
) => void;

/** `http.request`의 `lookup` 옵션. 단일 주소·`all` 형태 호출을 모두 받는다. */
export function pinnedLookup(
    hostname: string,
    options: { all?: boolean } | number | undefined,
    callback: LookupCallback
): void {
    const wantsAll = typeof options === 'object' && options?.all === true;
    resolveCheckedAddresses(hostname).then(
        records =>
            wantsAll
                ? callback(null, records)
                : callback(null, records[0].address, records[0].family),
        (error: unknown) =>
            callback(
                error instanceof Error ? error : new BlockedAddressError(),
                ''
            )
    );
}

const NO_BODY_STATUSES: ReadonlySet<number> = new Set([204, 205, 304]);

/** 지원하지 않는 `Content-Encoding` 토큰. 호출부에서는 일반 실패(`error`)로 분류된다. */
export class UnsupportedEncodingError extends Error {
    constructor() {
        super('unsupported content-encoding');
        this.name = 'UnsupportedEncodingError';
    }
}

type Decoder = ReturnType<typeof createGunzip>;

function decoderFor(token: string): Decoder | null {
    if (token === 'gzip' || token === 'x-gzip') return createGunzip();
    if (token === 'deflate') return createInflate();
    if (token === 'br') return createBrotliDecompress();
    return null;
}

/**
 * `Content-Encoding`(쉼표로 쌓인 토큰은 적용된 순서이므로 **역순**으로 푼다)에 맞는 해제기 목록.
 * `identity`는 건너뛴다. 모르는 토큰이 하나라도 있으면 null — 해석할 수 없는 본문을 그대로 넘기지 않고 호출부가
 * 실패로 다루게 한다.
 */
function decodersFor(header: string | undefined): Decoder[] | null {
    const tokens = (header ?? '')
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t !== '' && t !== 'identity');
    const decoders = tokens.map(decoderFor);
    return decoders.some(d => d === null)
        ? null
        : (decoders as Decoder[]).reverse();
}

export interface PinnedGetInit {
    headers?: Record<string, string>;
    /** 필수: 연결·본문 읽기 전체의 시간 상한과 중단을 이 신호가 쥔다. 상한 없는 소켓을 만들지 않는다. */
    signal: AbortSignal;
}

/** 검증된 주소로만 연결하는 GET. 리다이렉트는 따라가지 않고 응답 그대로 돌려준다. */
export function pinnedGet(url: URL, init: PinnedGetInit): Promise<Response> {
    const transport = url.protocol === 'https:' ? https : http;
    const { signal } = init;
    return new Promise<Response>((resolve, reject) => {
        const request = transport.request(
            url,
            {
                method: 'GET',
                headers: {
                    'Accept-Encoding': 'gzip, deflate, br',
                    ...init.headers,
                },
                lookup: pinnedLookup,
                signal,
            },
            res => {
                try {
                    resolve(toResponse(res, signal));
                } catch (error) {
                    // `Response`가 상태 코드를 거부하거나(200–599 밖) 헤더 값이 거부되면 소켓을 남기지 않는다.
                    res.destroy();
                    request.destroy();
                    reject(error);
                }
            }
        );
        request.on('error', reject);
        request.end();
    });
}

function toResponse(res: http.IncomingMessage, signal: AbortSignal): Response {
    const status = res.statusCode ?? 0;
    const headers = new Headers();
    Object.entries(res.headers).forEach(([name, value]) => {
        if (value === undefined) return;
        [value].flat().forEach(v => headers.append(name, v));
    });
    const decoders = decodersFor(res.headers['content-encoding']);
    if (decoders === null) throw new UnsupportedEncodingError();
    if (decoders.length > 0) {
        // 풀린 본문의 길이·인코딩은 헤더와 어긋난다.
        headers.delete('content-encoding');
        headers.delete('content-length');
    }
    if (NO_BODY_STATUSES.has(status)) {
        res.resume();
        return new Response(null, { status, headers });
    }
    // 해제기를 `res` 뒤에 이어 붙이고(오류는 `pipeline`이 앞뒤로 전파한다) 마지막 해제기를 본문으로 읽는다.
    if (decoders.length > 0) pipeline([res, ...decoders], () => undefined);
    const source: Readable = decoders.at(-1) ?? res;
    // 본문을 읽는 도중 신호가 끊기면 소켓이 ECONNRESET으로 끊겼다는 오류 대신 신호의 사유(AbortError·TimeoutError)를
    // 읽는 쪽에 전한다 — 호출부가 시간 초과를 일반 실패와 구분할 수 있다. 소켓과 해제 스트림을 함께 닫는다.
    const onAbort = (): void => {
        res.destroy(signal.reason as Error);
        source.destroy(signal.reason as Error);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    source.once('close', () => signal.removeEventListener('abort', onAbort));
    return new Response(Readable.toWeb(source) as ReadableStream<Uint8Array>, {
        status,
        headers,
    });
}
