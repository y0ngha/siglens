import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import {
    createRedisLease,
    type RedisLease,
} from '@/shared/cache/createRedisLease';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 평이화 생성을 인스턴스 사이에서 조율하는 Redis 키 두 개 — 생성 락과 실패 표시.
 *
 * 둘 다 저장 키와 같은 좌표(프롬프트 버전 · 로케일 · `input_digest`)로 잡는다. 저장 행
 * (`analysis_plain_texts`)이 내용 주소라 같은 좌표면 같은 결과이므로, 그 좌표 하나에서 LLM이
 * 한 번만 돌면 된다.
 *
 * 둘 다 **비용 장치이지 정확성 장치가 아니다.** Redis 미설정·장애면 락은 열리고(생성 허용)
 * 실패 표시는 "없음"으로 읽힌다 — 최악이 이 모듈 전의 동작(중복 생성, 실패 재시도)이다.
 */
export interface PlainGenerationKey {
    readonly promptVersion: string;
    readonly locale: Locale;
    readonly inputDigest: string;
}

/**
 * 한 번의 LLM 호출 상한(ms). 어댑터가 **스트림 본문 읽기까지 포함한 호출 전체**의 마감으로
 * 건다(`createCallDeadline`) — SDK의 `timeout`은 응답 헤더가 도착할 때까지만 재므로, 어댑터가
 * 본문을 따로 묶지 않으면 이 값은 느린 스트림을 끊지 못한다.
 *
 * 사이징 가정: 출력 상한 `PLAIN_MAX_OUTPUT_TOKENS`(4,000토큰)을 DeepSeek flash가 실측
 * 처리량으로 끝까지 쓰는 최악의 경우를 덮는다. `plainModel.ts`의 실측은 371~467토큰을
 * 4~6초에 냈다 = 약 75~100토큰/초. 4,000토큰 ÷ 75 ≈ 53초(빠르면 40초)다. 실측 하한에 딱 맞춘
 * 60초는 혼잡 시간대처럼 처리량이 조금만 떨어져도 정상 글을 끊으므로, 처리량이 실측 하한의
 * 약 60%(≈45토큰/초)까지 떨어져도 상한까지 쓴 글이 끝나도록 90초로 둔다. 정상 응답(수 초)에는
 * 영향이 없고, 늘어난 만큼은 락 TTL(보유자가 죽었을 때 다른 인스턴스가 기다리는 시간)로만 쓰인다.
 * 사용자 경로의 마감(15초)·프리웜의 마감(30초)은 **레이스일 뿐 요청을 끊지 못하므로**, 마감을
 * 넘긴 호출을 실제로 끊는 것은 이 값이다.
 *
 * 이 값이 곧 락 TTL(아래)의 기준이다 — TTL이 보유자가 죽었을 때 다른 인스턴스가 평이화를
 * 못 받는 시간이다.
 */
export const PLAIN_CALL_TIMEOUT_MS = 90_000;

/**
 * 평이화 한 번의 출력 토큰 상한.
 *
 * 예전에는 상한을 넘기지 않아 어댑터가 스펙 최대치(DeepSeek 393,216)를 그대로 보냈고,
 * 모델이 반복에 빠지면 그만큼 청구될 수 있었다. 그래서 상한을 두되, **잘리지 않는 것이
 * 우선**이다 — chat 어댑터는 `finish_reason: length`를 오류로 세우지 않아 잘린 글이
 * 가드를 통과해 그대로 저장·노출된다(2026-10-07 OPEN 분석이 "…회복되기 전"에서 끊긴 채
 * 표시됐다).
 *
 * 1,500은 "문단 하나, 실측 371~467토큰"을 전제로 잡은 값이었는데, 원본 분석이 긴 종목은
 * 쉽게보기도 여러 문단으로 길어져 그 전제가 깨졌다. 상한은 청구액이 아니라 폭주 방지선이라
 * (생성된 만큼만 청구된다) 넉넉히 둔다.
 */
export const PLAIN_MAX_OUTPUT_TOKENS = 4_000;

/** 사이징에 쓴 실측 최저 처리량(토큰/초) — `plainModel.ts`의 371~467토큰/4~6초 ≈ 75~100. */
export const PLAIN_MEASURED_MIN_TOKENS_PER_SECOND = 75;

/** 실측 하한 처리량에서 얼마나 더 느려져도 상한까지 쓴 글이 끝나야 하는지(비율). */
export const PLAIN_THROUGHPUT_SAFETY_FACTOR = 0.6;

/**
 * 한 생성(첫 시도 + 재시도 한 번)이 LLM을 부르는 최대 횟수. 락 TTL 계산에 쓴다.
 */
export const PLAIN_MAX_CALLS_PER_GENERATION = 2;

/** 락 TTL 여유분(초) — 가드 판정·DB 쓰기 등 LLM 호출 바깥의 시간. */
export const PLAIN_LOCK_MARGIN_SECONDS = 10;

/**
 * 생성 락 TTL(초). 한 생성이 가장 오래 걸리는 경우(호출 두 번이 모두 timeout까지 감)를
 * 덮는다. 첫 시도와 재시도 모두 어댑터 마감까지 가도 락이 먼저 만료되지 않는다 — 만료되면
 * 다른 인스턴스가 같은 좌표를 중복 생성·중복 과금한다.
 *
 * 2회를 유지하는 이유: 재시도는 첫 호출이 **정상 반환한 뒤 가드가 거부했을 때만** 일어난다.
 * 첫 호출이 마감으로 던지면 재시도하지 않으므로(`api.ts`의 `generate`) 그 경로의 최악은 1회지만,
 * 느린 호출이 가드 거부로 끝나 재시도까지 느린 경우는 여전히 2회다.
 *
 * 정상 경로는 생성이 끝나는 즉시 락을 푼다 — 이 값은 프로세스가 죽어 락을 못 푼
 * 경우에만 의미가 있고, 그동안 같은 좌표의 다른 인스턴스는 평이화를 받지 못한다(원본 노출).
 */
export const PLAIN_LOCK_TTL_SECONDS =
    (PLAIN_CALL_TIMEOUT_MS / MS_PER_SECOND) * PLAIN_MAX_CALLS_PER_GENERATION +
    PLAIN_LOCK_MARGIN_SECONDS;

/**
 * 실패 표시 TTL(초). 짧게 둔다 — 프로바이더 일시 장애로 생긴 표시가 오래 남으면 그동안
 * 그 분석은 쉽게보기가 없다. 반대로 가드 위반처럼 같은 입력이면 같은 식으로 실패하는 경우는
 * 이 간격마다 한 번씩만 다시 과금된다(예전: 조회마다 1~2회).
 */
const PLAIN_NEGATIVE_TTL_SECONDS = 5 * SECONDS_PER_MINUTE;

/**
 * Redis 왕복 상한(ms). `@upstash/redis`는 요청 단위 timeout이 없어, Redis가 매달리면 이 조율
 * 단계가 사용자 대기로 그대로 이어진다. 넘기면 fail-open 값(락 없음·표시 없음)으로 간다.
 *
 * 락 획득이 이 상한을 넘긴 뒤 늦게 성공하면 그 락은 아무도 풀지 않고 TTL로만 풀린다 — 그동안
 * 같은 좌표의 다른 인스턴스는 기다리다 물러난다. Redis가 1초 넘게 매달리는 드문 경우의
 * 비용이라 받아들인다.
 */
const PLAIN_COORDINATION_TIMEOUT_MS = 1_000;

const keyOf = (kind: 'lock' | 'failed', key: PlainGenerationKey): string =>
    `analysis-plain:${kind}:${key.promptVersion}:${key.locale}:${key.inputDigest}`;

const lock = createRedisLease<PlainGenerationKey>(
    key => keyOf('lock', key),
    PLAIN_LOCK_TTL_SECONDS,
    '[analysisPlain:lock]'
);

const failedFlag = createRedisFlag<PlainGenerationKey>(
    key => keyOf('failed', key),
    PLAIN_NEGATIVE_TTL_SECONDS,
    '[analysisPlain:failed]'
);

/** `work`가 `ms` 안에 끝나지 않으면 `fallback`. 타이머는 끝나는 즉시 정리한다. */
async function settleWithin<T>(
    work: Promise<T>,
    ms: number,
    fallback: T
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<T>(resolve => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    try {
        return await Promise.race([work, expiry]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

const UNAVAILABLE: RedisLease = { status: 'unavailable' };

/**
 * 생성 락을 잡는다(토큰 값으로 `SET NX EX`).
 *
 * - `acquired`: 이번 호출이 잡았다. 생성이 끝나면 {@link releasePlainGenerationLock}으로 푼다.
 * - `held`: 다른 인스턴스가 생성 중이다.
 * - `unavailable`: Redis 미설정·장애·지연 — fail-open이라 생성해도 되지만 풀 락은 없다.
 */
export function tryAcquirePlainGenerationLock(
    key: PlainGenerationKey
): Promise<RedisLease> {
    return settleWithin(
        lock.tryAcquire(key),
        PLAIN_COORDINATION_TIMEOUT_MS,
        UNAVAILABLE
    );
}

/**
 * 잡은 락을 푼다 — 저장된 토큰이 이 락의 것일 때만 지운다(compare-and-delete). TTL이 먼저
 * 만료돼 다른 인스턴스가 새로 잡았다면 그 락은 건드리지 않는다. 실패는 삼킨다.
 */
export function releasePlainGenerationLock(
    lease: Extract<RedisLease, { status: 'acquired' }>
): Promise<void> {
    return settleWithin(
        lease.release(),
        PLAIN_COORDINATION_TIMEOUT_MS,
        undefined
    );
}

/** 최근에 이 좌표의 생성이 실패했는지. Redis 미설정·장애·지연은 false. */
export function hasPlainGenerationFailedRecently(
    key: PlainGenerationKey
): Promise<boolean> {
    return settleWithin(
        failedFlag.isSet(key),
        PLAIN_COORDINATION_TIMEOUT_MS,
        false
    );
}

/** 이 좌표의 생성이 실패했다고 표시한다(`PLAIN_NEGATIVE_TTL_SECONDS`). 실패는 삼킨다. */
export function markPlainGenerationFailed(
    key: PlainGenerationKey
): Promise<void> {
    return settleWithin(
        failedFlag.mark(key),
        PLAIN_COORDINATION_TIMEOUT_MS,
        undefined
    );
}
