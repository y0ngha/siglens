import { requiresByokKey, type ModelId, type Tier } from '@y0ngha/siglens-core';

/**
 * core는 **모델 등급과 tier로** 서버 키 사용 여부를 정한다(`shouldUseServerKey`):
 * `free`·`member` 등급 모델이거나 `pro` tier면 `userApiKey`를 **무시하고** 서버 키를 쓴다.
 * 즉 "사용자 키를 넘겼다"는 사실만으로는 서버 키 fallback이 막히지 않는다.
 *
 * 공개 API(`/api/v1`)는 서버 비용을 쓰면 안 되므로 호출 전에 이 두 가지를 직접 보장한다:
 *  1. 모델이 `byok` 등급일 것 (`requiresByokKey`가 core의 분류와 같은 함수다).
 *  2. core에 넘기는 tier가 `pro`가 아닐 것 — `tierForByokOnly`가 `pro`를 `member`로 내린다.
 */
export function tierForByokOnly(tier: Tier): Tier {
    return tier === 'pro' ? 'member' : tier;
}

/**
 * 캐시 적중 확인용 자리표시 키. 캐시 조회는 core에서 BYOK 게이트(키 없으면 `key_error`) **뒤**에
 * 있어서, 키가 없는 사용자도 공유 캐시를 읽으려면 게이트를 통과할 값이 필요하다.
 *
 * 안전한 이유: `cacheOnly`(core의 `skipEnqueueIfMiss`)는 캐시가 비면 LLM 호출 전에
 * `miss_no_trigger`로 끝난다. 그리고 `assertByokOnlyRouting`이 이 값을 `cacheOnly`가 아닌 호출에는
 * 거절하고, 모델이 `byok` 등급·non-pro tier라 서버 키가 선택될 수도 없다 — 어느 경로로도
 * 이 문자열이 provider에 가거나 서버 키로 바뀌지 않는다.
 */
export const CACHE_PROBE_KEY_PLACEHOLDER = 'siglens-cache-probe-no-llm-call';

/**
 * 분석을 요청하는 주체. 쿠키 액션은 `getCurrentUser()`·`resolveTierAndByok`로 만들고, 공개 API는
 * 인증된 키의 소유 회원으로 만든다 — 분석 본문은 어느 쪽인지 모른다.
 */
export interface AnalysisCaller {
    readonly userId: string | null;
    readonly tier: Tier;
    readonly userApiKey?: string;
    /**
     * `true`면 서버 키가 선택될 수 있는 호출을 core에 보내기 전에 거절한다
     * (`assertByokOnlyRouting`). 쿠키 액션은 켜지 않는다(서버 키가 정책상 맞는 경로다).
     */
    readonly byokOnly?: boolean;
}

/** BYOK 전용 호출이 서버 키를 쓸 수 있는 형태로 만들어졌다 — 호출자 버그라 상위가 500으로 다룬다. */
export class ByokOnlyRoutingError extends Error {
    constructor(reason: string) {
        super(`BYOK-only routing violated: ${reason}`);
        this.name = 'ByokOnlyRoutingError';
    }
}

export interface ByokOnlyRoutingInput {
    readonly tier: Tier;
    readonly modelId: ModelId;
    readonly userApiKey: string | undefined;
    readonly cacheOnly: boolean;
}

/**
 * core를 부르기 직전 마지막 방어선. 서버 키가 선택되거나 키가 비어 있는 호출은 던진다.
 *
 * @throws {ByokOnlyRoutingError}
 */
export function assertByokOnlyRouting({
    tier,
    modelId,
    userApiKey,
    cacheOnly,
}: ByokOnlyRoutingInput): void {
    if (userApiKey === undefined || userApiKey === '')
        throw new ByokOnlyRoutingError('no user API key');
    if (userApiKey === CACHE_PROBE_KEY_PLACEHOLDER && !cacheOnly)
        throw new ByokOnlyRoutingError('cache-probe key on a generating call');
    if (!requiresByokKey(tier, modelId))
        throw new ByokOnlyRoutingError(
            `core would route ${modelId} on tier ${tier} to the server key`
        );
}

/** `caller.byokOnly`일 때만 검사한다. 쿠키 액션 경로는 그대로 통과한다. */
export function assertCallerRouting(
    caller: AnalysisCaller,
    modelId: ModelId,
    cacheOnly: boolean
): void {
    if (caller.byokOnly !== true) return;
    assertByokOnlyRouting({
        tier: caller.tier,
        modelId,
        userApiKey: caller.userApiKey,
        cacheOnly,
    });
}
