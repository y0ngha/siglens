/**
 * 문자열 키 enum의 `labelMap`에 대해 프로토타입에 안전한 `unknown` 좁힘 가드를 만든다. 각
 * `*Content.ts`가 저장된 JSONB의 enum 값(trend·sentiment·axis 등)을 읽을 때 쓴다.
 *
 * `Object.hasOwn`을 쓴다 — `value in labelMap`으로 바꾸면 **안 된다**. `in`은 프로토타입 체인을
 * 타서 `'__proto__' in labelMap`이 `true`이고 `labelMap['__proto__']`가 `Object.prototype`을
 * 돌려주는데, React는 이를 자식으로 렌더하면 던진다("Objects are not valid as a React
 * child"). 손상된 JSONB enum 값(`__proto__`, `constructor`, `toString` 등)은 프로토타입 메서드로
 * 해석되지 않고 거부되어야 한다 — 프로덕션 500을 막는 가드다. 수정할 때도 `Object.hasOwn`과
 * `typeof value === 'string'` 검사를 모두 유지한다(객체·배열 같은 비문자열이 `Object.hasOwn`에
 * 닿으면 안 된다).
 */
export function createEnumGuard<T extends string>(
    labelMap: Record<T, string>
): (value: unknown) => value is T {
    return (value: unknown): value is T =>
        typeof value === 'string' && Object.hasOwn(labelMap, value);
}
