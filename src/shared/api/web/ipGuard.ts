import { isIP } from 'node:net';

/**
 * 주소 분류 — 순수 함수. 공인 주소가 아니면(루프백·사설·링크로컬·CGNAT·ULA·미지정·멀티캐스트, IPv4-mapped·NAT64·6to4로
 * 감싼 형태 포함) 막는다. `safeFetch`(URL 사전 검증)와 `pinnedRequest`(연결 시점 검증)가 같은 판정을 쓴다.
 */
function parseIPv4(ip: string): number[] | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    const octets = parts.map(part =>
        /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN
    );
    return octets.every(o => o >= 0 && o <= 255) ? octets : null;
}

function isBlockedIPv4(o: readonly number[]): boolean {
    const [a, b, c] = o;
    return (
        a === 0 || // 0.0.0.0/8 (미지정·"이 네트워크")
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0 && c === 0) || // IETF 프로토콜 할당
        (a === 198 && (b === 18 || b === 19)) || // 벤치마크
        a >= 224 // 멀티캐스트 224/4, 예약 240/4(브로드캐스트 포함)
    );
}

/** `a:b:c:d:e:f:g:h`(압축·끝의 점 표기 IPv4 허용)를 16비트 8개로. 해석 못 하면 null. */
function parseIPv6(ip: string): number[] | null {
    if (ip.includes('%')) return null; // 스코프 ID가 붙은 주소는 로컬 인터페이스용이다
    const halves = ip.split('::');
    if (halves.length > 2) return null;
    const toGroups = (part: string): number[] | null => {
        if (part === '') return [];
        const raw = part.split(':');
        const last = raw.at(-1) ?? '';
        const tail = last.includes('.') ? parseIPv4(last) : null;
        if (last.includes('.') && tail === null) return null;
        const head = tail === null ? raw : raw.slice(0, -1);
        const groups = head.map(h =>
            /^[0-9a-fA-F]{1,4}$/.test(h) ? Number.parseInt(h, 16) : Number.NaN
        );
        if (groups.some(Number.isNaN)) return null;
        return tail === null
            ? groups
            : [...groups, tail[0] * 256 + tail[1], tail[2] * 256 + tail[3]];
    };
    const head = toGroups(halves[0]);
    const tail = halves.length === 2 ? toGroups(halves[1]) : [];
    if (head === null || tail === null) return null;
    if (halves.length === 1) return head.length === 8 ? head : null;
    const zeros = 8 - head.length - tail.length;
    if (zeros < 1) return null;
    return [...head, ...Array.from({ length: zeros }, () => 0), ...tail];
}

function embeddedIPv4(high: number, low: number): number[] {
    return [high >> 8, high & 255, low >> 8, low & 255];
}

function isBlockedIPv6(g: readonly number[]): boolean {
    const leadingZeros = g.slice(0, 5).every(x => x === 0);
    // ::, ::1, ::a.b.c.d (IPv4-compatible) 와 ::ffff:a.b.c.d (IPv4-mapped): 안의 IPv4로 판정한다.
    if (leadingZeros && (g[5] === 0 || g[5] === 0xffff))
        return isBlockedIPv4(embeddedIPv4(g[6], g[7]));
    // NAT64 64:ff9b::/96 — 안의 IPv4로 판정. 로컬용 64:ff9b:1::/48은 통째로 막는다.
    if (g[0] === 0x64 && g[1] === 0xff9b) {
        if (g.slice(2, 6).every(x => x === 0))
            return isBlockedIPv4(embeddedIPv4(g[6], g[7]));
        if (g[2] === 1) return true;
    }
    // 6to4 2002::/16 — 두 번째·세 번째 그룹이 IPv4다.
    if (g[0] === 0x2002) return isBlockedIPv4(embeddedIPv4(g[1], g[2]));
    return (
        (g[0] & 0xfe00) === 0xfc00 || // ULA fc00::/7
        (g[0] & 0xffc0) === 0xfe80 || // 링크로컬 fe80::/10
        (g[0] & 0xffc0) === 0xfec0 || // 사이트로컬(폐기) fec0::/10
        (g[0] & 0xff00) === 0xff00 // 멀티캐스트 ff00::/8
    );
}

/** 공인 주소가 아니거나 해석할 수 없으면 true(열려 있는 쪽이 아니라 닫는 쪽으로 실패한다). */
export function isBlockedAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) {
        const octets = parseIPv4(address);
        return octets === null || isBlockedIPv4(octets);
    }
    if (family === 6) {
        const groups = parseIPv6(address);
        return groups === null || isBlockedIPv6(groups);
    }
    return true;
}
