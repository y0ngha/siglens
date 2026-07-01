/**
 * ISO 타임스탬프를 KST 기준 한국어 날짜+시간 표기로 변환한다.
 *
 * - 출력 형식: `YYYY년 M월 D일 H시 mm분` (KST, Asia/Seoul)
 * - 월/일/시는 leading-zero 없이 숫자만 표기한다 (1월, 9일, 3시 …).
 * - 분은 두 자리 zero-pad (01분, 47분).
 * - RSC 전용 — 서버 렌더링만 사용하므로 hydration 불일치 없음.
 * - 잘못된 ISO 입력은 빈 문자열 대신 원본 문자열을 그대로 반환한다 (graceful fallback).
 *
 * @example
 * formatKoreanDateTime('2026-06-30T14:47:00.000Z')
 * // → '2026년 6월 30일 23시 47분'  (KST = UTC+9)
 */
export function formatKoreanDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    // Intl.DateTimeFormat('ko-KR') 숫자 포맷은 Node/ICU 버전에 따라
    // '2026년 6월 30일' 같은 리터럴을 포함하거나 파트 경계가 달라질 수 있다.
    // 안전하게 각 숫자 파트만 추출해 직접 조합한다.
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find(p => p.type === type)?.value ?? '';

    // 일부 Node/ICU 버전은 hour12:false 에서 자정에 '24'를 반환한다.
    const rawHour = get('hour');
    const hour = rawHour === '24' ? '0' : rawHour;
    const minute = get('minute');

    return `${get('year')}년 ${get('month')}월 ${get('day')}일 ${hour}시 ${minute}분`;
}
