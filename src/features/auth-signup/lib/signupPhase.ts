/** 회원가입 3단계: 이메일 인증 요청 → 인증 코드 확인 → 비밀번호·이름 설정. */
export type SignupPhase = 'email' | 'code' | 'details';

/**
 * 두 `useActionState` 결과에서 현재 단계를 고른다. 인증이 끝났으면 요청 상태와
 * 무관하게 마지막 단계다 — 단계를 별도 state로 두지 않아야 effect 안의 setState 없이
 * 액션 결과만으로 화면이 정해진다.
 */
export function derivePhase(
    submitted: boolean,
    verified: boolean
): SignupPhase {
    if (verified) return 'details';
    if (submitted) return 'code';
    return 'email';
}

/**
 * 폼 입력 id. 화면(라벨 연결)과 포커스 이동이 같은 값을 써야 하므로 한 곳에 둔다.
 */
export const SIGNUP_FIELD_ID = {
    email: 'signup-email',
    code: 'signup-code',
    name: 'signup-name',
    password: 'signup-password',
} as const;

/** 단계에 들어설 때 포커스를 받는 첫 입력. */
export const PHASE_FIRST_FIELD_ID: Record<SignupPhase, string> = {
    email: SIGNUP_FIELD_ID.email,
    code: SIGNUP_FIELD_ID.code,
    details: SIGNUP_FIELD_ID.name,
};
