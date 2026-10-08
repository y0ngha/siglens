import 'server-only';

const SECRET_ENV = 'EMAIL_REPORT_SIGNING_SECRET';
const MIN_SECRET_LENGTH = 32;

/**
 * 메일 리포트 링크 서명용 비밀값. 없거나 너무 짧으면 `null` — 이때 발송 cron은 아무것도
 * 보내지 않고, 차트·수신거부 라우트는 모든 요청을 거부한다. 서명 없이 보내면 수신거부
 * 링크가 동작하지 않는 메일이 나가므로, 기능 전체를 끄는 쪽이 안전하다.
 */
export function readEmailReportSecret(): string | null {
    const value = process.env[SECRET_ENV];
    return value !== undefined && value.length >= MIN_SECRET_LENGTH
        ? value
        : null;
}
