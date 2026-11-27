import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isBlockedAddress } from '@/shared/api/web/ipGuard';
import { BlockedAddressError, pinnedGet } from '@/shared/api/web/pinnedRequest';

/**
 * 사용자·검색 결과가 가리키는 임의 URL을 서버가 대신 받아 올 때 쓰는 SSRF 방어 GET.
 *
 * ## 막는 것
 *
 * - `http`/`https` 외 스킴, 기본 포트가 아닌 포트, URL 안의 자격 증명(`user:pass@`).
 * - 호스트가 가리키는 **모든** 주소(`lookup(..., { all: true })`)가 공인 주소여야 한다. 하나라도 루프백·사설·
 *   링크로컬·CGNAT·ULA·미지정·멀티캐스트(IPv4-mapped·NAT64·6to4로 감싼 형태 포함)면 거부한다. IP 리터럴 호스트도
 *   같은 검사를 거친다(`http://2130706433/` 같은 숫자 표기는 URL 파서가 점 표기로 정규화한 뒤 검사한다).
 * - 리다이렉트는 직접 따라가며 매 홉을 다시 검증한다(최대 {@link MAX_REDIRECTS}홉).
 * - **DNS 리바인딩**: 여기서 하는 사전 검증은 빠른 거절일 뿐이고, 실제 연결은 `pinnedGet`이 연결 시점의 `lookup`에서
 *   모든 주소를 다시 검사해 통과한 주소로만 맺는다. 검증과 연결 사이에 DNS 응답이 바뀌어도 막힌 주소로는 연결되지 않는다.
 */
export const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([
    301, 302, 303, 307, 308,
]);
/** 이름만으로 사설망임이 분명한 호스트 — DNS를 부르기 전에 거른다. */
const LOCAL_HOST_SUFFIXES: readonly string[] = [
    '.localhost',
    '.local',
    '.internal',
    '.localdomain',
    '.home.arpa',
];

export type SafeFetchErrorCode = 'blocked' | 'redirects';

export class SafeFetchError extends Error {
    readonly code: SafeFetchErrorCode;
    constructor(code: SafeFetchErrorCode) {
        super(code);
        this.name = 'SafeFetchError';
        this.code = code;
    }
}

function parseUrl(raw: string, base?: URL): URL | null {
    try {
        return new URL(raw, base);
    } catch {
        return null;
    }
}

/**
 * 가져와도 되는 URL이면 파싱한 `URL`을, 아니면 null. 호스트 이름은 DNS 해석 결과 전부가 공인 주소여야 한다.
 */
export async function resolvePublicUrl(raw: string): Promise<URL | null> {
    const url = parseUrl(raw);
    if (url === null) return null;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // 기본 포트는 URL 파서가 빈 문자열로 정규화한다 — 비어 있지 않으면 명시된 비기본 포트다.
    if (url.port !== '') return null;
    if (url.username !== '' || url.password !== '') return null;
    // 끝의 점(`localhost.`)은 같은 이름이다.
    const host = url.hostname
        .replace(/^\[|\]$/g, '')
        .replace(/\.$/, '')
        .toLowerCase();
    if (host === '') return null;
    if (isIP(host) !== 0) return isBlockedAddress(host) ? null : url;
    if (host === 'localhost' || LOCAL_HOST_SUFFIXES.some(s => host.endsWith(s)))
        return null;
    try {
        const records = await lookup(host, { all: true });
        if (records.length === 0) return null;
        return records.some(r => isBlockedAddress(r.address)) ? null : url;
    } catch {
        return null;
    }
}

export interface SafeFetchInit {
    headers?: Record<string, string>;
    /** 필수 — `pinnedGet`이 소켓 수명을 이 신호에 묶는다. */
    signal: AbortSignal;
}

async function fetchFollowing(
    raw: string,
    init: SafeFetchInit,
    redirectsLeft: number
): Promise<Response> {
    const url = await resolvePublicUrl(raw);
    if (url === null) throw new SafeFetchError('blocked');
    const response = await pinnedGet(url, {
        headers: init.headers,
        signal: init.signal,
    }).catch((error: unknown) => {
        // 연결 시점 검증이 막은 경우는 사전 검증이 막은 경우와 같은 결과다.
        throw error instanceof BlockedAddressError ||
            (error instanceof Error &&
                error.cause instanceof BlockedAddressError)
            ? new SafeFetchError('blocked')
            : error;
    });
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    // 따라가지 않는 응답의 본문은 소켓을 붙잡지 않게 바로 버린다.
    await response.body?.cancel().catch(() => undefined);
    const location = response.headers.get('location');
    if (location === null || redirectsLeft <= 0)
        throw new SafeFetchError('redirects');
    const next = parseUrl(location, url);
    if (next === null) throw new SafeFetchError('blocked');
    return fetchFollowing(next.href, init, redirectsLeft - 1);
}

/**
 * SSRF 방어를 거친 GET. 막힌 대상은 `SafeFetchError('blocked')`, 홉 초과·Location 없는 3xx는
 * `SafeFetchError('redirects')`를 던진다. 네트워크·중단 오류는 `fetch`의 것이 그대로 나온다.
 */
export function safeFetch(url: string, init: SafeFetchInit): Promise<Response> {
    return fetchFollowing(url, init, MAX_REDIRECTS);
}
