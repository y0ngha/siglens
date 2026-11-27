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
 *
 * 알림 메일의 `alert-manage`·`alert-unsubscribe`도 만료가 없다. 설정 링크에만 만료를 걸면 메일 하단의
 * 수신거부 링크(같은 설정 페이지의 "모두 그만 받기" 구역을 여는 링크)가 함께 죽어, 오래된 메일에서 수신을
 * 끊을 수 없게 된다. 대신 설정 링크가 주는 권한을 좁혀 두었다: 링크 소유자(`{ kind: 'link' }`)는 그 구독자의
 * 항목을 지우거나 구독자 행을 지울 수만 있고, 항목을 더하거나 보유종목 함께 받기를 바꿀 수 없으며, 화면에는
 * 가린 주소만 나온다. 회원 연결 행도 같은 규칙이다. 구독자 id는 추측할 수 없는 UUID이고 행이 지워지면 링크는
 * 아무것도 가리키지 않으며, 유출을 의심하면 비밀값을 바꿔 전부 무효로 만든다.
 * `alert-session`(쿠키)은 이와 달리 발급 시각을 서명에 넣어 서버가 만료를 강제한다(`mailAlertCookie.ts`).
 */
export type ReportSignaturePurpose =
    | 'chart'
    | 'unsubscribe'
    /** 알림 메일: 게스트 브라우저 쿠키가 담는 구독자 id. */
    | 'alert-session'
    /** 알림 메일: 메일 속 설정 링크. */
    | 'alert-manage'
    /** 알림 메일: 메일 속 수신거부 링크. */
    | 'alert-unsubscribe'
    /** 시그렌즈 AI 대화의 가격대 알림 제안 토큰. 만들기 버튼이 누르는 액션이 값과 서명을 함께 검증한다. */
    | 'price-alert-proposal';

function digest(
    secret: string,
    purpose: ReportSignaturePurpose,
    value: string
): Buffer {
    return createHmac('sha256', secret).update(`${purpose}:${value}`).digest();
}

/** `purpose`별로 분리된 HMAC-SHA256 서명(base64url). 메일 속 링크를 만들 때 쓴다. */
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
