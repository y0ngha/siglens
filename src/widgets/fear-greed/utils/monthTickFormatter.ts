import { TickMarkType, type Time } from 'lightweight-charts';

/**
 * 1년 시계열이라 월 단위 눈금만 쓴다. 기본 포매터는 월 눈금이 앞 눈금과 붙으면 그것을
 * 건너뛰고 그 오른쪽 일(day) 눈금을 남겨, 마지막 눈금이 "10월" 대신 "5일"로 찍힌다.
 * 일 눈금은 빈 문자열로 지우고, 나머지는 `null`로 기본 포맷(월·연)에 맡긴다.
 * 고정된 1년 화면 전제다 — 그래서 차트 옵션에서 확대(`handleScale: false`)를 막는다. 확대를
 * 허용하면 일 눈금이 전부 사라지므로 이 포매터를 다시 본다.
 */
export function monthTickFormatter(
    _time: Time,
    type: TickMarkType
): string | null {
    return type === TickMarkType.DayOfMonth ? '' : null;
}
