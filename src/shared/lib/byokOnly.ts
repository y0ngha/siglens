import type { KeyPolicy, Tier } from '@y0ngha/siglens-core';

/**
 * 분석을 요청하는 주체. 쿠키 액션은 `getCurrentUser()`·`resolveTierAndByok`로 만들고, 공개 API는
 * 인증된 키의 소유 회원으로 만든다 — 분석 본문은 어느 쪽인지 모른다.
 */
export interface AnalysisCaller {
    readonly userId: string | null;
    /** 호출자의 실제 tier. BYOK 전용이어도 그대로 넘긴다 — 타임프레임 접근·정보 깊이에만 쓰인다. */
    readonly tier: Tier;
    readonly userApiKey?: string;
    /**
     * `true`면 core에 `keyPolicy: 'byok-only'`를 보낸다: **모델 등급·tier와 무관하게** 사용자 키로만
     * LLM을 부르고 서버 키는 읽지 않으며 서버 키 provider fallback도 꺼진다. 캐시 적중은 키 없이도
     * 돌려준다 — 모든 종류가 같다(`skipEnqueueIfMiss`의 확인 호출은 core가 키 게이트 전에 적중을 돌려주고, 미스면
     * `miss_no_trigger`로 끝낸다). 공개 API(`/api/v1`)만 켠다 — 쿠키 액션은 켜지 않아
     * 기본 정책(`tier`)을 그대로 쓴다.
     */
    readonly byokOnly?: boolean;
}

/**
 * BYOK 전용 라우팅 불변식 위반 — 호출자 버그라 상위가 500으로 다룬다. 던지는 곳은 둘이다:
 * 키 없이(또는 빈 키로) 생성하려는 호출(`resolveCallerKeyOptions`), 그리고 BYOK 전용 표시 없이 생성하려는
 * 호출(공개 API 러너의 `run`). 둘 다 서버 키 경로가 열릴 수 있는 형태라 core를 부르기 전에 막는다.
 */
export class ByokOnlyRoutingError extends Error {
    constructor(reason: string) {
        super(`BYOK-only routing violated: ${reason}`);
        this.name = 'ByokOnlyRoutingError';
    }
}

/** core 분석 옵션에 그대로 펼쳐 넣는 키 관련 필드. */
export interface CallerKeyOptions {
    readonly keyPolicy?: Extract<KeyPolicy, 'byok-only'>;
    readonly userApiKey?: string;
}

/**
 * `caller`에서 core에 보낼 키 정책과 사용자 키를 **한 곳에서** 만든다. 러너는 `userApiKey`·`keyPolicy`를
 * 따로 조립하지 않고 이 결과만 펼친다 — `byokOnly` 호출자가 정책을 빠뜨린 채 core에 가는 일이 없다.
 *
 * - 쿠키 액션(`byokOnly` 아님): 기본 정책이므로 `keyPolicy`는 싣지 않고 키가 있으면 `userApiKey`만 싣는다.
 * - BYOK 전용: 항상 `keyPolicy: 'byok-only'`. 생성하는(`cacheOnly`가 아닌) 호출은 비어 있지 않은 사용자 키가
 *   반드시 있어야 하고, 없으면 core를 부르기 전에 던진다. 캐시 확인 호출은 키 없이 보낸다 — core가 적중이면
 *   그대로 돌려주고, 미스면 키 게이트 전에 `miss_no_trigger`로 끝난다.
 *
 * @throws {ByokOnlyRoutingError} BYOK 전용 호출자가 키 없이 생성하려 할 때.
 */
export function resolveCallerKeyOptions(
    caller: AnalysisCaller,
    cacheOnly: boolean
): CallerKeyOptions {
    // 쿠키 액션 경로는 예전과 바이트 단위로 같다 — 값을 가공하지 않고 그대로 싣는다.
    if (caller.byokOnly !== true)
        return caller.userApiKey === undefined
            ? {}
            : { userApiKey: caller.userApiKey };
    const userApiKey =
        caller.userApiKey === undefined || caller.userApiKey === ''
            ? undefined
            : caller.userApiKey;
    if (!cacheOnly && userApiKey === undefined)
        throw new ByokOnlyRoutingError(
            'generating call without a user API key'
        );
    return {
        keyPolicy: 'byok-only',
        ...(userApiKey === undefined ? {} : { userApiKey }),
    };
}
