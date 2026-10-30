/**
 * `strikes` 중 `target`에 가장 가까운 행사가의 인덱스를 돌려준다.
 *
 * 빈 입력이면 -1이다. 두 행사가가 같은 거리면 앞선 인덱스가 이긴다. OI 차트(x축 위치에
 * 인덱스가 필요)와 체인 테이블(그 인덱스의 행사가로 ATM 행을 강조)이 함께 쓰므로 값이
 * 아니라 인덱스를 노출한다 — 값은 호출자가 `strikes[result]`로 읽는다.
 */
export function findNearestStrikeIndex(
    strikes: ReadonlyArray<number>,
    target: number
): number {
    if (strikes.length === 0) return -1;
    return strikes.reduce(
        (best, strike, i) => {
            const d = Math.abs(strike - target);
            return d < best.dist ? { idx: i, dist: d } : best;
        },
        { idx: 0, dist: Math.abs(strikes[0] - target) }
    ).idx;
}
