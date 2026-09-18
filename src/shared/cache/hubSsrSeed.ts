import 'server-only';
import { getRedisClient } from './redisClient';

/**
 * 프리웜이 만든 값을 **키가 흔들리지 않는 자리**에 보관하는 작은 read/write 쌍.
 *
 * ## 왜 있는가
 *
 * core의 AI 캐시 키는 입력에서 파생된다. 입력이 갱신되면 키가 바뀌므로, 크론이 쓴 값을
 * 나중에 페이지가 같은 키로 다시 읽을 보장이 없다 — 2026-09-18 실측에서 14:45에 쓰고
 * 되읽기까지 성공한 값이 15:00의 같은 경로 조회에서 miss였다. 읽는 쪽과 쓰는 쪽이 서로
 * 다른 스냅샷을 보기까지 한다.
 *
 * 그래서 크론이 **확인한 본문 자체**를 호출부가 정하는 고정 키에 한 벌 더 둔다. 생성
 * 경로는 계속 최신 입력을 쓰고(품질 유지), 읽기 경로가 miss일 때 이 값으로 물러난다.
 *
 * 키 이름은 **호출부가 소유한다** — 이 모듈은 네임스페이스 접두만 책임진다
 * (`shared/CLAUDE.md` 규칙 1: shared는 도메인 어휘를 알지 못한다).
 */

/**
 * TTL이 **유일한 신선도 방어선**이다.
 *
 * seed에는 생성 시각이 없다 — 저장하는 것이 본문뿐이고, 소비자(`BriefingCard`)는
 * 시각이 falsy면 그 행을 아예 숨긴다. 즉 seed로 그려진 내용은 나이를 드러내지 않는다.
 *
 * 그래서 프리웜 크론 창 사이 최대 공백(09:55→20:30 UTC ≈ 10시간 35분,
 * `docs/reference/CRON.md`) 바로 위로만 잡는다. 12h면 그 공백을 덮으면서 최악 노출을
 * 반나절로 묶는다. 더 늘리면 시각 표시도 없는 하루 지난 내용이 색인될 수 있고, 더 줄이면
 * 정상 운영 중에도 공백에서 seed가 만료돼 페이지가 다시 빈다.
 */
const SEED_TTL_SECONDS = 12 * 60 * 60;

const KEY_PREFIX = 'hub-ssr-seed';

function keyFor(surface: string): string {
    return `${KEY_PREFIX}:${surface}`;
}

/**
 * seed를 읽는다. Redis 미설정·장애·미보관은 전부 `null` — 호출부는 플레이스홀더로 떨어진다.
 */
export async function readHubSsrSeed<T>(surface: string): Promise<T | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    try {
        return (await redis.get<T>(keyFor(surface))) ?? null;
    } catch (error) {
        console.error(`[hub-ssr-seed] read failed: ${surface}`, error);
        return null;
    }
}

/**
 * seed를 쓴다. 실패는 삼킨다 — 프리웜의 본업(생성·무효화)을 이 부가 저장이 막으면 안 된다.
 */
export async function writeHubSsrSeed<T>(
    surface: string,
    value: T
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(keyFor(surface), value, { ex: SEED_TTL_SECONDS });
    } catch (error) {
        console.error(`[hub-ssr-seed] write failed: ${surface}`, error);
    }
}
