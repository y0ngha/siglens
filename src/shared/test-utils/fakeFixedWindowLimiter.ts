interface LimitRule {
    readonly key: string;
    readonly limit: number;
    readonly windowSeconds: number;
}

interface FakeFixedWindowLimiter {
    /** `checkFixedWindowRateLimit`과 같은 의미: 호출 한 번이 시도 한 번, `limit` 이하면 허용. */
    rateLimit: (rule: LimitRule) => Promise<boolean>;
    /** 카운터를 0으로 되돌린다(`resetCounter` 포트). */
    resetCounter: (key: string) => Promise<void>;
    /** 호출된 규칙을 순서대로 담는다. 인덱스로 단언하지 말고 key로 찾는다. */
    calls: LimitRule[];
    /** 지금 카운터 값. */
    count: (key: string) => number;
}

/**
 * 실제 고정 창 구현(SET NX EX 후 INCR)의 카운팅만 흉내 내는 메모리 구현. 창 만료는 다루지 않는다.
 * 흐름 테스트가 한도 모킹 대신 실제 증가·초기화 동작으로 단언하게 한다.
 */
export function createFakeFixedWindowLimiter(): FakeFixedWindowLimiter {
    const counters = new Map<string, number>();
    const calls: LimitRule[] = [];
    return {
        rateLimit: async rule => {
            calls.push(rule);
            const next = (counters.get(rule.key) ?? 0) + 1;
            counters.set(rule.key, next);
            return next <= rule.limit;
        },
        resetCounter: async key => {
            counters.delete(key);
        },
        calls,
        count: key => counters.get(key) ?? 0,
    };
}
