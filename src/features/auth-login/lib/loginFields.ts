/**
 * @file 로그인 폼의 `FormData` 필드 이름. 폼(`LoginForm`)이 싣고 서버 액션
 * (`loginAction`)과 오류 포커스 훅이 같은 이름으로 읽으므로 한곳에 둔다.
 */

/** 로그인 폼 필드 이름 — 입력의 `name`과 `formData.get()` 키가 같은 값을 쓴다. */
export const LOGIN_FIELD = {
    email: 'email',
    password: 'password',
    next: 'next',
} as const;
