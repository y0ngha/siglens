import 'server-only';
import {
    createCounterStore,
    hashUsageIp,
    type CounterStore,
} from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getUpstashWriterCredentials } from '@/shared/cache/redisClient';
import {
    MS_PER_HOUR,
    MS_PER_MINUTE,
    MS_PER_SECOND,
} from '@/shared/config/time';
import type {
    AnalysisRateLimitAudience,
    AnalysisRateLimitReason,
} from '@/shared/lib/sse/analysisRateLimit';
import { normalizeQuotaIp } from '@/entities/analysis/lib/normalizeQuotaIp';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';

/**
 * `/api/analysis/stream`의 **새 LLM 생성** 한도. 캐시 적중은 세지 않는다
 * (예약 후 환불 — {@link reserveAnalysisGeneration}).
 *
 * 값은 사용자 승인 설계값이고, 바로 아래 상수가 단일 출처다(문구에 숫자를 옮겨
 * 적지 않는다 — 상수만 바뀌고 설명이 낡는 것을 막는다).
 *
 * - **개인 축**(서명된 게스트 쿠키를 들고 온 비회원):
 *   `ANALYSIS_GUEST_GENERATIONS_PER_HOUR` / `ANALYSIS_GUEST_GENERATIONS_PER_DAY`.
 * - **IP 축**(모든 비회원): `ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY`. 쿠키 없이 온
 *   요청은 개인을 구분할 수 없으므로 개인 축 대신 IP 시간 축
 *   (`ANALYSIS_COOKIELESS_IP_GENERATIONS_PER_HOUR`)을 건다 — 통신사 NAT·사무실처럼
 *   여러 사람이 한 IP를 쓰는 곳이 개인 시간 한도 하나를 나눠 쓰지 않게 한다. 쿠키는
 *   그 요청의 응답에서 발급되므로 다음 요청부터 개인 축으로 옮겨 간다.
 * - **IP 미상**: 전부 한 버킷(`unknown`)이라 엄격하게 묶는다
 *   (`ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_HOUR` / `_PER_DAY`). 운영은 Cloudflare
 *   터널로만 들어와 `cf-connecting-ip`가 항상 있으므로, 이 버킷이 차면 그 자체가
 *   설정 이상 신호다.
 * - **회원**: userId당 `ANALYSIS_MEMBER_GENERATIONS_PER_DAY`.
 */
export const ANALYSIS_GUEST_GENERATIONS_PER_HOUR = 20;
export const ANALYSIS_GUEST_GENERATIONS_PER_DAY = 60;
export const ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY = 200;
export const ANALYSIS_COOKIELESS_IP_GENERATIONS_PER_HOUR = 60;
export const ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_HOUR = 20;
export const ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_DAY = 60;
export const ANALYSIS_MEMBER_GENERATIONS_PER_DAY = 300;

/**
 * 비회원 한도 저장소(Redis)가 죽었거나 신원 해석이 실패했을 때 클라이언트에 알려 줄
 * 재시도 시각까지의 간격(`generationQuota.ts`도 이 값을 쓴다).
 * 장애는 대개 분 단위로 회복되므로, 일 단위 경계를 알려 주면 과하게 막는다.
 */
export const QUOTA_OUTAGE_RETRY_MS = 5 * MS_PER_MINUTE;

/**
 * 예약 전체(창 최대 3개 순차 소비)에 거는 시간 상한. 넘기면 장애로 본다 — 한도
 * 판정이 분석 응답의 첫 바이트를 Upstash 지연만큼 붙잡으면 안 된다.
 */
export const QUOTA_RESERVE_TIMEOUT_MS = MS_PER_SECOND;

/** 같은 경고를 인스턴스당 이 간격에 한 번만 남긴다(장애 중 로그 폭주 방지). */
const WARN_INTERVAL_MS = MS_PER_MINUTE;

/** ISO 문자열에서 UTC 시(`HH`)의 위치. */
const ISO_HOUR_START = 11;
const ISO_HOUR_END = 13;

export type AnalysisQuotaIdentity =
    | { readonly kind: 'member'; readonly userId: string }
    | {
          readonly kind: 'guest';
          /** 이 요청이 들고 온, 서명 검증을 통과한 게스트 쿠키 id. 없거나 위조면 `null`. */
          readonly guestId: string | null;
          readonly clientIp: string;
      };

export type AnalysisQuotaReservation =
    | {
          readonly ok: true;
          readonly audience: AnalysisRateLimitAudience;
          /** 예약을 되돌린다. 여러 번 불러도 한 번만 되돌린다. 던지지 않는다. */
          readonly refund: () => Promise<void>;
      }
    | {
          readonly ok: false;
          readonly audience: AnalysisRateLimitAudience;
          /** `quota` = 한도 소진, `unavailable` = 저장소 장애·지연. */
          readonly reason: AnalysisRateLimitReason;
          /** 새 생성이 다시 가능해지는 시각(epoch ms). */
          readonly retryAt: number;
      };

interface WindowClaim {
    readonly store: CounterStore;
    readonly subject: string;
    readonly limit: number;
    readonly retryAt: number;
}

interface QuotaStores {
    readonly guestHour: CounterStore;
    readonly guestDay: CounterStore;
    readonly guestIpHour: CounterStore;
    readonly guestIpDay: CounterStore;
    readonly member: CounterStore;
}

let stores: QuotaStores | undefined;

/**
 * core `createCounterStore`를 재사용한다(에이전트 챗 쿼터와 같은 어댑터).
 *
 * - 비회원은 **fail-closed** — 저장소 장애 시 새 생성만 막고 캐시는 계속 내준다.
 *   열어 두면 Redis 장애가 곧 익명 무제한 LLM 호출이 된다.
 * - 회원은 **fail-open** — 세션으로 신원이 확정된 사용자를 인프라 장애로 막지 않는다.
 *
 * ## 알람 결합
 *
 * core의 fail-closed 저장소는 장애 시 `[agent] quota store unavailable`을 남긴다 —
 * P1 점수 필터(`infra/aws/07-alarms.sh`, 가중치 50)가 세는 마커다. 즉 **분석 한도
 * 저장소 장애도 그 에이전트 알람으로 울린다.** core 2.13.1의 `createCounterStore`는
 * 마커·라벨 옵션을 받지 않아 분석 전용 마커로 가를 수 없다(core 후속 과제). 이
 * 모듈 자신의 `[analysis-quota] …` 경고는 알람에 걸려 있지 않다.
 *
 * ## 창의 가장자리(감수하는 근사)
 *
 * - core 저장소는 `day`/`month` 버킷만 있어서, 시간 창은 subject에 UTC 시를 덧붙여
 *   만든다(키 = `<prefix>:<subject>:<HH>:<YYYY-MM-DD>`, TTL 1일). 고정 창이라 경계를
 *   끼고 최대 2배가 몰릴 수 있다.
 * - core `refund`는 버킷을 **환불 시각**으로 다시 계산한다. 예약이 23:59 UTC, 환불이
 *   00:00 이후면 어제 키를 못 찾아 환불이 사라진다(1건 과대 계산, 다음 날 자정에 소멸).
 * - core `consume`은 INCR 뒤 `EXPIRE NX`를 따로 보낸다. 그 사이 프로세스가 죽으면 TTL
 *   없는 키가 남을 수 있지만, 키에 날짜가 박혀 있어 다음 날부터는 쓰이지 않는다.
 *
 * 생성은 첫 사용 시점까지 미룬다 — core가 생성 시점에 Upstash 환경 변수를 읽는다.
 */
function quotaStores(): QuotaStores {
    const closed = (prefix: string): CounterStore =>
        createCounterStore({ prefix, period: 'day', failurePolicy: 'closed' });
    stores ??= {
        guestHour: closed('analysis:q:guest-h'),
        guestDay: closed('analysis:q:guest-d'),
        guestIpHour: closed('analysis:q:guest-ip-h'),
        guestIpDay: closed('analysis:q:guest-ip'),
        member: createCounterStore({
            prefix: 'analysis:q:member',
            period: 'day',
            failurePolicy: 'open',
        }),
    };
    return stores;
}

const lastWarnAt = new Map<string, number>();

/** 같은 `key`의 경고를 {@link WARN_INTERVAL_MS}에 한 번만 남긴다. */
function warnThrottled(key: string, message: string, detail?: unknown): void {
    const now = Date.now();
    if (now - (lastWarnAt.get(key) ?? 0) < WARN_INTERVAL_MS) return;
    lastWarnAt.set(key, now);
    console.warn(message, detail);
}

/** 테스트 전용 — 메모된 저장소와 경고 억제 상태를 버린다. */
export function __resetAnalysisQuotaStoresForTests(): void {
    stores = undefined;
    lastWarnAt.clear();
}

/** 다음 UTC 정시(epoch ms). */
export function nextUtcHourStart(now: Date): number {
    return (Math.floor(now.getTime() / MS_PER_HOUR) + 1) * MS_PER_HOUR;
}

/** 다음 UTC 자정(epoch ms) — core 일 버킷과 `hashUsageIp` 소금이 바뀌는 시각. */
export function nextUtcDayStart(now: Date): number {
    return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
    );
}

/**
 * 한도를 강제하지 않는 환경인가.
 *
 * - E2E: 같은 IP로 수많은 분석을 돌린다. 액션들이 어차피 LLM을 단락한다.
 * - Redis 미설정 개발 환경: 비회원이 fail-closed라 로컬에서 모든 분석이 캐시
 *   전용이 돼 버린다. **프로덕션에서 미설정은 우회 사유가 아니다** — 그때는
 *   fail-closed가 그대로 걸린다.
 */
function isQuotaBypassed(): boolean {
    if (isE2E()) return true;
    return (
        getUpstashWriterCredentials() === null &&
        process.env.NODE_ENV !== 'production'
    );
}

function guestClaims(
    identity: Extract<AnalysisQuotaIdentity, { kind: 'guest' }>,
    now: Date
): readonly WindowClaim[] {
    const { guestHour, guestDay, guestIpHour, guestIpDay } = quotaStores();
    const ip = normalizeQuotaIp(identity.clientIp);
    const unknownIp = ip === UNKNOWN_CLIENT_IP;
    if (unknownIp) {
        warnThrottled(
            'unknown-ip',
            '[analysis-quota] client ip unknown — using the strict shared bucket'
        );
    }
    // 일 단위 소금이라 원시 IP를 키에 남기지 않는다. 버킷도 UTC 일이라 어긋나지 않는다.
    const ipSubject = unknownIp ? UNKNOWN_CLIENT_IP : hashUsageIp(ip, now);
    const hour = now.toISOString().slice(ISO_HOUR_START, ISO_HOUR_END);
    const hourEnd = nextUtcHourStart(now);
    const dayEnd = nextUtcDayStart(now);

    // IP 축을 먼저 소비한다 — 남용 트래픽은 대개 IP 축에서 먼저 막히므로, 거절되는
    // 요청의 Redis 왕복이 한 번으로 끝난다.
    const ipDay: WindowClaim = {
        store: guestIpDay,
        subject: ipSubject,
        limit: unknownIp
            ? ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_DAY
            : ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY,
        retryAt: dayEnd,
    };
    const ipHourLimit = unknownIp
        ? ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_HOUR
        : identity.guestId === null
          ? ANALYSIS_COOKIELESS_IP_GENERATIONS_PER_HOUR
          : null;
    const ipHour: readonly WindowClaim[] =
        ipHourLimit === null
            ? []
            : [
                  {
                      store: guestIpHour,
                      subject: `${ipSubject}:${hour}`,
                      limit: ipHourLimit,
                      retryAt: hourEnd,
                  },
              ];
    const personal: readonly WindowClaim[] =
        identity.guestId === null
            ? []
            : [
                  {
                      store: guestHour,
                      subject: `g:${identity.guestId}:${hour}`,
                      limit: ANALYSIS_GUEST_GENERATIONS_PER_HOUR,
                      retryAt: hourEnd,
                  },
                  {
                      store: guestDay,
                      subject: `g:${identity.guestId}`,
                      limit: ANALYSIS_GUEST_GENERATIONS_PER_DAY,
                      retryAt: dayEnd,
                  },
              ];
    return [ipDay, ...ipHour, ...personal];
}

function memberClaims(userId: string, now: Date): readonly WindowClaim[] {
    return [
        {
            store: quotaStores().member,
            subject: userId,
            limit: ANALYSIS_MEMBER_GENERATIONS_PER_DAY,
            retryAt: nextUtcDayStart(now),
        },
    ];
}

async function refundAll(claims: readonly WindowClaim[]): Promise<void> {
    await Promise.all(claims.map(c => c.store.refund(c.subject)));
}

/** 처음 한 번만 실행되는 환불 — 정산 경로와 예외 경로가 겹쳐도 두 번 빼지 않는다. */
function onceRefund(claims: readonly WindowClaim[]): () => Promise<void> {
    let refunded: Promise<void> | undefined;
    return () => {
        refunded ??= refundAll(claims);
        return refunded;
    };
}

const NOOP_REFUND = async (): Promise<void> => {};

function outage(
    audience: AnalysisRateLimitAudience,
    now: Date
): AnalysisQuotaReservation {
    // 회원은 fail-open이다 — 장애로 막지 않는다.
    return audience === 'member'
        ? { ok: true, audience, refund: NOOP_REFUND }
        : {
              ok: false,
              audience,
              reason: 'unavailable',
              retryAt: now.getTime() + QUOTA_OUTAGE_RETRY_MS,
          };
}

/**
 * 창을 앞에서부터 **하나씩** 소비한다(재귀). 순차여야 한다 — 병렬로 소비하면 거절된
 * 창 뒤의 창까지 이미 올라가 있다. `consumed`는 지금까지 소비한 창이고, 거절·장애 시
 * 그것만 되돌린다(넘친 창 자신은 core가 이미 되돌린다).
 */
async function claimAll(
    audience: AnalysisRateLimitAudience,
    remaining: readonly WindowClaim[],
    now: Date,
    consumed: readonly WindowClaim[] = []
): Promise<AnalysisQuotaReservation> {
    const [claim, ...rest] = remaining;
    if (claim === undefined) {
        return { ok: true, audience, refund: onceRefund(consumed) };
    }
    const allowed = await claim.store
        .consume(claim.subject, claim.limit)
        .catch((error: unknown) => {
            // fail-closed 저장소(비회원)만 여기로 온다 — core가 이미 알람 마커를 남겼다.
            warnThrottled(
                'unavailable',
                '[analysis-quota] store unavailable, cache-only',
                error
            );
            return null;
        });
    if (allowed === null) {
        await refundAll(consumed);
        return outage(audience, now);
    }
    if (!allowed) {
        await refundAll(consumed);
        return {
            ok: false,
            audience,
            reason: 'quota',
            retryAt: claim.retryAt,
        };
    }
    return claimAll(audience, rest, now, [...consumed, claim]);
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
 * 새 생성 1건을 예약한다. **던지지 않는다.**
 *
 * 여러 창을 순서대로 소비하고, 하나라도 넘치면 앞서 소비한 창을 되돌린 뒤 거절한다
 * (넘친 창 자신은 core가 이미 되돌린다). 거절 시 호출자는 캐시 전용으로 강등한다.
 *
 * {@link QUOTA_RESERVE_TIMEOUT_MS} 안에 끝나지 않으면 장애로 본다(비회원은 캐시 전용,
 * 회원은 통과). 늦게 끝난 예약은 버리지 않고 환불한다 — 응답은 이미 장애 판정으로
 * 나갔으니 그 예약에 대응하는 생성이 없다.
 *
 * 허락되면 반환된 `refund`를 **생성이 일어나지 않았을 때** 호출해야 한다 — 캐시 적중,
 * 동시 요청의 패자, 프로바이더 호출 전 실패. 그래야 한도가 실제 LLM 호출 수를 센다.
 */
export async function reserveAnalysisGeneration(
    identity: AnalysisQuotaIdentity,
    now: Date = new Date()
): Promise<AnalysisQuotaReservation> {
    const audience: AnalysisRateLimitAudience =
        identity.kind === 'member' ? 'member' : 'guest';
    try {
        if (isQuotaBypassed()) {
            return { ok: true, audience, refund: NOOP_REFUND };
        }
        const claims =
            identity.kind === 'member'
                ? memberClaims(identity.userId, now)
                : guestClaims(identity, now);
        const attempt = claimAll(audience, claims, now);
        const outcome = await withTimeout(attempt, QUOTA_RESERVE_TIMEOUT_MS);
        if (outcome !== TIMED_OUT) return outcome;

        warnThrottled(
            'timeout',
            '[analysis-quota] reserve timed out, treating as unavailable'
        );
        // 늦게 성공한 예약은 대응하는 생성이 없으니 되돌린다. 실패해도 응답은 이미
        // 나갔으므로 로그만 남긴다 — 처리되지 않은 rejection이 되면 안 된다.
        void attempt
            .then(late => (late.ok ? late.refund() : undefined))
            .catch((error: unknown) => {
                warnThrottled(
                    'late-refund',
                    '[analysis-quota] late refund failed',
                    error
                );
            });
        return outage(audience, now);
    } catch (error) {
        warnThrottled(
            'unexpected',
            '[analysis-quota] reserve failed unexpectedly',
            error
        );
        return outage(audience, now);
    }
}
