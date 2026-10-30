/**
 * 캘린더 그리드(클라이언트)로 넘기기 전에 `analyzedAt`을 실제로 떼어낸다. 그리드는 이 값을 읽지
 * 않는데, 타입에서 빼는 것만으로는 런타임 값이 flight 페이로드에 그대로 실린다. `/economy`와
 * `/economy/kr`가 같은 그리드를 쓰므로 둘 다 이 함수를 거친다.
 */
export function calendarEventsForClient<T extends { analyzedAt: unknown }>(
    events: readonly T[]
): Omit<T, 'analyzedAt'>[] {
    return events.map(({ analyzedAt: _analyzedAt, ...rest }) => rest);
}
