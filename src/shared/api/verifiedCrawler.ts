import 'server-only';
import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    MS_PER_MINUTE,
    SECONDS_PER_DAY,
    MS_PER_HOUR,
} from '@/shared/config/time';

export interface VerifiableCrawler {
    readonly id: string;
    /** 이 UA를 주장할 때만 DNS 검증을 시도한다. */
    readonly userAgent: RegExp;
    /** PTR 호스트가 이 중 하나로 끝나야 한다(소문자, 앞의 `.` 포함 — 부분 도메인 위장 방지). */
    readonly hostSuffixes: readonly string[];
}

/**
 * DNS로 신원을 검증할 수 있는 검색 크롤러.
 *
 * `userAgent`는 **검증을 시도할지**만 정한다 — UA만으로는 아무것도 바뀌지 않는다.
 * 판정은 언제나 역방향 DNS(PTR) → `hostSuffixes` 대조 → 그 호스트의 순방향 조회가
 * 원래 IP를 포함하는지(3단계)로 내린다. PTR 레코드는 IP 소유자만, 순방향 레코드는
 * 도메인 소유자만 쓸 수 있으므로 둘이 맞물리면 위조할 수 없다.
 *
 * 접미사 출처(각 벤더가 문서화한 검증법 — 2026-10-07 확인):
 *
 * - **Google** — https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot
 *   "reverse DNS → 도메인이 `googlebot.com`·`google.com`·`googleusercontent.com`인지 →
 *   forward DNS가 같은 IP인지". 일반 크롤러(Googlebot)는 `crawl-…googlebot.com`·
 *   `geo-crawl-…geo.googlebot.com`, 특수 크롤러는 `rate-limited-proxy-…google.com`이다.
 *   ⚠️ **`googleusercontent.com`은 일부러 뺀다.** 문서상 그 접미사는 사용자 트리거
 *   fetcher(`…gae.googleusercontent.com`) 몫이고, Google Cloud 고객 VM도
 *   `…bc.googleusercontent.com` PTR을 받으며 그 PTR은 순방향 조회까지 통과한다 —
 *   넣으면 아무 GCP VM이 Googlebot UA만 달고 한도를 우회한다.
 *   `Google-InspectionTool`(Search Console URL 검사·리치 결과 테스트의 렌더러)도 같은
 *   Googlebot 도메인에서 오므로 함께 받는다 — 운영자가 색인 렌더를 확인하는 경로다.
 * - **Bing** — https://blogs.bing.com/webmaster/August-2012/How-to-Verify-that-Bingbot-is-Bingbot/
 *   (Bing Webmaster "Verify Bingbot" 도구와 같은 규칙): PTR이 `search.msn.com`으로 끝나고
 *   순방향이 같은 IP. 예: `msnbot-157-55-33-18.search.msn.com`.
 * - **Naver(Yeti)** — 네이버 서치어드바이저의 검색로봇 안내(searchadvisor.naver.com,
 *   "검색로봇 방화벽 허용")는 PTR이 `naver.com`으로 끝나는지 + 순방향 대조를 말한다.
 *   2026-10-07 작성 시 그 페이지를 직접 받지 못해(자동 fetch 차단) 2차 출처로 확인했다.
 *   `naver.com` 전체는 너무 넓어(다른 네이버 서비스·고객 호스트가 그 존에 PTR을 가질 수
 *   있다 — 위 `googleusercontent.com`과 같은 부류) 실측한 크롤 존 **`web.naver.com`**으로
 *   좁힌다: 2026-10-07 `host 211.249.46.191` → `crawl.211-249-46-191.web.naver.com`,
 *   그 이름의 순방향 → 211.249.46.191. 공식 IP 피드는
 *   https://searchadvisor.naver.com/doc/naverbot.json.
 *   재확인: 그 피드의 IP 몇 개로 `host <ip>` → `host <hostname>`을 돌려 존이 같은지 본다.
 * - **Daum(Daumoa, 카카오)** — 카카오의 공개 역방향 DNS 검증 문서는 찾지 못했다(2026-10-07).
 *   2차 출처(boteraser.com의 daumoa 항목)가 보고한 PTR이 `daumoa.crawl.kakao.com`
 *   꼴(AS9318)이라 크롤 존 **`crawl.kakao.com`**만 받는다. `kakao.com`·`daum.net` 전체는
 *   같은 이유로 넣지 않는다.
 *   TODO(검증 안 됨): 이 존은 실측하지 못했다(작성 시 Daumoa IP를 몰랐다). 운영 로그에서
 *   Daumoa UA의 `cf-connecting-ip`를 골라 `host <ip>` → `host <hostname>`으로 존을 확인하고,
 *   다르면 여기를 고친다 — 틀린 존이면 진짜 Daumoa가 평소 한도를 받을 뿐 우회는 없다.
 */
export const VERIFIABLE_CRAWLERS: readonly VerifiableCrawler[] = [
    {
        id: 'google',
        userAgent: /Googlebot|Google-InspectionTool/i,
        hostSuffixes: ['.googlebot.com', '.google.com'],
    },
    {
        id: 'bing',
        userAgent: /bingbot/i,
        hostSuffixes: ['.search.msn.com'],
    },
    {
        id: 'naver',
        userAgent: /\bYeti\b/i,
        hostSuffixes: ['.web.naver.com'],
    },
    {
        id: 'daum',
        userAgent: /Daumoa/i,
        hostSuffixes: ['.crawl.kakao.com'],
    },
];

/**
 * 검증 한 번(캐시 조회 + PTR + 순방향)에 거는 시간 상한. 넘기면 미검증으로 보고 평소
 * 한도를 건다 — 크롤러 UA를 단 요청의 첫 바이트만 이만큼 늦어질 수 있다. 같은 값을
 * DNS 질의 하나의 timeout으로도 써서 상한 뒤 질의가 계속 매달리지 않게 한다.
 */
export const VERIFY_TIMEOUT_MS = 500;

/**
 * 검증된 IP를 기억하는 기간(Redis, 모든 인스턴스 공유). 크롤러 IP 대역은 자주 바뀌지 않는다.
 * Redis에는 **검증 성공만** 쓴다 — 아래 {@link REJECTED_MEMORY_TTL_MS} 참고.
 */
export const VERIFIED_TTL_SECONDS = SECONDS_PER_DAY;
/**
 * 인스턴스 메모리(L1)에 검증 성공을 두는 기간. Redis(L2)가 정본이고 L1은 같은 IP의 연속
 * 요청이 Redis 왕복을 반복하지 않게 하는 앞단일 뿐이라 짧게 둔다.
 */
const VERIFIED_MEMORY_TTL_MS = 10 * MS_PER_MINUTE;
/**
 * 검증 실패(PTR 불일치·순방향 불일치·PTR 없음)를 기억하는 기간. **메모리에만** 둔다.
 * 실패 키는 공격자가 IP를 돌리는 만큼 늘어난다 — Redis에 쓰면 위조 요청이 공유 저장소의
 * 쓰기·키 수를 무한히 키운다. 메모리는 LRU 상한({@link MEMORY_MAX_ENTRIES})이 있어 그
 * 비용이 묶인다. 대신 다른 인스턴스는 같은 위조 IP를 한 번 더 DNS로 확인한다(검증 성공은
 * 크롤러 IP 수만큼만 생겨 Redis에 써도 묶인다).
 */
export const REJECTED_MEMORY_TTL_MS = MS_PER_HOUR;
/**
 * DNS 장애·timeout처럼 판정을 못 내린 경우 L1에만 두는 기간. Redis에는 쓰지 않는다 —
 * 일시 장애를 한 시간 동안 "위조"로 기억하면 진짜 크롤러가 그동안 한도에 걸린다. 그래도
 * 잠깐은 기억해야 장애 중 위조 UA 요청마다 DNS를 다시 두드리지 않는다.
 */
const INCONCLUSIVE_MEMORY_TTL_MS = MS_PER_MINUTE;
const MEMORY_MAX_ENTRIES = 1_000;
/**
 * 동시에 진행할 수 있는 검증 수(인스턴스당). 넘치면 새 IP는 DNS·Redis 없이 미검증으로
 * 끝난다 — IP를 돌리는 위조 UA 폭주가 DNS·Redis 작업을 무한히 쌓지 못하게 한다. 진짜
 * 크롤러 IP는 대부분 캐시에 있어 이 상한에 닿지 않고, 닿아도 평소 한도를 받을 뿐이다.
 */
export const MAX_IN_FLIGHT_VERIFICATIONS = 32;
/** PTR이 여러 개면 앞에서 이만큼만 본다 — 조작된 PTR 목록으로 순방향 조회를 부풀리지 못하게. */
export const MAX_PTR_HOSTS = 3;
const REDIS_KEY_PREFIX = 'crawler-verify:v1';

/** 레코드가 없다는 확정 응답 — 이 둘만 "검증 실패"로 보고 나머지 오류는 장애로 본다. */
const DEFINITIVE_DNS_ERRORS: ReadonlySet<string> = new Set([
    'ENOTFOUND',
    'ENODATA',
]);

type Verdict = 'verified' | 'rejected' | 'inconclusive';

const memory = createMemoryLru<boolean>(MEMORY_MAX_ENTRIES);
const inFlight = new Map<string, Promise<boolean>>();
let resolver: Resolver | undefined;

function dnsResolver(): Resolver {
    resolver ??= new Resolver({ timeout: VERIFY_TIMEOUT_MS, tries: 1 });
    return resolver;
}

/** UA가 주장하는 크롤러. 아무 크롤러도 주장하지 않으면 `null`. */
export function claimedCrawler(
    userAgent: string | null
): VerifiableCrawler | null {
    if (userAgent === null || userAgent === '') return null;
    return VERIFIABLE_CRAWLERS.find(c => c.userAgent.test(userAgent)) ?? null;
}

const IPV4_MAPPED_RE = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/**
 * 비교용 정규형 IP. IPv4-mapped IPv6는 IPv4로 되돌리고, IPv6는 WHATWG URL 직렬화로
 * 압축·소문자 표기를 맞춘다(c-ares 응답과 `cf-connecting-ip`의 표기가 달라도 같게).
 * IP가 아니면(`unknown` 포함) `null`. **던지지 않는다** — 존 식별자가 붙은 IPv6
 * (`fe80::1%eth0`)는 `isIP`는 6을 주지만 URL 파서가 던지므로 미리 거른다(링크 로컬
 * 주소라 크롤러일 수도 없다).
 */
export function canonicalIp(raw: string): string | null {
    const value = raw.trim();
    if (value === '' || value === UNKNOWN_CLIENT_IP || value.includes('%'))
        return null;
    const mapped = IPV4_MAPPED_RE.exec(value);
    const candidate = mapped === null ? value : mapped[1];
    const family = isIP(candidate);
    if (family === 4) return candidate;
    if (family !== 6) return null;
    try {
        return new URL(`http://[${candidate}]`).hostname.slice(1, -1);
    } catch {
        return null;
    }
}

function hostMatches(hostname: string, crawler: VerifiableCrawler): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    return crawler.hostSuffixes.some(suffix => host.endsWith(suffix));
}

function isDefinitiveDnsError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        DEFINITIVE_DNS_ERRORS.has(error.code)
    );
}

/** 순방향 조회가 원래 IP를 포함하는가. 레코드 없음은 `false`, 그 밖의 오류는 던진다. */
async function forwardIncludes(hostname: string, ip: string): Promise<boolean> {
    const dns = dnsResolver();
    try {
        const addresses =
            isIP(ip) === 4
                ? await dns.resolve4(hostname)
                : await dns.resolve6(hostname);
        return addresses.some(address => canonicalIp(address) === ip);
    } catch (error) {
        if (isDefinitiveDnsError(error)) return false;
        throw error;
    }
}

/** PTR → 접미사 → 순방향 3단계. 던지지 않는다 — 장애는 `inconclusive`. */
async function verifyByDns(
    crawler: VerifiableCrawler,
    ip: string
): Promise<Verdict> {
    try {
        const hostnames = (await dnsResolver().reverse(ip))
            .filter(hostname => hostMatches(hostname, crawler))
            .slice(0, MAX_PTR_HOSTS);
        for (const hostname of hostnames) {
            if (await forwardIncludes(hostname, ip)) return 'verified';
        }
        return 'rejected';
    } catch (error) {
        return isDefinitiveDnsError(error) ? 'rejected' : 'inconclusive';
    }
}

/** Redis 키. 원시 IP를 키에 남기지 않는다(분석 한도의 `hashUsageIp`와 같은 취지). */
function redisKey(crawler: VerifiableCrawler, ip: string): string {
    const digest = createHash('sha256').update(ip).digest('hex');
    return `${REDIS_KEY_PREFIX}:${crawler.id}:${digest}`;
}

/** 다른 인스턴스가 Redis에 남긴 검증 성공이 있는가. 없거나 Redis를 못 쓰면 `false`. */
async function hasStoredVerification(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        const stored = await redis.get<string | number>(key);
        // Upstash는 '1'을 숫자 1로 역직렬화한다 — 문자열로 맞춰 비교한다.
        return stored !== null && String(stored) === '1';
    } catch (error) {
        console.warn('[verified-crawler] cache read failed', error);
        return false;
    }
}

async function storeVerification(key: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(key, '1', { ex: VERIFIED_TTL_SECONDS });
    } catch (error) {
        console.warn('[verified-crawler] cache write failed', error);
    }
}

/** 판정별 L1 보관 기간. */
const MEMORY_TTL_BY_VERDICT: Readonly<Record<Verdict, number>> = {
    verified: VERIFIED_MEMORY_TTL_MS,
    rejected: REJECTED_MEMORY_TTL_MS,
    inconclusive: INCONCLUSIVE_MEMORY_TTL_MS,
};

/**
 * L2(Redis) → DNS 순으로 판정을 구하고 L1에 기록한다. 검증 성공만 L2에 쓴다
 * ({@link REJECTED_MEMORY_TTL_MS}). 던지지 않는다.
 */
async function resolveVerdict(
    crawler: VerifiableCrawler,
    ip: string,
    memoryKey: string
): Promise<boolean> {
    const key = redisKey(crawler, ip);
    if (await hasStoredVerification(key)) {
        memory.set(memoryKey, true, VERIFIED_MEMORY_TTL_MS);
        return true;
    }
    const verdict = await verifyByDns(crawler, ip);
    memory.set(
        memoryKey,
        verdict === 'verified',
        MEMORY_TTL_BY_VERDICT[verdict]
    );
    if (verdict !== 'verified') return false;
    await storeVerification(key);
    console.info('[verified-crawler] verified', crawler.id);
    return true;
}

const TIMED_OUT = Symbol('timed-out');

async function withTimeout<T>(
    work: Promise<T>,
    ms: number
): Promise<T | typeof TIMED_OUT> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMED_OUT>(resolve => {
        timer = setTimeout(() => resolve(TIMED_OUT), ms);
    });
    return Promise.race([work, timeout]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
    });
}

/**
 * `ip`가 `userAgent`가 주장하는 검색 크롤러의 것임을 DNS로 확인했는가. **던지지 않는다.**
 *
 * - UA가 {@link VERIFIABLE_CRAWLERS} 중 하나를 주장하지 않으면 I/O 없이 `false` —
 *   일반 사용자 요청에는 지연이 붙지 않는다.
 * - IP 미상(`unknown`)·IP가 아닌 값(존 식별자 붙은 IPv6 포함)은 검증하지 않는다(`false`).
 * - ⚠️ `ip`는 호출자가 위조할 수 없는 값이어야 한다(운영에선 `cf-connecting-ip`). 위조
 *   가능한 IP(`X-Forwarded-For`)를 넘기면 진짜 크롤러 IP를 빌려 검증을 통과한다.
 * - 판정은 IP·크롤러별로 캐시한다: 인스턴스 메모리(L1 — 성공 10분, 실패 1h, 장애 1분)
 *   → Redis(L2, 모든 인스턴스 공유, 검증 성공만 24h) → DNS. 같은 IP의 동시 요청은 한
 *   번의 검증을 나눠 쓴다.
 * - 진행 중 검증이 {@link MAX_IN_FLIGHT_VERIFICATIONS}에 닿으면 새 IP는 I/O 없이 `false`.
 * - {@link VERIFY_TIMEOUT_MS} 안에 판정이 안 나면 `false`. 늦게 끝난 검증은 버리지 않고
 *   캐시에 남아 다음 요청이 쓴다.
 */
export async function isVerifiedCrawler(
    ip: string,
    userAgent: string | null
): Promise<boolean> {
    const crawler = claimedCrawler(userAgent);
    if (crawler === null) return false;
    const address = canonicalIp(ip);
    if (address === null) return false;

    const memoryKey = `${crawler.id}:${address}`;
    const remembered = memory.get(memoryKey);
    if (remembered !== undefined) return remembered;

    let pending = inFlight.get(memoryKey);
    if (pending === undefined) {
        if (inFlight.size >= MAX_IN_FLIGHT_VERIFICATIONS) return false;
        pending = resolveVerdict(crawler, address, memoryKey)
            .catch((error: unknown) => {
                console.warn('[verified-crawler] verification failed', error);
                return false;
            })
            .finally(() => inFlight.delete(memoryKey));
        inFlight.set(memoryKey, pending);
    }
    const outcome = await withTimeout(pending, VERIFY_TIMEOUT_MS);
    return outcome === TIMED_OUT ? false : outcome;
}

/** 테스트 전용 — 메모리 캐시·진행 중 검증·리졸버를 버린다. */
export function __resetVerifiedCrawlerForTests(): void {
    __resetMemoryLruForTests(memory);
    inFlight.clear();
    resolver = undefined;
}
