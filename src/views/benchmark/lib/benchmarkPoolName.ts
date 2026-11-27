/**
 * 문항 풀 id → 화면 이름 (서버 본문과 클라이언트 탐색기가 함께 쓴다).
 */

/**
 * 화면에 보이는 문항 풀 이름. 원자료의 풀 id(`primary`, `aux`)는 내부 값이라 사용자에게 그대로
 * 보여 주지 않는다. 레벨 이름과 같은 `L4`, `L5` 풀은 id가 곧 이름이라 맵에 없다.
 */
type NamedPool = 'primary' | 'aux';

export type BenchmarkPoolNames = Readonly<Record<NamedPool, string>>;

function isNamedPool(pool: string): pool is NamedPool {
    return pool === 'primary' || pool === 'aux';
}

/** 풀 id → 화면 이름. 맵에 없는 id는 그대로 쓴다. */
export function benchmarkPoolName(
    pool: string,
    names: BenchmarkPoolNames
): string {
    return isNamedPool(pool) ? names[pool] : pool;
}
