import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

/** 가입 폼에서 읽어 낸 값. 모두 클라이언트 입력이라 검증은 `registerUser`가 한다. */
export interface SignupFormInput {
    /** 앞뒤 공백만 뗀 값. 정규화·형식 검증은 use-case가 한다. */
    email: string;
    /** 공백도 비밀번호의 일부라 원문 그대로 둔다. */
    password: string;
    /** 비었으면 `undefined` — 이름 없이 가입한다. */
    name: string | undefined;
    /** 같은-오리진 경로만 남긴 돌아갈 곳. 없거나 의심스러우면 기본 경로. */
    next: string;
    /** 두 필수 동의가 모두 `'true'`인지. 필드가 없거나(`null`) `'false'`면 거짓이다. */
    hasRequiredConsent: boolean;
}

/** `registerAction`이 받은 `FormData`를 가입 입력으로 읽는다. */
export function readSignupForm(formData: FormData): SignupFormInput {
    const rawName = String(formData.get('name') ?? '').trim();
    return {
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
        name: rawName ? rawName : undefined,
        next: sanitizeNextPath(formData.get('next')?.toString()),
        hasRequiredConsent:
            formData.get('agreed_privacy') === 'true' &&
            formData.get('agreed_tos') === 'true',
    };
}
