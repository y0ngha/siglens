/**
 * 알림 메일을 신청한 브라우저가 가진 쿠키 이름. 값은 `<구독자 id>.<발급 시각(초)>.<서명>`이고 서명은 서버가
 * (`alert-session` 용도로 `<id>.<발급 시각>`에) 만든다 — 이 모듈은 모양만 다루는 순수 함수다.
 */
export const MAIL_ALERT_COOKIE_NAME = 'siglens_mail_alert';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEPARATOR = '.';

export function isSubscriberId(value: string): boolean {
    return UUID_PATTERN.test(value);
}

/** 서명이 덮는 문자열. 발급 시각이 들어가 있어 만료를 서버가 쿠키 수명(`Max-Age`)과 별개로 강제한다. */
export function mailAlertCookieSigningValue(
    subscriberId: string,
    issuedAtSeconds: number
): string {
    return `${subscriberId}${SEPARATOR}${issuedAtSeconds}`;
}

export function encodeMailAlertCookie(
    subscriberId: string,
    issuedAtSeconds: number,
    signature: string
): string {
    return `${mailAlertCookieSigningValue(subscriberId, issuedAtSeconds)}${SEPARATOR}${signature}`;
}

/** 모양이 어긋난 값은 `null`. 서명과 만료는 호출자가 검증한다. */
export function decodeMailAlertCookie(raw: string | undefined): {
    readonly subscriberId: string;
    readonly issuedAtSeconds: number;
    readonly signature: string;
} | null {
    if (raw === undefined) return null;
    const [subscriberId = '', issued = '', ...rest] = raw.split(SEPARATOR);
    const signature = rest.join(SEPARATOR);
    const issuedAtSeconds = Number(issued);
    return isSubscriberId(subscriberId) &&
        /^\d+$/.test(issued) &&
        Number.isSafeInteger(issuedAtSeconds) &&
        signature !== ''
        ? { subscriberId, issuedAtSeconds, signature }
        : null;
}
