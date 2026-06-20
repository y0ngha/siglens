const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR');

/**
 * 숫자를 ko-KR 로케일(천 단위 구분자)로 포맷한 뒤 단위 접미사를 붙여 반환한다.
 * `v`가 null/undefined 또는 NaN/±Infinity(비유한수)이면 'N/A'를 반환한다.
 *
 * @param v - 포맷할 숫자. null/undefined/NaN/±Infinity이면 'N/A' 반환.
 * @param unit - 숫자 뒤에 붙을 단위 문자열 (예: '원', '%', 'B').
 */
export function formatNum(v: number | null, unit: string): string {
    if (!Number.isFinite(v)) return 'N/A';
    // `!Number.isFinite` guard above ensures v is a finite number here.
    return `${NUMBER_FORMATTER.format(v as number)}${unit}`;
}
