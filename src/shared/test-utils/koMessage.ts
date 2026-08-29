import koMessages from '../../../messages/ko.json';

/**
 * ko 카탈로그에서 메시지를 꺼낸다 — 테스트가 기대값을 만들 때 쓴다.
 *
 * 내비 라벨처럼 설정이 **키만** 들고 있는 값을 검증할 때, 기대 문자열을 테스트에
 * 다시 적으면 카탈로그와 갈라져도 통과한다(MISTAKES #13.5). 실제 카탈로그에서
 * 꺼내면 키가 빠졌을 때 `undefined`로 즉시 실패한다.
 */
export function koMessage(path: string): string {
    const value = path
        .split('.')
        .reduce<unknown>(
            (node, segment) =>
                typeof node === 'object' && node !== null
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            koMessages
        );
    if (typeof value !== 'string') {
        throw new Error(`[koMessage] ko 카탈로그에 없는 키: ${path}`);
    }
    return value;
}
