import { isE2E } from '@/shared/api/e2eEnv';

/**
 * E2E 환경에서는 Fake 구현체를, prod에서는 Real 구현체를 반환하는
 * 싱글턴 팩토리를 생성한다.
 *
 * 모든 `get{Fundamental,FinancialStatements,CongressTrades}DataProvider`,
 * `getMarketDataProvider`가 공유하는 패턴:
 * ```
 * let cached = null;
 * if (cached !== null) return cached;
 * if (isE2E()) { cached = loadFake(); return cached; }
 * cached = makeReal(); return cached;
 * ```
 *
 * ⚠️ Turbopack dead-code 제거 제약:
 * `require('./Fake…')` 리터럴 경로는 **반드시 호출 측 `loadFake` 클로저 안에**
 * 그대로 남아야 한다. Turbopack은 정적 리터럴 경로만 dead-code로 분석할 수 있어
 * 이 함수 내부로 경로를 이동하면 prod 번들에 Fake 코드가 포함된다.
 *
 * @param makeReal  prod용 Real 인스턴스 생성 함수
 * @param loadFake  E2E용 Fake 인스턴스 생성 함수 (내부에서 require('./Fake…') 호출)
 * @returns 첫 호출 시 인스턴스를 생성·저장하고 이후 호출은 캐시를 반환하는 팩토리 함수
 */
export function createE2EGatedSingleton<T>(
    makeReal: () => T,
    loadFake: () => T
): () => T {
    let cached: T | null = null;

    return (): T => {
        if (cached !== null) return cached;
        cached = isE2E() ? loadFake() : makeReal();
        return cached;
    };
}
