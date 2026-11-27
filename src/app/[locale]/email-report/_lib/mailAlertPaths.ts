/**
 * `/email-report/alerts` 설정 페이지의 앱 경로(로케일 접두사 없음). 메타데이터의 canonical·og:url과
 * `/email-report`의 링크 행이 같은 값을 써야 하므로 한 곳에 둔다 — `page.tsx`는 Next 규약 밖의 값을
 * export할 수 없다.
 */
export const MAIL_ALERTS_PATH = '/email-report/alerts';
