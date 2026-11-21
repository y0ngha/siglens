import { DEFAULT_EMAIL_REPORT_TIMEZONE } from './emailReportConstants';
import { isValidTimeZone } from './validateEmailReportSettings';

/** 가입·동의 화면의 수신 선택 숨은 입력 이름. 값은 체크 상태에 따라 `'true'` / `'false'`. */
export const EMAIL_REPORT_OPT_IN_FIELD = 'email_report_opt_in';
/** 수신을 고른 시점의 브라우저 시간대를 싣는 숨은 입력 이름. */
export const EMAIL_REPORT_TIMEZONE_FIELD = 'email_report_timezone';
/** 수신을 고른 경우에 보내는 값. 서버는 이 값과 정확히 같을 때만 동의로 읽는다. */
export const EMAIL_REPORT_OPT_IN_VALUE = 'true';
/** 수신을 고르지 않은 경우에 보내는 값. 판정에는 쓰이지 않고 클라이언트 리터럴을 한곳에 모은다. */
export const EMAIL_REPORT_OPT_OUT_VALUE = 'false';

export interface SignupEmailReportOptIn {
    optIn: boolean;
    timezone: string;
}

/**
 * 가입 폼의 메일 리포트 수신 선택을 읽는다. 클라이언트가 보낸 값이라 그대로 믿지 않는다:
 * 동의는 값이 정확히 `'true'`일 때만이고, 시간대는 검증해 비었거나 틀리면 기본 시간대로 바꾼다.
 */
export function readSignupEmailReportOptIn(
    formData: FormData
): SignupEmailReportOptIn {
    const timezone = String(formData.get(EMAIL_REPORT_TIMEZONE_FIELD) ?? '');
    return {
        optIn:
            formData.get(EMAIL_REPORT_OPT_IN_FIELD) ===
            EMAIL_REPORT_OPT_IN_VALUE,
        timezone: isValidTimeZone(timezone)
            ? timezone
            : DEFAULT_EMAIL_REPORT_TIMEZONE,
    };
}
