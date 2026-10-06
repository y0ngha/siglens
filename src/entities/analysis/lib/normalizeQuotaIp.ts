/** IP를 알 수 없거나 해석하지 못한 요청이 모이는 공용 버킷 키. */
export const UNKNOWN_QUOTA_IP = 'unknown';

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEXTET_RE = /^[0-9a-f]{1,4}$/;
const IPV6_HEXTETS = 8;
const IPV6_PREFIX_HEXTETS = 4;
const IPV4_MAX_OCTET = 255;
const HEXTET_RADIX = 16;
/** hextet 하나 = 옥텟 두 개. */
const BITS_PER_OCTET = 8;
const OCTET_MASK = 0xff;
const IPV4_MAPPED_PREFIX = ['0', '0', '0', '0', '0', 'ffff'];

function isIpv4(value: string): boolean {
    const match = IPV4_RE.exec(value);
    return (
        match !== null &&
        match.slice(1).every(octet => Number(octet) <= IPV4_MAX_OCTET)
    );
}

/** 마지막 32비트가 점 표기 IPv4인 꼴(`…:1.2.3.4`)을 hextet 두 개로 바꾼다. */
function embeddedIpv4ToHextets(value: string): string | null {
    const lastColon = value.lastIndexOf(':');
    const tail = value.slice(lastColon + 1);
    if (!tail.includes('.')) return value;
    if (!isIpv4(tail)) return null;
    const [a, b, c, d] = tail.split('.').map(Number);
    const high = ((a << BITS_PER_OCTET) | b).toString(HEXTET_RADIX);
    const low = ((c << BITS_PER_OCTET) | d).toString(HEXTET_RADIX);
    return `${value.slice(0, lastColon + 1)}${high}:${low}`;
}

/** `::` 축약을 풀어 정확히 8개의 (선행 0 없는) hextet을 돌려준다. 실패면 `null`. */
function expandIpv6(value: string): string[] | null {
    const withHextets = embeddedIpv4ToHextets(value);
    if (withHextets === null) return null;
    const halves = withHextets.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] === '' ? [] : halves[0].split(':');
    const tail =
        halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : [];
    const missing = IPV6_HEXTETS - head.length - tail.length;
    if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
    const hextets = [
        ...head,
        ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => '0'),
        ...tail,
    ];
    if (!hextets.every(h => HEXTET_RE.test(h))) return null;
    return hextets.map(h => parseInt(h, HEXTET_RADIX).toString(HEXTET_RADIX));
}

/**
 * 한도 키로 쓸 클라이언트 IP를 정규화한다.
 *
 * - **IPv6는 /64 접두로 접는다.** 가정·모바일 회선은 보통 /64 하나를 통째로 받아서,
 *   주소 끝 64비트를 바꿔 가며 보내면 요청마다 새 IP가 된다 — 원시 주소로 세면 IP
 *   축 한도가 사실상 무의미하다.
 * - **IPv4-mapped IPv6(`::ffff:1.2.3.4`)는 IPv4로 되돌린다.** 같은 클라이언트가 스택에
 *   따라 두 모양으로 와도 같은 버킷에 들어가야 한다.
 * - 알 수 없는 값(`'unknown'`, 빈 문자열, 파싱 불가)은 {@link UNKNOWN_QUOTA_IP}로
 *   모은다 — 호출자가 그 버킷에 엄격한 한도를 건다.
 */
export function normalizeQuotaIp(raw: string): string {
    const value = raw.trim().toLowerCase();
    if (value === '' || value === UNKNOWN_QUOTA_IP) return UNKNOWN_QUOTA_IP;
    if (isIpv4(value)) return value;
    if (!value.includes(':')) return UNKNOWN_QUOTA_IP;

    // 존 식별자(`fe80::1%eth0`)는 주소의 일부가 아니다.
    const hextets = expandIpv6(value.split('%')[0]);
    if (hextets === null) return UNKNOWN_QUOTA_IP;

    if (IPV4_MAPPED_PREFIX.every((h, i) => hextets[i] === h)) {
        const [high, low] = hextets
            .slice(IPV4_MAPPED_PREFIX.length)
            .map(h => parseInt(h, HEXTET_RADIX));
        return [
            high >> BITS_PER_OCTET,
            high & OCTET_MASK,
            low >> BITS_PER_OCTET,
            low & OCTET_MASK,
        ].join('.');
    }
    return `${hextets.slice(0, IPV6_PREFIX_HEXTETS).join(':')}::/64`;
}
