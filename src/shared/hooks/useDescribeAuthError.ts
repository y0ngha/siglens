'use client';

import { useTranslations } from 'next-intl';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';

export interface AuthErrorLike {
    code?: string;
    message: string;
}

/**
 * 인증 폼 에러를 화면 문구로 바꾸는 함수를 돌려준다 — **코드**로 번역하고,
 * 코드가 `AUTH_ERROR_KEY`에 없을 때만 `message` 원문으로 떨어진다.
 *
 * use-case가 함께 돌려주는 `message`는 로그·폴백용 한국어 원문이라, 그대로
 * 화면에 쓰면 `/en/login`·`/en/signup`·`/en/reset-password`가 영어 폼 위에
 * 한국어 오류를 띄운다(실제로 그렇게 나가고 있었다). 이 규칙이 로그인·회원가입·
 * 비밀번호 재설정 폼에 같은 주석과 함께 세 번 복사돼 있어 한곳으로 모았다.
 *
 * 폴백이 원문이 아니라 **고정 키**인 폼(`DeleteAccountConfirm`,
 * `ForgotPasswordForm`)은 의미가 달라 이 훅을 쓰지 않는다.
 *
 * ⚠️ 순수 함수 `(error, tAuth)`가 아니라 **훅**인 이유: i18n 추출기
 * (`scripts/i18n/extract.mjs`)는 번역자를 **선언한 파일** 안의 동적 키 호출
 * (`tAuth(key)`)만 보고 그 라우트에 `entities.auth` 네임스페이스를 통째로
 * 싣는다. 번역자를 인자로 넘겨 다른 파일에서 부르면 추출기가 못 보고, 라우트의
 * 클라이언트 페이로드에서 `entities.auth`가 빠져 화면에 `MISSING_MESSAGE`가
 * 난다. 번역자 선언과 동적 호출을 이 파일에 함께 둬야 한다.
 */
export function useDescribeAuthError(): (
    error: AuthErrorLike | null | undefined
) => string | undefined {
    const tAuth = useTranslations('entities.auth');
    return error => {
        if (!error) return undefined;
        const key = error.code ? AUTH_ERROR_KEY[error.code] : undefined;
        return key ? tAuth(key) : error.message;
    };
}
