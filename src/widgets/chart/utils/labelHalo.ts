/**
 * 차트 위에 떠 있는 범례·pane 라벨 글자에 두르는 halo(`text-shadow` 값).
 *
 * 상자를 불투명하게 깔면 대비는 지켜지지만 지표선이 상자에 가려 끊겨 보인다.
 * 글자 획 둘레만 배경색으로 덮으면 선은 보이고, 글자 대비는 "빈 배경 위"
 * 값에 가깝게 유지된다(4방향 1px + 2px 흐림). 색은 알파 없는 차트 배경을 쓴다 —
 * 알파면 뒤에 무엇이 지나가느냐에 따라 대비가 다시 흔들린다.
 */
export function labelHalo(color: string): string {
    return [
        `1px 0 0 ${color}`,
        `-1px 0 0 ${color}`,
        `0 1px 0 ${color}`,
        `0 -1px 0 ${color}`,
        `0 0 2px ${color}`,
    ].join(', ');
}
