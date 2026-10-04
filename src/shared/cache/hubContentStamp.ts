import 'server-only';
import { createHash } from 'node:crypto';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getRedisClient } from '@/shared/cache/redisClient';

/**
 * 허브 본문이 **처음 나타난 시각**을 보관한다 — RSS `pubDate`의 근거다.
 *
 * ## 왜 있는가
 *
 * 허브 AI 본문(시장·거시 브리핑, 뉴스 다이제스트)의 캐시 값에는 생성 시각이 없다
 * (core `peek*Cache`는 본문만 돌려주고, `hubSsrSeed`도 본문만 저장한다). RSS 항목에는
 * 실제 시각이 필요하고 지어낸 날짜는 쓰지 않는다. 그래서 크론이 본문을 확인할 때마다
 * 본문 해시를 이 자리에 대조해, **내용이 바뀐 순간**만 시각을 갱신한다.
 *
 * 읽는 쪽(RSS)은 자기가 읽은 본문의 해시가 여기 저장된 해시와 같을 때만 그 시각을
 * 쓴다 — 크론이 본 적 없는 본문은 항목이 되지 않는다.
 *
 * 키 이름은 호출부가 소유한다(`hubSsrSeed`와 같은 규약) — 이 모듈은 접두만 책임진다.
 */

/**
 * 저장 기간 7일 — **마지막 확인 이후**의 보관 기간이다.
 *
 * 크론이 같은 본문을 다시 확인할 때마다 TTL을 되돌린다(`recordHubContentStamp`). 그래서 본문이
 * 바뀌지 않는 동안에는 키가 만료되지 않고 `at`이 첫 확인 시각으로 남는다. 크론이 7일 넘게
 * 확인하지 못한 표면(삭제된 카테고리 등)만 만료돼 저장량이 묶인다.
 */
export const STAMP_TTL_SECONDS = 7 * SECONDS_PER_DAY;

const KEY_PREFIX = 'hub-content-stamp';

export interface HubContentStamp {
    /** 본문의 안정 직렬화 sha256 hex. */
    readonly hash: string;
    /** 이 해시가 **처음** 확인된 시각(ISO). */
    readonly at: string;
}

function keyFor(surface: string): string {
    return `${KEY_PREFIX}:${surface}`;
}

/**
 * 키 순서에 영향받지 않는 JSON 직렬화. 객체 키를 재귀적으로 정렬한다.
 *
 * `JSON.stringify`와 같은 규칙으로 `undefined`·함수는 객체에서 빠지고 배열에서는
 * `null`이 된다 — 크론은 core가 준 객체를, 페이지는 `unstable_cache`(JSON 왕복)를 거친
 * 객체를 해시하므로 이 규칙이 달라지면 같은 본문이 다른 해시가 된다.
 */
function stableStringify(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'object') {
        const withToJson = value as { toJSON?: () => unknown };
        if (typeof withToJson.toJSON === 'function') {
            return stableStringify(withToJson.toJSON());
        }
        if (Array.isArray(value)) {
            return `[${value.map(item => stableStringify(item)).join(',')}]`;
        }
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined && typeof v !== 'function')
            .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
        return `{${entries.join(',')}}`;
    }
    if (value === undefined || typeof value === 'function') return 'null';
    return JSON.stringify(value);
}

export function hashHubBody(body: unknown): string {
    return createHash('sha256').update(stableStringify(body)).digest('hex');
}

function isStamp(value: unknown): value is HubContentStamp {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.hash === 'string' && typeof candidate.at === 'string'
    );
}

/**
 * 저장된 스탬프를 읽는다. Redis 미설정·장애·미보관·모양 불일치는 전부 `null`.
 *
 * Upstash `get`은 저장한 JSON을 **파싱해서** 돌려준다(문자열이 아니다).
 */
export async function readHubContentStamp(
    surface: string
): Promise<HubContentStamp | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    try {
        const stored = await redis.get<unknown>(keyFor(surface));
        return isStamp(stored) ? stored : null;
    } catch (error) {
        console.error(`[hub-content-stamp] read failed: ${surface}`, error);
        return null;
    }
}

/**
 * 본문을 확인했음을 기록한다.
 *
 * 해시가 저장된 것과 같으면 **`at`을 그대로 두고** TTL만 되돌린다 — `at`이 "그 내용이 처음
 * 나타난 시각"으로 남아야 한다(RSS `pubDate`). 크론은 같은 본문을 5분마다 다시 확인하므로
 * 매번 덮어쓰면 pubDate가 항상 "방금"이 된다. TTL을 되돌리지 않으면 7일 넘게 안 바뀐 본문의
 * 키가 만료돼 다음 확인 때 `at`이 늦은 시각으로 새로 찍힌다 — 그래서 크론이 본문을 계속
 * 확인하는 한 pubDate는 첫 확인 시각으로 유지된다.
 *
 * 남은 TTL이 절반 이상이면 쓰지 않는다. tick마다(5분) 표면 수만큼 SET을 내지 않으려는 것이고,
 * 절반 밑으로 내려오면 되돌리므로 만료는 일어나지 않는다.
 *
 * 실패는 삼킨다 — 부가 저장이 프리웜의 본업(생성·무효화)을 막으면 안 된다.
 */
export async function recordHubContentStamp(
    surface: string,
    body: unknown,
    now: Date
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        const hash = hashHubBody(body);
        const existing = await redis.get<unknown>(keyFor(surface));
        if (isStamp(existing) && existing.hash === hash) {
            const remaining = await redis.ttl(keyFor(surface));
            // -1(만료 없음)·-2(키 없음)도 되돌린다 — 정상 흐름에서는 나오지 않는 값이라
            // 만료 없는 키가 남았다면 TTL을 다시 붙이는 쪽이 안전하다.
            if (remaining >= STAMP_TTL_SECONDS / 2) return;
            await redis.set(
                keyFor(surface),
                { hash: existing.hash, at: existing.at },
                { ex: STAMP_TTL_SECONDS }
            );
            return;
        }
        const stamp: HubContentStamp = { hash, at: now.toISOString() };
        await redis.set(keyFor(surface), stamp, { ex: STAMP_TTL_SECONDS });
    } catch (error) {
        console.error(`[hub-content-stamp] record failed: ${surface}`, error);
    }
}
