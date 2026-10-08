import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * 메일 리포트 링크 서명 — 차트 이미지 URL과 수신거부 링크가 쓴다.
 *
 * 두 링크 모두 로그인 없이 열려야 한다(메일 클라이언트는 쿠키 없이 이미지를 받고,
 * 수신거부는 로그인을 요구하면 안 된다). 그래서 링크가 우리가 만든 것인지 HMAC으로
 * 증명한다. 용도(`purpose`)를 서명 입력에 넣어 차트 서명을 수신거부에 재사용할 수 없게 한다.
 *
 * 만료가 없는 이유: 수신거부 링크는 몇 달 뒤 열어도 동작해야 하고, 차트 URL은 날짜가 키라
 * 같은 서명으로 다른 날 그림을 받을 수 없다. 비밀값을 바꾸면 기존 링크는 전부 무효가 된다.
 */
export type ReportSignaturePurpose = 'chart' | 'unsubscribe';

function digest(
    secret: string,
    purpose: ReportSignaturePurpose,
    value: string
): Buffer {
    return createHmac('sha256', secret).update(`${purpose}:${value}`).digest();
}

export function signReportValue(
    secret: string,
    purpose: ReportSignaturePurpose,
    value: string
): string {
    return digest(secret, purpose, value).toString('base64url');
}

/** 길이가 다르거나 형식이 깨진 서명도 던지지 않고 `false`. */
export function verifyReportValue(
    secret: string,
    purpose: ReportSignaturePurpose,
    value: string,
    signature: string
): boolean {
    const expected = digest(secret, purpose, value);
    const given = Buffer.from(signature, 'base64url');
    return given.length === expected.length && timingSafeEqual(given, expected);
}
