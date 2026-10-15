import type { ITimeScaleApi, Time } from 'lightweight-charts';

/**
 * 사용자가 보던 시간축 자리 — **어느 봉들이 화면에 있었는가**(시각)와 양끝 여백(봉 수).
 *
 * 시간외 봉이 나중에 도착하면 시간축에 봉이 끼어들어 같은 논리 인덱스가 다른 봉을 가리킨다. 보던
 * 자리를 지키려면 인덱스가 아니라 **시각**으로 기억했다가, 새 데이터의 인덱스로 다시 옮겨야 한다.
 * 데이터를 바꾸기 **전에** 찍어야 한다 — `setData`가 보이는 범위 변경을 동기로 일으켜 그 뒤에는 이미
 * 밀려난 범위만 남는다(2026-10-15 실물 확인).
 */
export interface VisibleViewSnapshot {
    fromTime: Time;
    toTime: Time;
    /** 화면 왼쪽 끝이 첫 보이는 봉보다 더 왼쪽(빈 공간)으로 나간 봉 수. */
    leftPad: number;
    /** 화면 오른쪽 끝이 마지막 보이는 봉보다 더 오른쪽(빈 공간)으로 나간 봉 수. */
    rightPad: number;
}

export function snapshotVisibleView(
    timeScale: ITimeScaleApi<Time>
): VisibleViewSnapshot | null {
    const time = timeScale.getVisibleRange();
    const logical = timeScale.getVisibleLogicalRange();
    if (time === null || logical === null) return null;
    const fromIndex = timeScale.timeToIndex(time.from, true);
    const toIndex = timeScale.timeToIndex(time.to, true);
    if (fromIndex === null || toIndex === null) return null;
    return {
        fromTime: time.from,
        toTime: time.to,
        leftPad: Math.max(0, fromIndex - logical.from),
        rightPad: Math.max(0, logical.to - toIndex),
    };
}

/** 찍어 둔 자리를 **지금의** 시간축 인덱스로 옮겨 복원한다. 시각을 못 찾으면 `false`(호출부가 맞춤으로 폴백). */
export function restoreVisibleView(
    timeScale: ITimeScaleApi<Time>,
    snapshot: VisibleViewSnapshot
): boolean {
    const fromIndex = timeScale.timeToIndex(snapshot.fromTime, true);
    const toIndex = timeScale.timeToIndex(snapshot.toTime, true);
    if (fromIndex === null || toIndex === null) return false;
    timeScale.setVisibleLogicalRange({
        from: fromIndex - snapshot.leftPad,
        to: toIndex + snapshot.rightPad,
    });
    return true;
}
