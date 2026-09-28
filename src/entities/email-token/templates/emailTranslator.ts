/**
 * 메일 템플릿이 받는 번역자.
 *
 * 템플릿은 순수 함수라 훅도 요청 스코프도 없다 — 호출하는 서버 액션이
 * `getTranslations({ locale, namespace: 'entities.email-token.email' })`로
 * 만들어 넘긴다. 메일은 화면과 달리 **발송 시점의 로케일로 굳는다**:
 * 수신자가 나중에 언어를 바꿔도 이미 보낸 메일은 그대로다.
 */
export type EmailTranslator = (
    key: string,
    values?: Record<string, string>
) => string;
