/** `readConsentForm`이 돌려주는 동의 폼 입력. */
export interface ConsentFormInput {
    /** 대기 중인 OAuth 가입 토큰(앞뒤 공백 제거). 비었으면 빈 문자열. */
    token: string;
    /** 필수 약관 두 개(개인정보·이용약관)에 모두 동의했는가. */
    agreed: boolean;
}

/** 체크박스 상태를 실어 나르는 숨은 입력이 "동의"일 때 보내는 값. */
export const CONSENT_AGREED_VALUE = 'true';

function readField(formData: FormData, key: string): string {
    return String(formData.get(key) ?? '');
}

/**
 * OAuth 동의 폼의 `FormData`를 읽는다. 클라이언트가 보낸 값이라 그대로 믿지 않고,
 * 두 약관 값이 정확히 `CONSENT_AGREED_VALUE`일 때만 동의로 본다.
 */
export function readConsentForm(formData: FormData): ConsentFormInput {
    return {
        token: readField(formData, 'token').trim(),
        agreed:
            readField(formData, 'agreed_privacy') === CONSENT_AGREED_VALUE &&
            readField(formData, 'agreed_tos') === CONSENT_AGREED_VALUE,
    };
}
