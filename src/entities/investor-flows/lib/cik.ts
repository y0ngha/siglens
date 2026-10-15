/** CIK는 DB에 정수로 저장한다(10자리 0 패딩은 표시·URL 형식일 뿐이다). */
export function cikToInt(cik: string): number {
    return Number(cik);
}

/** 10자리 0 패딩 CIK 문자열. */
export function cikToString(cik: number): string {
    return String(cik).padStart(10, '0');
}
