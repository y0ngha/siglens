/**
 * `ModelListbox`의 키보드 이동 대상을 고른다. `current`는 선택 가능한 항목 안의 현재 위치이고,
 * 선택값이 목록에 없으면(고를 수 없게 된 모델이 선택돼 있는 경우) `-1`이다.
 *
 * 순환한다. 선택이 없을 때 ↑는 마지막 항목으로 간다(APG listbox: 포커스가 없는 상태에서
 * ↑는 끝에서 시작) — 단순 모듈러 연산이면 끝에서 두 번째로 떨어진다.
 * 처리 대상이 아닌 키·빈 목록은 `null`이라 호출부가 `preventDefault`를 건너뛴다.
 */
export function getListboxNextIndex(
    key: string,
    current: number,
    count: number
): number | null {
    if (count === 0) return null;
    switch (key) {
        case 'ArrowDown':
            return (current + 1) % count;
        case 'ArrowUp':
            return current === -1 ? count - 1 : (current - 1 + count) % count;
        case 'Home':
            return 0;
        case 'End':
            return count - 1;
        default:
            return null;
    }
}
