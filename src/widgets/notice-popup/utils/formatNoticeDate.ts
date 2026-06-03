/**
 * createdAt을 'YYYY.MM.DD 작성' 형태로 포맷한다(로컬 타임존).
 * 문자열 입력도 허용하며, 파싱 실패 시 빈 문자열을 반환한다.
 */
export function formatNoticeDate(dateInput: Date | string): string {
    const date =
        typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day} 작성`;
}
