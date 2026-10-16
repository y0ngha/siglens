/** 줄이기를 되풀이하는 최대 횟수. 비례 추정이라 한 번에 안 맞을 수 있어 몇 번 더 줄이되 무한히 돌지 않게 한다. */
export const MAX_SHRINK_ATTEMPTS = 8;

export interface Shrunk<T> {
    data: T;
    /** 상한 때문에 요청보다 적은 봉을 돌려준다. */
    limited: boolean;
}

/**
 * `build(count)`가 만든 결과의 JSON 길이가 `limit`을 넘으면 오래된 봉부터 줄여(최신 봉을 남긴다) 상한 안에
 * 맞춘다. 순수 함수 — 가변 상태 없이 재귀로 `MAX_SHRINK_ATTEMPTS`번까지 다시 만든다. 봉이 하나만 남으면
 * 더 줄이지 않는다(그때는 상한을 넘더라도 돌려준다).
 */
export function shrinkToLimit<T extends { bars: number }>(
    build: (count: number) => T,
    count: number,
    limit: number
): Shrunk<T> {
    const step = (data: T, attempt: number): Shrunk<T> => {
        const length = JSON.stringify(data).length;
        if (length <= limit || data.bars <= 1 || attempt >= MAX_SHRINK_ATTEMPTS)
            return { data, limited: attempt > 0 };
        const estimate = Math.floor((data.bars * limit) / length) - 1;
        const next = Math.max(1, Math.min(estimate, data.bars - 1));
        return step(build(next), attempt + 1);
    };
    return step(build(count), 0);
}
