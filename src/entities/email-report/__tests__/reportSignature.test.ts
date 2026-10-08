import {
    signReportValue,
    verifyReportValue,
} from '@/entities/email-report/lib/reportSignature';

const SECRET = 'test-secret-that-is-long-enough-123456';

describe('reportSignature', () => {
    it('같은 비밀값·용도·값으로 만든 서명은 검증을 통과한다', () => {
        const sig = signReportValue(SECRET, 'chart', 'AAPL:2026-10-08');

        expect(verifyReportValue(SECRET, 'chart', 'AAPL:2026-10-08', sig)).toBe(
            true
        );
    });

    it('값이 다르면 실패한다', () => {
        const sig = signReportValue(SECRET, 'chart', 'AAPL:2026-10-08');

        expect(verifyReportValue(SECRET, 'chart', 'AAPL:2026-10-09', sig)).toBe(
            false
        );
    });

    it('용도가 다르면 실패한다 — 차트 서명을 수신거부에 재사용할 수 없다', () => {
        const sig = signReportValue(SECRET, 'chart', 'user-1');

        expect(verifyReportValue(SECRET, 'unsubscribe', 'user-1', sig)).toBe(
            false
        );
    });

    it('비밀값이 다르면 실패한다', () => {
        const sig = signReportValue('other-secret', 'unsubscribe', 'user-1');

        expect(verifyReportValue(SECRET, 'unsubscribe', 'user-1', sig)).toBe(
            false
        );
    });

    it('길이가 다른 서명은 던지지 않고 실패한다', () => {
        expect(verifyReportValue(SECRET, 'unsubscribe', 'user-1', 'abc')).toBe(
            false
        );
        expect(verifyReportValue(SECRET, 'unsubscribe', 'user-1', '')).toBe(
            false
        );
    });

    it('URL에 그대로 넣을 수 있는 base64url 문자만 쓴다', () => {
        expect(signReportValue(SECRET, 'chart', 'x')).toMatch(/^[\w-]+$/);
    });
});
