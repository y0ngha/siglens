// Length of the 'YYYY-MM-DD HH:mm' prefix — used as a fallback slice boundary
// for non-ISO inputs (e.g. malformed strings).
const ANALYZED_AT_DISPLAY_LENGTH = 16;

// 사용자 노출 시각은 KST로 표기한다. Asia/Seoul 고정 — DST가 없어 ICU/Node 버전
// 차이로 결과가 흔들리지 않는다. en-CA 로케일은 YYYY-MM-DD 포맷을 강제하므로
// 다른 로케일에서 발생하는 '2026. 05. 22.' 같은 문자열을 피한다.
const KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // `hour12: false`가 아니라 `hourCycle: 'h23'` — 일부 Node/ICU 버전은
    // `hour12: false`를 h24로 풀어 자정을 '24'로 낸다. h23은 항상 00~23이다.
    hourCycle: 'h23',
});

/**
 * ISO 타임스탬프를 사용자가 즉시 환산할 수 있는 KST 표기로 변환한다.
 *
 * - 출력 형식: `YYYY-MM-DD HH:mm` (KST 기준)
 * - `<time dateTime={iso}>`에는 원본 ISO가 그대로 들어가므로 SEO / 스크린리더는
 *   영향 없음 — 본 함수는 시각적 표기만 담당한다.
 * - 잘못된 ISO 입력은 그대로 16자 잘라 fallback (기존 동작 호환).
 */
export function formatAnalyzedAt(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso.slice(0, ANALYZED_AT_DISPLAY_LENGTH);
    }
    const parts = KST_FORMATTER.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find(p => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
