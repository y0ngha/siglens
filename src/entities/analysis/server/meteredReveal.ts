import 'server-only';
import { createHmac } from 'node:crypto';
import type { MeteredRevealPolicy } from '@y0ngha/siglens-core';
import { normalizeQuotaIp } from '@/entities/analysis/lib/normalizeQuotaIp';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    KST_OFFSET_HOURS,
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_SECOND,
} from '@/shared/config/time';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/**
 * 비회원 "하루 무료 전체 공개" 미터가 시작되는 시각(KST 2026-10-18 00:00).
 *
 * 개인정보처리방침 v9(`db/seeds/terms/privacy/v9.md`)의 시행일과 **같아야** 한다 —
 * v9가 게스트 쿠키와 이 미터의 서버 보관 항목을 고지하므로, 시행 전에는 미터가
 * 아무것도 기록하면 안 된다. 이 시각 전에는 라우트가 미터를 부르지 않고 현행(잠금)으로
 * 동작한다. 가드 테스트(`src/__tests__/guards/meteredRevealStartsAtPrivacyV9.test.ts`)가 두 날짜를 묶어 둔다.
 */
export const METERED_REVEAL_STARTS_AT = new Date('2026-10-18T00:00:00+09:00');

/**
 * 같은 IP에서 하루에 공개받을 수 있는 서로 다른 종목 수의 상한.
 *
 * 쿠키를 지우고 다시 받는 방식의 남용을 막는 **백스톱**이다. 통신사 NAT·사무실처럼 한
 * IP를 여럿이 쓰는 곳에서는 먼저 쓴 사람이 몫을 가져갈 수 있는데, 소프트 미터라
 * 허용한다 — 최악이 "현행 잠금으로의 후퇴"일 뿐이다. 개인 한도(`policy.dailySymbols`)보다
 * 넉넉하게 잡아 정상 사용자가 걸리지 않게 한다.
 */
export const IP_DAILY_SYMBOL_CAP = 3;

const GUEST_KEY_PREFIX = 'meter:reveal:g';
const IP_KEY_PREFIX = 'meter:reveal:ip';

/** Lua 반환값: 이미 공개한 종목. */
const LUA_EXISTING = 1;
/** Lua 반환값: 이번에 새로 기록하고 공개(IP 집합에도 새로 넣음). */
const LUA_NEW = 2;
/**
 * Lua 반환값: 이번에 새로 기록하고 공개했지만, 같은 IP의 다른 방문자가 오늘 이미 이
 * 종목을 열어 IP 집합에는 이미 있었다. 되돌릴 때 IP 집합은 건드리지 않는다 — 남의
 * 기록을 지워 IP 백스톱이 느슨해지지 않게.
 */
const LUA_NEW_IP_SHARED = 3;

/**
 * 판정과 기록을 한 번에 한다(동시에 두 종목을 열어도 둘 다 공개받는 경쟁이 없다).
 *
 * KEYS[1]=게스트 집합, KEYS[2]=IP 집합 / ARGV: 종목, 개인 상한, IP 상한, 만료 시각(epoch 초).
 * 반환: 1=기존 공개, 2=신규 공개, 3=신규 공개(IP 집합엔 이미 있음), 0=소진.
 */
export const DECIDE_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return ${LUA_EXISTING} end
if redis.call('SCARD', KEYS[1]) < tonumber(ARGV[2]) and redis.call('SCARD', KEYS[2]) < tonumber(ARGV[3]) then
  redis.call('SADD', KEYS[1], ARGV[1])
  local ipAdded = redis.call('SADD', KEYS[2], ARGV[1])
  redis.call('EXPIREAT', KEYS[1], ARGV[4])
  redis.call('EXPIREAT', KEYS[2], ARGV[4])
  if ipAdded == 1 then return ${LUA_NEW} end
  return ${LUA_NEW_IP_SHARED}
end
return 0
`;

/** 신규로 기록한 종목을 게스트 집합에서 되돌린다. KEYS[1]=게스트 집합 / ARGV[1]=종목. */
const RELEASE_GUEST_SCRIPT = `return redis.call('SREM', KEYS[1], ARGV[1])`;

/** 게스트·IP 두 집합 모두에서 되돌린다(이번 요청이 IP 집합에도 새로 넣은 경우). */
const RELEASE_BOTH_SCRIPT = `
redis.call('SREM', KEYS[1], ARGV[1])
redis.call('SREM', KEYS[2], ARGV[1])
return 1
`;

export type MeterDecision =
    | {
          readonly state: 'revealed';
          /** 이번 호출이 새로 기록했는가. 재방문(기존 공개)이면 false. */
          readonly isNew: boolean;
          /**
           * 신규 기록을 되돌린다. 결과를 못 보여 준 요청(에러·미생성·한도 초과 폴백)이
           * 공개 횟수를 쓰지 않게 한다. 신규가 아니면 아무것도 하지 않는다.
           */
          readonly release: () => Promise<void>;
      }
    | { readonly state: 'exhausted' }
    /** Redis·pepper 문제 — fail-closed라 호출자는 현행(잠금)으로 처리한다. */
    | { readonly state: 'unavailable' };

export interface MeteredRevealInput {
    /** 서명 검증된 게스트 id. 쿠키 발급까지 실패해 없으면 null → unavailable. */
    readonly guestId: string | null;
    readonly clientIp: string;
    readonly symbol: string;
    readonly policy: MeteredRevealPolicy;
    readonly now: Date;
}

/** 다음 KST 자정의 epoch 초. 키는 그 시각에 자동 삭제된다(방침 v9 고지와 같다). */
export function nextKstMidnightEpochSeconds(now: Date): number {
    const offsetMs = KST_OFFSET_HOURS * MS_PER_HOUR;
    const kstDayStart =
        Math.floor((now.getTime() + offsetMs) / MS_PER_DAY) * MS_PER_DAY;
    return Math.floor((kstDayStart + MS_PER_DAY - offsetMs) / MS_PER_SECOND);
}

/**
 * IP 키 조각 — 원 IP를 Redis에 남기지 않는다. KST 날짜를 섞어 날마다 다른 값이 되게
 * 해, 자정 이후 키가 사라진 뒤에는 같은 IP를 이어 볼 수 없다.
 */
function ipKeyPart(pepper: string, kstDate: string, ip: string): string {
    return createHmac('sha256', pepper)
        .update(`${kstDate}:${ip}`)
        .digest('hex');
}

/**
 * 비회원이 이 종목을 오늘 무료로 전체 공개받는지 판정하고(필요하면 기록한다) 돌려준다.
 *
 * - 오늘 이미 공개한 종목이면 계속 공개(새로고침·타임프레임 전환).
 * - 오늘 개인 상한(`policy.dailySymbols`)·IP 상한({@link IP_DAILY_SYMBOL_CAP})이 남았으면 새로 공개.
 * - 아니면 소진.
 * - IP를 모르면 소진(IP 백스톱을 걸 수 없다). pepper 누락·Redis 장애는 `unavailable`
 *   (공개 쪽으로 실패하면 무제한 공개가 되므로 fail-closed).
 */
export async function decideMeteredReveal(
    input: MeteredRevealInput
): Promise<MeterDecision> {
    const { guestId, clientIp, symbol, policy, now } = input;
    const ip = normalizeQuotaIp(clientIp);
    if (ip === UNKNOWN_CLIENT_IP) return { state: 'exhausted' };
    if (guestId === null) {
        console.warn('[meter] no guest id — treating as unavailable');
        return { state: 'unavailable' };
    }
    const pepper = process.env.VISITOR_HASH_PEPPER ?? '';
    if (pepper === '') {
        console.warn('[meter] VISITOR_HASH_PEPPER is not set — meter is off');
        return { state: 'unavailable' };
    }
    const redis = getRedisClient();
    if (redis === null) {
        console.warn('[meter] redis is not configured — meter is off');
        return { state: 'unavailable' };
    }

    const kstDate = kstDateKey(now);
    const keys = [
        `${GUEST_KEY_PREFIX}:${kstDate}:${guestId}`,
        `${IP_KEY_PREFIX}:${kstDate}:${ipKeyPart(pepper, kstDate, ip)}`,
    ];
    const member = symbol.toUpperCase();

    let verdict: unknown;
    try {
        verdict = await redis.eval(DECIDE_SCRIPT, keys, [
            member,
            policy.dailySymbols,
            IP_DAILY_SYMBOL_CAP,
            nextKstMidnightEpochSeconds(now),
        ]);
    } catch (error) {
        console.warn('[meter] redis unavailable', error);
        return { state: 'unavailable' };
    }

    if (
        verdict === LUA_EXISTING ||
        verdict === LUA_NEW ||
        verdict === LUA_NEW_IP_SHARED
    ) {
        const isNew = verdict !== LUA_EXISTING;
        return {
            state: 'revealed',
            isNew,
            release: async () => {
                if (!isNew) return;
                try {
                    if (verdict === LUA_NEW) {
                        await redis.eval(RELEASE_BOTH_SCRIPT, keys, [member]);
                    } else {
                        await redis.eval(
                            RELEASE_GUEST_SCRIPT,
                            [keys[0]],
                            [member]
                        );
                    }
                } catch (error) {
                    console.warn('[meter] release failed', error);
                }
            },
        };
    }
    return { state: 'exhausted' };
}
