/**
 * 이메일 주소 최대 길이(RFC 5321 경로 상한 320자). `users.email`·`inquiries.email`
 * 컬럼 길이와 문의 폼 검증이 같은 값을 쓰도록 한 곳에서 정의한다 — 값을 바꾸면
 * 두 테이블의 컬럼이 함께 바뀐다.
 */
export const EMAIL_MAX_LENGTH = 320;
