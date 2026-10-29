import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';

/**
 * 표에 없는 코드가 와도 쓰는 `entities.auth` 메시지 키.
 *
 * 이 폼이 받는 오류는 입력 형식 오류뿐이다. 계정 존재 여부는 여전히 숨긴다 —
 * 열거 방어는 "가입돼 있는가"를 감추는 것이지, 빈 값에도 "메일을 보냈다"고
 * 말하라는 뜻이 아니다.
 */
export const FORGOT_PASSWORD_FALLBACK_ERROR_KEY = 'error.emailInvalid';

/**
 * 재설정 메일 요청 폼의 오류 코드를 `entities.auth` 메시지 키로 바꾼다.
 * 코드가 없으면 `undefined`(오류 없음)다.
 *
 * 번역은 호출부가 한다 — i18n 추출기는 번역자를 선언한 파일 안의 동적 키
 * 호출만 보고 그 라우트에 네임스페이스를 싣기 때문이다.
 */
export function forgotPasswordErrorKey(
    errorCode: string | undefined
): string | undefined {
    if (!errorCode) return undefined;
    return AUTH_ERROR_KEY[errorCode] ?? FORGOT_PASSWORD_FALLBACK_ERROR_KEY;
}
